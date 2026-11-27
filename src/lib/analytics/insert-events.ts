// ─────────────────────────────────────────────────────────────────────────────
// Gravação de eventos de formulário (servidor)
//
// form_events tem um índice ÚNICO PARCIAL em idempotency_key
// (WHERE idempotency_key IS NOT NULL). O upsert do PostgREST gera
// `ON CONFLICT (idempotency_key)` sem o predicado, e o Postgres recusa:
// "there is no unique or exclusion constraint matching the ON CONFLICT
// specification". Por isso nenhum evento era gravado. Aqui fazemos a
// deduplicação explicitamente: descartamos chaves já gravadas e inserimos o
// resto; numa corrida (23505), inserimos linha a linha ignorando duplicatas.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";

export interface FormEventRow {
  form_id:          string;
  user_id:          string;
  session_id:       string;
  event:            string;
  step_id:          string | null;
  duration:         number | null;
  meta:             Record<string, unknown> | null;
  idempotency_key:  string | null;
}

type DbError = { code?: string; message: string } | null;

export async function insertFormEvents(db: SupabaseClient, rows: FormEventRow[]): Promise<{ saved: number; error: string | null }> {
  if (!rows.length) return { saved: 0, error: null };

  // Duplicatas dentro do próprio lote.
  const seen = new Set<string>();
  let pending = rows.filter(row => {
    if (!row.idempotency_key) return true;
    if (seen.has(row.idempotency_key)) return false;
    seen.add(row.idempotency_key);
    return true;
  });

  const keys = pending.flatMap(row => (row.idempotency_key ? [row.idempotency_key] : []));
  if (keys.length) {
    const { data, error } = await db.from("form_events").select("idempotency_key").in("idempotency_key", keys);
    if (error) return { saved: 0, error: error.message };
    const existing = new Set((data ?? []).map(item => (item as { idempotency_key: string }).idempotency_key));
    pending = pending.filter(row => !row.idempotency_key || !existing.has(row.idempotency_key));
  }
  if (!pending.length) return { saved: 0, error: null };

  const { error } = await db.from("form_events").insert(pending) as { error: DbError };
  if (!error) return { saved: pending.length, error: null };
  if (error.code !== "23505") return { saved: 0, error: error.message };

  // Outra requisição gravou parte do lote ao mesmo tempo: segue linha a linha.
  let saved = 0;
  for (const row of pending) {
    const { error: rowError } = await db.from("form_events").insert(row) as { error: DbError };
    if (!rowError) saved++;
    else if (rowError.code !== "23505") return { saved, error: rowError.message };
  }
  return { saved, error: null };
}
