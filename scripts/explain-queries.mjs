#!/usr/bin/env node
/**
 * EXPLAIN ANALYZE runner — Lancaster SaaS Sprint 7.1
 *
 * Pré-requisito: ambas as migrations aplicadas no Supabase SQL Editor
 *   1. supabase/migrations/20260627_phase7_perf_indexes.sql
 *   2. supabase/migrations/20260628_phase7_explain_helpers.sql
 *
 * Uso:
 *   npx tsx scripts/explain-queries.mjs [user_id] [form_id]
 *
 * Exemplos:
 *   npx tsx scripts/explain-queries.mjs
 *   npx tsx scripts/explain-queries.mjs a1b2c3d4-... f5e6d7c8-...
 *
 * O user_id deve ser de um usuário real para obter planos com dados reais.
 * Com UUID dummy, o plano mostra a estrutura correta mas timing ≈ 0ms.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.local ───────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");

function loadEnv(path) {
  try {
    const lines = readFileSync(path, "utf-8").split("\n");
    const out = {};
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    console.error(`Cannot read ${path}`);
    process.exit(1);
  }
}

const env = loadEnv(envPath);
const SUPABASE_URL     = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Params ────────────────────────────────────────────────────────────────────

const DUMMY_UUID = "00000000-0000-0000-0000-000000000001";
const userId   = process.argv[2] ?? DUMMY_UUID;
const formId   = process.argv[3] ?? "00000000-0000-0000-0000-000000000002";
const corrId   = process.argv[4] ?? "dummy-correlation-token";
const sessId   = process.argv[5] ?? "00000000-0000-0000-0000-000000000003";

const usingDummy = userId === DUMMY_UUID;

// ── Helpers ───────────────────────────────────────────────────────────────────

const HR   = "═".repeat(72);
const HR2  = "─".repeat(72);
const PASS = "✓";
const WARN = "⚠";
const FAIL = "✗";

function header(n, title) {
  console.log(`\n${HR}`);
  console.log(`  QUERY ${n} — ${title}`);
  console.log(HR);
}

function checkPlan(lines) {
  const plan = lines.join("\n");
  const findings = [];

  if (/Seq Scan/i.test(plan))
    findings.push(`${FAIL} SEQ SCAN detectado — índice não está sendo usado`);
  else
    findings.push(`${PASS} Sem Seq Scan`);

  if (/Bitmap Heap Scan/i.test(plan))
    findings.push(`${WARN} Bitmap Heap Scan — pode ser aceitável para FTS, ruim para list/detail`);
  else
    findings.push(`${PASS} Sem Bitmap Heap Scan`);

  if (/ Sort /i.test(plan))
    findings.push(`${FAIL} Sort extra — ORDER BY não coberto pelo índice`);
  else
    findings.push(`${PASS} Sem Sort (ORDER BY coberto pelo índice)`);

  const indexMatch = plan.match(/Index (?:Only )?Scan using (\S+)/i);
  if (indexMatch)
    findings.push(`${PASS} Índice: ${indexMatch[1]}`);
  else if (!/Seq Scan/i.test(plan))
    findings.push(`${WARN} Estrutura de índice não identificada no plano`);

  const timeMatch = plan.match(/Execution Time:\s*([\d.]+)\s*ms/);
  if (timeMatch)
    findings.push(`  Execution Time: ${timeMatch[1]} ms`);

  const planTimeMatch = plan.match(/Planning Time:\s*([\d.]+)\s*ms/);
  if (planTimeMatch)
    findings.push(`  Planning Time:  ${planTimeMatch[1]} ms`);

  const bufMatch = plan.match(/Buffers: shared hit=(\d+)(?:\s+read=(\d+))?/);
  if (bufMatch)
    findings.push(`  Buffers: hit=${bufMatch[1]}${bufMatch[2] ? ` read=${bufMatch[2]}` : ""}`);

  return findings;
}

async function runExplain(fnName, params, queryN, title) {
  header(queryN, title);

  const { data, error } = await supabase.rpc(fnName, params);

  if (error) {
    const notFound = error.code === "PGRST202" || error.code === "42883";
    const badColumn = error.code === "42703";
    if (notFound) {
      console.log(`\n  ${WARN} Função ${fnName} não encontrada (PGRST202).`);
      console.log(`     Aplique 20260628_phase7_explain_helpers.sql no Supabase SQL Editor.\n`);
    } else if (badColumn) {
      console.log(`\n  ${FAIL} Erro de schema ao executar EXPLAIN (${error.code}): ${error.message}`);
      console.log(`     A função existe mas a query referencia coluna inexistente na tabela.`);
      console.log(`     Re-aplique 20260628_phase7_explain_helpers.sql (versão corrigida).\n`);
    } else {
      console.log(`\n  ${FAIL} Erro: ${error.message} (code: ${error.code})\n`);
    }
    return;
  }

  if (!data || data.length === 0) {
    console.log("\n  (sem output — função retornou vazio)\n");
    return;
  }

  // Supabase returns SETOF TEXT as string[] — each element IS the text line.
  // Object.values(string) would iterate characters, so check type first.
  const lines = data.map(row =>
    typeof row === "string" ? row : String(Object.values(row ?? {})[0] ?? "")
  );

  console.log("\n  PLAN:");
  console.log(HR2);
  for (const line of lines) console.log(`  ${line}`);
  console.log(HR2);

  console.log("\n  ANÁLISE:");
  const findings = checkPlan(lines);
  for (const f of findings) console.log(`  ${f}`);
  console.log();
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${HR}`);
console.log("  Lancaster SaaS — EXPLAIN ANALYZE Runner (Sprint 7.1)");
console.log(HR);
console.log(`  Supabase URL:  ${SUPABASE_URL}`);
console.log(`  user_id:       ${userId}${usingDummy ? "  ← DUMMY (use ID real para timing real)" : ""}`);
console.log(`  form_id:       ${formId}`);
console.log(`  session_id:    ${sessId}`);

if (usingDummy) {
  console.log(`\n  ${WARN} Usando UUID dummy. O plano mostrará a estrutura correta`);
  console.log(`     mas Execution Time ≈ 0ms (0 rows). Para timing realista,`);
  console.log(`     passe um user_id real como primeiro argumento:`);
  console.log(`     npx tsx scripts/explain-queries.mjs <user_id>`);
}

await runExplain(
  "_diag_explain_list_all_forms",
  { p_user_id: userId, p_archived: false },
  1,
  "LIST — todos os formulários (sem form_id, sem cursor)"
);

await runExplain(
  "_diag_explain_list_by_form",
  { p_user_id: userId, p_form_id: formId, p_archived: false },
  2,
  "LIST — formulário específico (com form_id)"
);

await runExplain(
  "_diag_explain_stats",
  { p_user_id: userId, p_archived: false, p_form_id: null },
  3,
  "get_submission_stats — aggregate condicional (single pass)"
);

await runExplain(
  "_diag_explain_deliveries",
  { p_form_id: formId, p_correlation_id: corrId },
  4,
  "integration_deliveries — detalhe da submission"
);

await runExplain(
  "_diag_explain_events",
  { p_session_id: sessId },
  5,
  "form_events — timeline da sessão"
);

console.log(`${HR}`);
console.log("  Após coletar o diagnóstico, rode no SQL Editor:");
console.log("  DROP FUNCTION IF EXISTS _diag_explain_list_all_forms(UUID,BOOLEAN);");
console.log("  DROP FUNCTION IF EXISTS _diag_explain_list_by_form(UUID,UUID,BOOLEAN);");
console.log("  DROP FUNCTION IF EXISTS _diag_explain_stats(UUID,BOOLEAN,UUID);");
console.log("  DROP FUNCTION IF EXISTS _diag_explain_deliveries(UUID,TEXT);");
console.log("  DROP FUNCTION IF EXISTS _diag_explain_events(UUID);");
console.log(`${HR}\n`);
