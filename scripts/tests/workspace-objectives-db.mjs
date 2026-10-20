// Run: NODE_PATH=<directory containing @electric-sql/pglite> node scripts/tests/workspace-objectives-db.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002",
  c = "00000000-0000-4000-8000-000000000003";
await db.exec(`
CREATE SCHEMA auth; CREATE ROLE authenticated;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('${a}'),('${b}'),('${c}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
CREATE TABLE user_profiles(id uuid PRIMARY KEY, auth_user_id uuid, owner_id uuid, is_active boolean, role text);
INSERT INTO user_profiles VALUES ('${a}','${a}','${a}',true,'admin'),('${b}','${b}','${b}',true,'admin'),('${c}','${c}','${a}',true,'member');
CREATE FUNCTION owner_id_of(uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT owner_id FROM user_profiles WHERE auth_user_id=$1$$;
CREATE FUNCTION effective_owner_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT owner_id_of(auth.uid())$$;
CREATE FUNCTION is_admin_of_user(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM user_profiles WHERE auth_user_id=auth.uid() AND role='admin' AND owner_id=owner_id_of($1))$$;
CREATE FUNCTION auto_set_owner_id() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.user_id:=effective_owner_id();RETURN NEW;END$$;
CREATE FUNCTION apply_standard_rls(t text) RETURNS void LANGUAGE plpgsql AS $$BEGIN EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('CREATE POLICY access ON %I FOR ALL TO authenticated USING (user_id=effective_owner_id()) WITH CHECK(user_id=effective_owner_id())',t); END$$;
CREATE TABLE tags(id uuid PRIMARY KEY,user_id uuid,name text,color text,created_at timestamptz DEFAULT now());
CREATE TABLE workspace_objectives(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,created_by uuid NOT NULL,title text,assignee_id uuid,tags text[] NOT NULL DEFAULT '{}',due_date date);
CREATE TABLE workspace_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,created_by uuid NOT NULL,title text,status text DEFAULT 'a_fazer',tags text[] NOT NULL DEFAULT '{}');
ALTER TABLE workspace_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_objectives_select ON workspace_objectives FOR SELECT USING(user_id=auth.uid());
CREATE POLICY workspace_objectives_update ON workspace_objectives FOR UPDATE USING(user_id=auth.uid());
CREATE POLICY workspace_objectives_insert ON workspace_objectives FOR INSERT WITH CHECK(user_id=auth.uid());
CREATE POLICY workspace_objectives_delete ON workspace_objectives FOR DELETE USING(user_id=auth.uid());
ALTER TABLE workspace_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY access ON workspace_tasks FOR ALL USING(user_id=auth.uid());
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
INSERT INTO tags VALUES ('${a}','${a}','Design','#123456',now());
INSERT INTO workspace_tasks(user_id,created_by,tags) VALUES('${a}','${a}',ARRAY['${a}']);
`);
await db.exec(
  readFileSync(
    "supabase/migrations/20261017120000_workspace_objective_planning.sql",
    "utf8",
  ),
);
await db.exec(
  readFileSync("supabase/migrations/20261020130000_workspace_bsc.sql", "utf8"),
);
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log("PASS", name);
}
async function reject(sql) {
  await assert.rejects(db.exec(sql));
}
await db.exec(`SET ROLE authenticated; SET test.uid='${a}'`);
const insert = async (sql) => (await db.query(sql)).rows[0].id;
const root = await insert(
  `INSERT INTO workspace_objectives(user_id,created_by,title) VALUES('${a}','${a}','Root') RETURNING id`,
);
const child = await insert(
  `INSERT INTO workspace_objectives(user_id,created_by,title,parent_id) VALUES('${a}','${a}','Child','${root}') RETURNING id`,
);
await check("cycles and self-parent rejected", async () => {
  await reject(
    `UPDATE workspace_objectives SET parent_id='${child}' WHERE id='${root}'`,
  );
  await reject(
    `UPDATE workspace_objectives SET parent_id=id WHERE id='${root}'`,
  );
});
await check("invalid dates rejected", () =>
  reject(
    `UPDATE workspace_objectives SET start_date='2026-10-20',due_date='2026-10-01' WHERE id='${root}'`,
  ),
);
await check("foreign assignee rejected", () =>
  reject(
    `UPDATE workspace_objectives SET assignee_ids=ARRAY['${b}']::uuid[] WHERE id='${root}'`,
  ),
);
await check("owner transfer rejected", () =>
  reject(`UPDATE workspace_objectives SET user_id='${b}' WHERE id='${root}'`),
);
const task = (await db.query("SELECT id FROM workspace_tasks")).rows[0].id;
const block = await insert(
  `INSERT INTO workspace_objective_blocks(objective_id,title) VALUES('${root}','Block') RETURNING id`,
);
await db.exec(
  `INSERT INTO workspace_objective_task_links(objective_id,task_id,block_id) VALUES('${root}','${task}','${block}')`,
);
await check("block cannot belong to another objective", () =>
  reject(
    `INSERT INTO workspace_objective_task_links(objective_id,task_id,block_id) VALUES('${child}','${task}','${block}')`,
  ),
);
await check("deleting block preserves links and tasks", async () => {
  await db.exec(`DELETE FROM workspace_objective_blocks WHERE id='${block}'`);
  assert.equal(
    (await db.query("SELECT block_id FROM workspace_objective_task_links"))
      .rows[0].block_id,
    null,
  );
});
await check("constant metric target rejected", () =>
  reject(
    `INSERT INTO workspace_objective_metrics(objective_id,title,baseline,target) VALUES('${root}','Revenue',0,0)`,
  ),
);
await db.exec(
  `INSERT INTO workspace_objective_metrics(objective_id,title,target) VALUES('${root}','Revenue',100); UPDATE workspace_objectives SET assignee_ids=ARRAY['${c}']::uuid[] WHERE id='${root}'`,
);
await check("assigned teammate can access objective and metrics", async () => {
  await db.exec(`SET test.uid='${c}'`);
  assert.equal(
    (await db.query("SELECT * FROM workspace_objective_metrics")).rows.length,
    1,
  );
});
await check(
  "other organization cannot read or write objectives, children, tags",
  async () => {
    await db.exec(`SET test.uid='${b}'`);
    for (const t of [
      "workspace_objectives",
      "workspace_objective_metrics",
      "workspace_objective_task_links",
      "workspace_tags",
    ])
      assert.equal((await db.query(`SELECT * FROM ${t}`)).rows.length, 0);
    await reject(
      `INSERT INTO workspace_objective_blocks(objective_id,title) VALUES('${root}','Intrusion')`,
    );
    await reject(
      `INSERT INTO workspace_objectives(user_id,created_by,parent_id) VALUES('${b}','${b}','${root}')`,
    );
  },
);
await check("cross-workspace task and tag links rejected", async () => {
  const other = await insert(
    `INSERT INTO workspace_objectives(user_id,created_by) VALUES('${b}','${b}') RETURNING id`,
  );
  await reject(
    `INSERT INTO workspace_objective_task_links(objective_id,task_id) VALUES('${other}','${task}')`,
  );
  await reject(
    `UPDATE workspace_objectives SET tags=ARRAY['${a}'] WHERE id='${other}'`,
  );
});
await check("workspace tags copied independently", async () => {
  await db.exec(
    `SET test.uid='${a}';UPDATE workspace_tags SET name='Local only' WHERE id='${a}'`,
  );
  assert.equal(
    (await db.query(`SELECT name FROM tags WHERE id='${a}'`)).rows[0].name,
    "Design",
  );
});
await check(
  "BSC perspective validation preserves unclassified legacy objectives",
  async () => {
    assert.equal(
      (
        await db.query(
          `SELECT perspective FROM workspace_objectives WHERE id='${root}'`,
        )
      ).rows[0].perspective,
      null,
    );
    await db.exec(
      `UPDATE workspace_objectives SET perspective='financeira' WHERE id='${root}'`,
    );
    await reject(
      `UPDATE workspace_objectives SET perspective='unknown' WHERE id='${root}'`,
    );
  },
);
const metricId = await insert(
  `INSERT INTO workspace_objective_metrics(objective_id,title,target) VALUES('${root}','Receita',25000) RETURNING id`,
);
await check(
  "monthly records are independent and unique with valid numeric values",
  async () => {
    await db.exec(
      `INSERT INTO workspace_objective_metric_periods(metric_id,month,target,current_value) VALUES('${metricId}','2026-10-01',25000,10000),('${metricId}','2026-11-01',30000,0)`,
    );
    await reject(
      `INSERT INTO workspace_objective_metric_periods(metric_id,month,target) VALUES('${metricId}','2026-10-01',1)`,
    );
    await reject(
      `INSERT INTO workspace_objective_metric_periods(metric_id,month,target) VALUES('${metricId}','2026-12-02',1)`,
    );
    await reject(
      `UPDATE workspace_objective_metric_periods SET current_value='NaN' WHERE metric_id='${metricId}'`,
    );
    await reject(
      `UPDATE workspace_objective_metric_periods SET month='2027-01-01' WHERE metric_id='${metricId}'`,
    );
    await db.exec(
      `UPDATE workspace_objective_metric_periods SET current_value=15000 WHERE metric_id='${metricId}' AND month='2026-10-01'`,
    );
    assert.equal(
      Number(
        (
          await db.query(
            `SELECT current_value FROM workspace_objective_metric_periods WHERE metric_id='${metricId}' AND month='2026-11-01'`,
          )
        ).rows[0].current_value,
      ),
      0,
    );
  },
);
await check(
  "monthly RLS blocks reads, updates, inserts and deletes by another organization",
  async () => {
    await db.exec(`SET test.uid='${b}'`);
    assert.equal(
      (await db.query("SELECT * FROM workspace_objective_metric_periods")).rows
        .length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "UPDATE workspace_objective_metric_periods SET current_value=999 RETURNING id",
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "DELETE FROM workspace_objective_metric_periods RETURNING id",
        )
      ).rows.length,
      0,
    );
    await reject(
      `INSERT INTO workspace_objective_metric_periods(metric_id,month,target) VALUES('${metricId}','2026-12-01',1)`,
    );
    await db.exec(`SET test.uid='${a}'`);
  },
);
await check("assigned member can record objective results", async () => {
  await db.exec(
    `UPDATE workspace_objectives SET assignee_ids=ARRAY['${c}']::uuid[] WHERE id='${root}';SET test.uid='${c}'`,
  );
  await db.exec(
    `INSERT INTO workspace_objective_metric_periods(metric_id,month,target,current_value) VALUES('${metricId}','2026-12-01',25000,20000)`,
  );
  await db.exec(`SET test.uid='${a}'`);
});
await check(
  "deleting parent preserves children and operational tasks",
  async () => {
    await db.exec(`DELETE FROM workspace_objectives WHERE id='${root}'`);
    assert.equal(
      (
        await db.query(
          `SELECT parent_id FROM workspace_objectives WHERE id='${child}'`,
        )
      ).rows[0].parent_id,
      null,
    );
    assert.equal(
      (await db.query("SELECT * FROM workspace_tasks")).rows.length,
      1,
    );
  },
);
console.log(`${passed} database checks passed`);
await db.close();
