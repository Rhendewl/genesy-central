const { PGlite } = await import(
  process.env.PGLITE_MODULE ?? "@electric-sql/pglite"
);
import fs from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated,service_role; grant execute on function auth.uid() to authenticated,service_role; create table public.user_profiles(auth_user_id uuid,owner_id uuid,is_active boolean,role text,permissions jsonb); grant select on user_profiles to authenticated,service_role;`,
);
await db.exec(
  fs.readFileSync(
    "supabase/migrations/20261029220000_instagram_competitors.sql",
    "utf8",
  ),
);
const org = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  member = "33333333-3333-4333-8333-333333333333",
  denied = "44444444-4444-4444-8444-444444444444";
await db.query("insert into auth.users values ($1),($2)", [org, other]);
await db.query(
  `insert into user_profiles values ($1,$2,true,'member','["marketing"]'),($3,$2,true,'member','[]')`,
  [member, org, denied],
);
await db.exec("set role service_role");
const profile = (
  await db.query(
    "insert into marketing_competitors(organization_id,username) values ($1,$2) returning id",
    [org, "sample"],
  )
).rows[0].id;
await db.query(
  "insert into marketing_competitors(organization_id,username) values ($1,$2)",
  [other, "foreign"],
);
const payload = {
  instagram_id: "42",
  name: "Sample",
  followers_count: 100,
  media_count: 1,
  partial: false,
  posts: [
    {
      id: "1",
      caption: "test",
      media_type: "IMAGE",
      published_at: "2026-10-29T00:00:00Z",
      like_count: 10,
      comments_count: null,
      permalink: null,
    },
  ],
};
await db.query("select save_competitor_observation($1,$2,$3)", [
  profile,
  org,
  JSON.stringify(payload),
]);
payload.posts[0].like_count = 20;
await db.query("select save_competitor_observation($1,$2,$3)", [
  profile,
  org,
  JSON.stringify(payload),
]);
assert.equal(
  (await db.query("select * from marketing_competitor_snapshots")).rows.length,
  2,
);
assert.equal(
  (await db.query("select * from marketing_competitor_posts")).rows[0]
    .like_count,
  20,
);
assert.equal(
  (await db.query("select * from marketing_competitor_posts")).rows[0]
    .comments_count,
  null,
);
const bad = { ...payload, posts: [{ ...payload.posts[0], like_count: -1 }] };
await assert.rejects(
  db.query("select save_competitor_observation($1,$2,$3)", [
    profile,
    org,
    JSON.stringify(bad),
  ]),
);
assert.equal(
  (await db.query("select * from marketing_competitor_snapshots")).rows.length,
  2,
);
await assert.rejects(
  db.query("select save_competitor_observation($1,$2,$3)", [
    profile,
    other,
    JSON.stringify(payload),
  ]),
);
await db.exec("set role authenticated");
for (const [user, count] of [
  [org, 1],
  [member, 1],
  [denied, 0],
  [other, 1],
]) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  assert.equal(
    (await db.query("select * from marketing_competitors")).rows.length,
    count,
  );
  if (user === other || user === denied)
    assert.equal(
      (await db.query("select * from marketing_competitor_posts")).rows.length,
      0,
    );
}
await assert.rejects(
  db.query(
    "insert into marketing_competitors(organization_id,username) values ($1,$2)",
    [other, "forbidden"],
  ),
);
await assert.rejects(
  db.query("select save_competitor_observation($1,$2,$3)", [
    profile,
    org,
    JSON.stringify(payload),
  ]),
);
await db.exec("set role service_role");
for (let i = 0; i < 19; i++)
  await db.query(
    "insert into marketing_competitors(organization_id,username) values ($1,$2)",
    [org, "profile" + i],
  );
await assert.rejects(
  db.query(
    "insert into marketing_competitors(organization_id,username) values ($1,$2)",
    [org, "overflow"],
  ),
);
await db.query("delete from marketing_competitors where id=$1", [profile]);
assert.equal(
  (await db.query("select * from marketing_competitor_snapshots")).rows.length,
  0,
);
assert.equal(
  (await db.query("select * from marketing_competitor_posts")).rows.length,
  0,
);
console.log(
  "PASS: migration, snapshots, upsert, rollback, cross-organization RPC, RLS owner/member/denied/foreign, write restrictions, 20-profile cap and cascade deletion.",
);
await db.close();
