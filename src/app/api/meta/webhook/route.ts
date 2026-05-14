export const dynamic    = 'force-dynamic';
export const maxDuration = 60; // keep function alive while async processing runs
// ── /api/meta/webhook ─────────────────────────────────────────────────────────
// GET  — Meta webhook verification (hub.challenge)
// POST — Receive leadgen events and save leads to CRM

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { fetchMetaLead } from "@/lib/meta-leads";
import { decryptToken } from "@/lib/crypto";

// ── Webhook verification ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const mode      = req.nextUrl.searchParams.get("hub.mode");
  const token     = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── Event receiver ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Validate X-Hub-Signature-256
  const appSecret = process.env.META_APP_SECRET;
  const sigHeader = req.headers.get("x-hub-signature-256");
  if (appSecret && sigHeader) {
    const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
    if (sigHeader !== expected) {
      console.warn("[webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: WebhookPayload;
  try {
    body = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log(`[webhook] POST received object=${body.object} entries=${body.entry?.length ?? 0}`);

  // Respond immediately (Meta requires < 20s); process async
  if (body.object === "page") {
    processEntries(body.entry).catch(err =>
      console.error("[webhook] Unhandled error in processEntries:", err)
    );
  }

  return NextResponse.json({ received: true });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface WebhookPayload {
  object: string;
  entry:  WebhookEntry[];
}
interface WebhookEntry {
  id:      string;
  changes: WebhookChange[];
}
interface WebhookChangeValue {
  leadgen_id:    string;
  page_id:       string;
  form_id?:      string;
  ad_id?:        string;
  created_time?: number;
}
interface WebhookChange {
  field: string;
  value: WebhookChangeValue;
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// ── Log helpers ───────────────────────────────────────────────────────────────

async function updateLog(
  supabase: AdminClient,
  logId: string | undefined,
  fields: Record<string, unknown>
) {
  if (!logId) return;
  await supabase.from("meta_webhook_logs").update(fields).eq("id", logId);
}

// ── Entry processor ───────────────────────────────────────────────────────────

async function processEntries(entries: WebhookEntry[]) {
  const supabase = createAdminSupabaseClient();

  for (const entry of entries) {
    for (const change of entry.changes) {
      if (change.field !== "leadgen") continue;

      const { page_id, leadgen_id, form_id, ad_id, created_time } = change.value;

      console.log(`[webhook] Processing leadgen=${leadgen_id} page=${page_id} form=${form_id ?? "—"} ad=${ad_id ?? "—"}`);

      // Resolve user_id early so the log is visible to the user even on failure.
      let earlyUserId: string | undefined;
      try {
        const { data: earlyPage } = await supabase
          .from("meta_page_subscriptions")
          .select("user_id")
          .or(`meta_page_id.eq.${page_id},page_id.eq.${page_id}`)
          .eq("is_active", true)
          .maybeSingle();
        earlyUserId = (earlyPage as { user_id?: string } | null)?.user_id;
      } catch { /* best-effort; missing user_id just means the log won't be visible */ }

      let logId: string | undefined;
      try {
        const { data: logRow } = await supabase
          .from("meta_webhook_logs")
          .insert({
            page_id,
            form_id:    form_id ?? null,
            leadgen_id,
            user_id:    earlyUserId ?? null,
            status:     "received",
            step:       "received",
            payload:    change.value,
          })
          .select("id")
          .single();
        logId = logRow?.id as string | undefined;
      } catch (logErr) {
        console.error("[webhook] Could not write initial log:", logErr);
      }

      try {
        await processLead({ supabase, page_id, leadgen_id, form_id, ad_id, created_time, logId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[webhook] leadgen=${leadgen_id} failed: ${msg}`);
        await updateLog(supabase, logId, {
          status:        "error",
          error_message: msg,
          processed_at:  new Date().toISOString(),
        });
      }
    }
  }
}

// ── Lead processor ────────────────────────────────────────────────────────────

async function processLead({
  supabase,
  page_id,
  leadgen_id,
  form_id,
  ad_id,
  created_time,
  logId,
}: {
  supabase:      AdminClient;
  page_id:       string;
  leadgen_id:    string;
  form_id?:      string;
  ad_id?:        string;
  created_time?: number;
  logId?:        string;
}) {
  // ── Step 1: Resolve page subscription ────────────────────────────────────

  await updateLog(supabase, logId, { step: "resolving_page" });
  console.log(`[webhook] step=resolving_page page=${page_id}`);

  let pageSub: {
    user_id:              string;
    platform_account_id:  string | null;
    encrypted_page_token: string | null;
  } | null = null;

  const { data: ps, error: psErr } = await supabase
    .from("meta_page_subscriptions")
    .select("user_id, platform_account_id, encrypted_page_token")
    .or(`meta_page_id.eq.${page_id},page_id.eq.${page_id}`)
    .eq("is_active", true)
    .maybeSingle();

  if (psErr) {
    console.warn(`[webhook] OR query failed (${psErr.message}), retrying meta_page_id only`);
    const { data: ps2 } = await supabase
      .from("meta_page_subscriptions")
      .select("user_id, platform_account_id, encrypted_page_token")
      .eq("meta_page_id", page_id)
      .eq("is_active", true)
      .maybeSingle();
    pageSub = ps2 as typeof pageSub;
  } else {
    pageSub = ps as typeof pageSub;
  }

  if (!pageSub) {
    throw new Error(
      `Página ${page_id} não encontrada em meta_page_subscriptions. ` +
      `Vá em Integrações → Meta Leads e clique em "Sincronizar".`
    );
  }

  const { user_id, platform_account_id, encrypted_page_token } = pageSub;
  await updateLog(supabase, logId, { user_id, step: "page_resolved" });
  console.log(`[webhook] step=page_resolved user=${user_id}`);

  // ── Step 2: Form-level filter ────────────────────────────────────────────
  // Only enforce if user has explicitly activated at least one form subscription.
  // When no forms are active, all leads from the page pass through.

  if (form_id) {
    await updateLog(supabase, logId, { step: "checking_form" });

    const { data: formSubs } = await supabase
      .from("meta_form_subscriptions")
      .select("form_id, is_active")
      .eq("user_id", user_id)
      .eq("page_id", page_id);

    const activeForms = new Set(
      ((formSubs ?? []) as { form_id: string; is_active: boolean }[])
        .filter(s => s.is_active)
        .map(s => s.form_id)
    );

    console.log(
      `[webhook] form check: total_subs=${formSubs?.length ?? 0} active=${activeForms.size} form=${form_id}`
    );

    // FIX: was `formSubs.length > 0` which triggered on any subscription, even all-inactive.
    // Now only skips if there are active subscriptions AND this form is not among them.
    if (activeForms.size > 0 && !activeForms.has(form_id)) {
      await updateLog(supabase, logId, {
        status:        "skipped",
        step:          "form_not_subscribed",
        error_message: `Formulário ${form_id} não está ativo. Ative-o em Integrações → Meta Leads.`,
        processed_at:  new Date().toISOString(),
      });
      console.log(`[webhook] form ${form_id} not in active set (${activeForms.size} active) — skipped`);
      return;
    }
  }

  // ── Step 3: Resolve access token ─────────────────────────────────────────

  await updateLog(supabase, logId, { step: "resolving_token" });
  console.log(`[webhook] step=resolving_token`);

  let accessToken: string;

  if (encrypted_page_token) {
    try {
      accessToken = decryptToken(encrypted_page_token);
    } catch (decryptErr) {
      throw new Error(
        `Falha ao descriptografar o page token. Re-sincronize as páginas. ` +
        `(${decryptErr instanceof Error ? decryptErr.message : String(decryptErr)})`
      );
    }
  } else if (platform_account_id) {
    const { data: tokenRow } = await supabase
      .from("meta_tokens")
      .select("encrypted_token")
      .eq("platform_account_id", platform_account_id)
      .maybeSingle();

    if (!tokenRow?.encrypted_token) {
      throw new Error(
        `Token não encontrado para platform_account_id=${platform_account_id}. ` +
        `Re-sincronize as páginas em Integrações → Meta Leads.`
      );
    }
    accessToken = decryptToken(tokenRow.encrypted_token as string);
  } else {
    throw new Error(
      `Sem token de acesso para a página ${page_id}. ` +
      `Clique em "Sincronizar" em Integrações → Meta Leads para armazenar o token.`
    );
  }

  // ── Step 4: Fetch lead from Graph API ────────────────────────────────────

  await updateLog(supabase, logId, { step: "fetching_lead" });
  console.log(`[webhook] step=fetching_lead leadgen=${leadgen_id}`);

  let leadData: Awaited<ReturnType<typeof fetchMetaLead>>;
  try {
    leadData = await fetchMetaLead(leadgen_id, accessToken);
  } catch (apiErr) {
    const apiMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
    // Detect synthetic test events from the Developer Panel (fake leadgen_id).
    const isTestEvent =
      apiMsg.includes("does not exist") ||
      apiMsg.includes("Unsupported get request") ||
      apiMsg.includes("Invalid parameter");
    if (isTestEvent) {
      await updateLog(supabase, logId, {
        status:        "error",
        step:          "test_event_detected",
        error_message: `Evento de teste do painel de desenvolvedores — leadgen_id=${leadgen_id} não existe na Graph API. Isso é esperado para testes de conectividade. Para testar o pipeline completo, clique em "Testar Lead" na aba Integrações.`,
        processed_at:  new Date().toISOString(),
      });
      console.log(`[webhook] Test event detected (fake leadgen_id=${leadgen_id}) — skipping`);
      return;
    }
    throw new Error(`Graph API falhou ao buscar leadgen_id=${leadgen_id}: ${apiMsg}`);
  }

  console.log(
    `[webhook] step=lead_fetched name="${leadData.full_name}" phone=${leadData.phone ?? "—"} email=${leadData.email ?? "—"}`
  );

  // ── Step 5: Deduplication (exact leadgen_id) ──────────────────────────────

  await updateLog(supabase, logId, { step: "dedup_check" });

  const { data: existingByLeadgen } = await supabase
    .from("leads")
    .select("id")
    .eq("leadgen_id", leadgen_id)
    .maybeSingle();

  if (existingByLeadgen) {
    await updateLog(supabase, logId, {
      status:       "duplicate",
      step:         "duplicate_leadgen",
      lead_id:      (existingByLeadgen as { id: string }).id,
      processed_at: new Date().toISOString(),
    });
    console.log(`[webhook] duplicate leadgen_id=${leadgen_id} — skipped`);
    return;
  }

  // ── Step 6: Soft-duplicate check (phone/email) ────────────────────────────

  let is_duplicate = false;
  const orParts: string[] = [];
  if (leadData.phone) orParts.push(`contact.eq.${leadData.phone}`);
  if (leadData.email) orParts.push(`email.eq.${leadData.email}`);

  if (orParts.length > 0) {
    const { data: dupe } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", user_id)
      .or(orParts.join(","))
      .maybeSingle();
    if (dupe) is_duplicate = true;
  }

  // ── Step 7: Resolve form name ─────────────────────────────────────────────

  let form_name: string | null = null;
  if (form_id) {
    const { data: formSub } = await supabase
      .from("meta_form_subscriptions")
      .select("form_name")
      .eq("user_id", user_id)
      .eq("form_id", form_id)
      .maybeSingle();
    form_name = (formSub as { form_name?: string } | null)?.form_name ?? null;
  }

  // ── Step 8: Build notes ───────────────────────────────────────────────────

  const sections: string[] = [];

  if (leadData.custom_fields.length > 0) {
    const lines = ["Respostas do Formulário", "─────────────────────────"];
    for (const { label, value } of leadData.custom_fields) lines.push(`${label}: ${value}`);
    sections.push(lines.join("\n"));
  }

  const origin = ["Origem do Lead", "─────────────────────────"];
  if (leadData.city)          origin.push(`Cidade: ${leadData.city}`);
  if (form_name)              origin.push(`Formulário: ${form_name}`);
  if (leadData.campaign_name) origin.push(`Campanha: ${leadData.campaign_name}`);
  if (leadData.ad_name)       origin.push(`Anúncio: ${leadData.ad_name}`);
  if (origin.length > 2)      sections.push(origin.join("\n"));

  const notes = sections.length > 0 ? sections.join("\n\n") : null;

  // ── Step 9: Insert lead → Novo Lead ──────────────────────────────────────

  await updateLog(supabase, logId, { step: "inserting_lead" });
  console.log(`[webhook] step=inserting_lead user=${user_id}`);

  // Use the lead creation timestamp from the webhook if available
  const enteredAt = created_time
    ? new Date(created_time * 1000).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const { data: newLead, error: insertErr } = await supabase
    .from("leads")
    .insert({
      user_id,
      name:          leadData.full_name || leadData.first_name || "Lead Meta",
      contact:       leadData.phone || leadData.email || "",
      email:         leadData.email  ?? null,
      source:        "meta_lead_ads",
      page_id,
      leadgen_id,
      form_id:       form_id   ?? null,
      form_name:     form_name ?? null,
      campaign_name: leadData.campaign_name ?? null,
      ad_name:       leadData.ad_name       ?? null,
      kanban_column: "novo_lead",
      tags:          [],
      notes,
      deal_value:    0,
      entered_at:    enteredAt,
      is_duplicate,
    })
    .select("id")
    .single();

  if (insertErr) {
    throw new Error(`Falha ao inserir lead no CRM: ${insertErr.message}`);
  }

  // ── Step 10: Finalize log ─────────────────────────────────────────────────

  await updateLog(supabase, logId, {
    status:       "processed",
    step:         "done",
    lead_id:      (newLead as { id: string }).id,
    processed_at: new Date().toISOString(),
  });

  // ── Step 11: Update form subscription stats ───────────────────────────────

  if (form_id) {
    const { data: fs } = await supabase
      .from("meta_form_subscriptions")
      .select("leads_count")
      .eq("user_id", user_id)
      .eq("form_id", form_id)
      .maybeSingle();

    if (fs) {
      await supabase
        .from("meta_form_subscriptions")
        .update({
          leads_count:  ((fs as { leads_count: number }).leads_count ?? 0) + 1,
          last_lead_at: new Date().toISOString(),
        })
        .eq("user_id", user_id)
        .eq("form_id", form_id);
    }
  }

  console.log(
    `[webhook] ✓ Lead "${leadData.full_name}" saved — column=novo_lead leadgen=${leadgen_id} form=${form_id ?? "—"} duplicate=${is_duplicate}`
  );
}
