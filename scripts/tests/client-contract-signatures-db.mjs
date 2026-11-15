import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
const owner = "00000000-0000-4000-8000-000000000001";
await db.exec(`create schema auth; create role anon;create role authenticated;create role service_role;
create table auth.users(id uuid primary key);insert into auth.users values('${owner}');
create function auth.uid() returns uuid language sql as $$select null::uuid$$;
create table agency_clients(id uuid primary key default gen_random_uuid(),user_id uuid,name text,company_type text,status text,monthly_fee numeric,contact_name text,contact_email text,contact_phone text,notes text);`);
await db.exec(
  readFileSync(
    "supabase/migrations/20261105200000_client_contract_signatures.sql",
    "utf8",
  ),
);
await db.exec(readFileSync("supabase/migrations/20261106020000_contract_client_type_and_deletion.sql", "utf8"));
const contract = "00000000-0000-4000-8000-000000000010";
const signers = [1, 2, 3].map((n) => ({
  id: `00000000-0000-4000-8000-00000000002${n}`,
  name: `Pessoa ${n}`,
  email: `p${n}@test.com`,
  role: n === 1 ? "cliente" : "testemunha",
  token_hash: `token${n}`,
}));
await db.query("select issue_client_contract($1::jsonb,$2::jsonb)", [
  JSON.stringify({
    id: contract,
    user_id: owner,
    title: "Teste",
    body: "Texto fixo",
    content_hash: "hash-original",
    client_data: {
      name: "Empresa",
      company_type: "construtora",
      document: "12345678000199",
      email: "a@test.com",
      monthly_fee: 100,
    },
  }),
  JSON.stringify(signers),
]);
await db.exec(readFileSync("supabase/migrations/20261106010000_contract_email_verification.sql", "utf8"));
const challenge = async (fn, hash) => (await db.query(`select ${fn}($1,$2) ok`, [signers[0].id, hash])).rows[0].ok;
assert.equal(await challenge('request_contract_signature_code', 'correct'), true);
assert.equal(await challenge('request_contract_signature_code', 'replacement'), false);
assert.equal(await challenge('verify_contract_signature_code', 'wrong'), false);
assert.equal(await challenge('verify_contract_signature_code', 'correct'), true);
assert.equal(await challenge('verify_contract_signature_code', 'correct'), false);
await db.exec(`update contract_signature_challenges set sent_at=now()-interval '2 minutes'`);
assert.equal(await challenge('request_contract_signature_code', 'new'), true);
for (let attempt=0;attempt<5;attempt++) assert.equal(await challenge('verify_contract_signature_code', 'wrong'), false);
assert.equal(await challenge('verify_contract_signature_code', 'new'), false);
const count = async () =>
  Number((await db.query("select count(*) n from agency_clients")).rows[0].n);
const sign = (token, hash = "hash-original") =>
  db.query("select sign_client_contract($1,$2,$3,$4,$5,$6,$7) result", [
    token,
    hash,
    "Pessoa",
    "12345678901",
    "Li e aceito",
    "127.0.0.1",
    "test",
  ]);
assert.equal(await count(), 0);
await assert.rejects(sign("invalid"), /Link inválido/);
await assert.rejects(sign("token1", "changed"), /documento mudou/);
await sign("token1");
await sign("token1");
assert.equal(await count(), 0);
await sign("token2");
assert.equal(await count(), 0);
await sign("token3");
assert.equal(await count(), 1);
await sign("token3");
assert.equal(await count(), 1);
assert.equal(
  (await db.query("select status from client_contract_documents")).rows[0]
    .status,
  "signed",
);
assert.equal(
  Number(
    (
      await db.query(
        "select count(*) n from client_contract_signers where signed_at is not null and document_hash=$1",
        ["hash-original"],
      )
    ).rows[0].n,
  ),
  3,
);
await db.exec(`set role anon`);
await assert.rejects(
  db.query("select * from client_contract_signers"),
  /permission denied/,
);
await assert.rejects(sign("token1"), /permission denied/);
await db.exec("reset role");
await assert.rejects(
  db.exec(`update client_contract_documents set body='Texto alterado'`),
  /não pode ser alterado/,
);
await assert.rejects(
  db.exec(`update client_contract_documents set status='cancelled'`),
  /finalizado/,
);
await db.exec(
  `update client_contract_documents set expires_at=now()-interval '1 day'`,
);
await assert.rejects(sign("token1"), /expirado/);

const createdClient=(await db.query("select id,company_type from agency_clients")).rows[0];
assert.equal(createdClient.company_type,'construtora');
await db.exec("grant select,delete on agency_clients to authenticated; set role authenticated");
await db.query("delete from agency_clients where id=$1",[createdClient.id]);
await db.exec("reset role");
const retained=(await db.query("select client_id,body,status from client_contract_documents where id=$1",[contract])).rows[0];
assert.equal(retained.client_id,null);assert.equal(retained.body,'Texto fixo');assert.equal(retained.status,'signed');
await db.exec(`update client_contract_documents set expires_at=now()+interval '1 day'`);
await sign('token1');assert.equal(await count(),0);
await db.query("delete from client_contract_documents where id=$1",[contract]);
assert.equal(Number((await db.query("select count(*) n from client_contract_signers")).rows[0].n),0);
await assert.rejects(sign('token1'),/inválido/);
console.log(
  "OK: signatures, immutable snapshots, client type, authenticated client deletion, no client resurrection, contract deletion and invalidated links.",
);
await db.close();
