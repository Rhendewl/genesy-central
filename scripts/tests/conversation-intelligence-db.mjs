// Isolated PostgreSQL test, never uses production credentials.
// PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/tests/conversation-intelligence-db.mjs
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
const tenant = "00000000-0000-4000-8000-000000000001",
  alice = "00000000-0000-4000-8000-000000000002",
  bob = "00000000-0000-4000-8000-000000000003",
  other = "00000000-0000-4000-8000-000000000004";
await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create table user_profiles(auth_user_id uuid,owner_id uuid,is_active boolean,role text,permissions jsonb not null default '["crm"]'::jsonb);create table agency_clients(id uuid primary key,user_id uuid);`);
await db.exec(
  await readFile(
    new URL(
      "../../supabase/migrations/20261027_conversation_intelligence.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
for (const id of [tenant, alice, bob, other])
  await db.query("insert into auth.users values($1)", [id]);
await db.query(
  "insert into user_profiles(auth_user_id,owner_id,is_active,role) values($1,$2,true,'comercial'),($3,$2,true,'comercial'),($4,$4,true,'admin')",
  [alice, tenant, bob, other],
);
const conn = (
  await db.query("select ci_connect($1,$2,$3,$4,$5,$6) id", [
    tenant,
    alice,
    "waba",
    "phone",
    "display",
    "encrypted",
  ])
).rows[0].id;
const consent = (
  await db.query(
    "insert into ci_consents(connection_id,tenant_id,sdr_id,contact_hash,contact_label,evidence,allow_ai,granted_at) values($1,$2,$3,'hash','masked','record authorization',true,now()-interval '2 days') returning id",
    [conn, tenant, alice],
  )
).rows[0].id;
async function ingest(
  contact = "hash",
  provider = "message",
  sent = new Date().toISOString(),
  waba = "waba",
) {
  return (
    await db.query(
      "select ci_ingest('phone',$1,$2,$3,'inbound',$4,'text','ciphertext') ok",
      [waba, contact, provider, sent],
    )
  ).rows[0].ok;
}
assert.equal(await ingest("unauthorized"), false);
assert.equal(
  await ingest("hash", "message", new Date().toISOString(), "other-waba"),
  false,
);
assert.equal(await ingest(), true);
assert.equal(await ingest(), true);
assert.equal(
  Number((await db.query("select count(*) n from ci_messages")).rows[0].n),
  1,
);
assert.equal(await ingest("hash", "old", "2020-01-01"), false);
await db.exec(
  `set role authenticated; select set_config('request.jwt.claim.sub','${bob}',false);`,
);
assert.equal((await db.query("select * from ci_messages")).rows.length, 0);
assert.equal((await db.query("select * from ci_connections")).rows.length, 0);
await assert.rejects(db.query("select * from ci_credentials"));
await assert.rejects(
  db.query(
    "select ci_ingest('phone','waba','hash','spoof','inbound',now(),'text','body')",
  ),
);
await assert.rejects(
  db.query(
    "insert into ci_messages(consent_id,provider_id,direction,sent_at,kind) values($1,'spoof','inbound',now(),'text')",
    [consent],
  ),
);
await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);
assert.equal((await db.query("select * from ci_messages")).rows.length, 0);
await db.exec(`select set_config('request.jwt.claim.sub','${alice}',false);`);
assert.equal((await db.query("select * from ci_messages")).rows.length, 1);
await db.exec("reset role");
const msg = (await db.query("select id from ci_messages")).rows[0].id;
assert.equal(
  (
    await db.query("select ci_save_analysis($1,$2,'model',$3,'[]'::jsonb) ok", [
      consent,
      alice,
      [msg],
    ])
  ).rows[0].ok,
  true,
);
await db.query("select ci_revoke($1,$2)", [consent, bob]);
assert.equal((await db.query("select * from ci_messages")).rows.length, 1);
await db.query("select ci_revoke($1,$2)", [consent, alice]);
assert.equal((await db.query("select * from ci_messages")).rows.length, 0);
assert.equal((await db.query("select * from ci_analyses")).rows.length, 0);
assert.equal(await ingest("hash", "late-retry"), false);
assert.equal(
  (
    await db.query("select ci_save_analysis($1,$2,'model',$3,'[]'::jsonb) ok", [
      consent,
      alice,
      [msg],
    ])
  ).rows[0].ok,
  false,
);

const renewed = (
  await db.query(
    "select ci_authorize($1,$2,'hash','masked',null,'renewed authorization',true,false) id",
    [conn, alice],
  )
).rows[0].id;
assert.notEqual(renewed, consent);
await assert.rejects(
  db.query(
    "select ci_authorize($1,$2,'hash','masked',null,'another authorization',true,false)",
    [conn, alice],
  ),
);
assert.equal(
  (await db.query("select ci_claim_analysis($1,$2) ok", [renewed, alice]))
    .rows[0].ok,
  true,
);
assert.equal(
  (await db.query("select ci_claim_analysis($1,$2) ok", [renewed, alice]))
    .rows[0].ok,
  false,
);
await db.query("update ci_connections set status='paused' where id=$1", [conn]);
assert.equal(await ingest("hash", "paused"), false);
await db.query("update ci_connections set status='connected' where id=$1", [
  conn,
]);
await db.query(
  "update user_profiles set permissions='[]'::jsonb where auth_user_id=$1",
  [alice],
);
assert.equal(await ingest("hash", "permission-removed"), false);
await db.query(
  "update user_profiles set permissions='[\"crm\"]'::jsonb where auth_user_id=$1",
  [alice],
);
await db.query(
  "update ci_consents set granted_at=now()-interval '1 hour' where id=$1",
  [renewed],
);
assert.equal(await ingest("hash", "renewed"), true);
await db.query(
  "update ci_consents set expires_at=now()-interval '1 second' where id=$1",
  [renewed],
);
assert.equal(await ingest("hash", "expired"), false);
await db.exec("select ci_purge()");
assert.equal((await db.query("select * from ci_messages")).rows.length, 0);
await db.exec("select ci_purge()");
await db.query("delete from ci_connections where id=$1", [conn]);
assert.equal((await db.query("select * from ci_credentials")).rows.length, 0);
console.log(
  "PASS: migration, grants/RLS, cross-SDR/cross-tenant isolation, consent gates, idempotency, revoked analysis race, cascading deletion",
);
await db.close();
