import type { SupabaseClient } from "@supabase/supabase-js";
import { processMetaLeadEvent } from "@/lib/meta-lead-capture";

// Reprocessamento agendado de leads da Meta que não foram capturados na hora
// (ex.: formulário com a captura desligada). Cada item passa pelo mesmo fluxo
// do webhook — busca o lead na Meta, aplica a fila/roleta ou o destino do
// formulário e publica lead.stage.entered (notificações e automações).
// A hora de chegada no CRM é a hora em que o item é processado.

export interface MetaLeadReplayRow {
  id: string;
  user_id: string;
  page_id: string;
  form_id: string;
  leadgen_id: string;
}

export interface ReplayRunResult { processed: number; done: number; failed: number }

export async function runDueMetaLeadReplays(db: SupabaseClient, limit = 5, now = new Date()): Promise<ReplayRunResult> {
  const { data: due, error } = await db.from("meta_lead_replays")
    .select("id,user_id,page_id,form_id,leadgen_id")
    .eq("status", "pending")
    .lte("run_at", now.toISOString())
    .order("run_at")
    .limit(limit);
  if (error) throw new Error(error.message);

  const result: ReplayRunResult = { processed: 0, done: 0, failed: 0 };
  for (const row of (due ?? []) as MetaLeadReplayRow[]) {
    // Claim atômico: só um worker processa cada item.
    const { data: claimed, error: claimError } = await db.from("meta_lead_replays")
      .update({ status: "processing", attempts_at: new Date().toISOString() })
      .eq("id", row.id).eq("status", "pending")
      .select("id").maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimed) continue;
    result.processed += 1;
    try {
      const outcome = await processMetaLeadEvent(db, {
        page_id: row.page_id, form_id: row.form_id, leadgen_id: row.leadgen_id,
      }, row.user_id, { receivedAt: new Date().toISOString() });
      await db.from("meta_lead_replays").update({
        status: "done", result: outcome, lead_id: (outcome as { lead_id?: string }).lead_id ?? null,
        error: null, processed_at: new Date().toISOString(),
      }).eq("id", row.id);
      result.done += 1;
    } catch (failure) {
      await db.from("meta_lead_replays").update({
        status: "error", error: failure instanceof Error ? failure.message.slice(0, 1000) : "Falha ao reprocessar",
        processed_at: new Date().toISOString(),
      }).eq("id", row.id);
      result.failed += 1;
    }
  }
  return result;
}
