export const dynamic = "force-dynamic";

// ── POST /api/leads ────────────────────────────────────────────────────────────
// Generic webhook endpoint for receiving leads from external systems (Make, Zapier, etc.)
// Authentication: X-Api-Key header containing the integration's api_key.
// Accepts both English and Portuguese field names for Make.com compatibility.

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function writeLog(
  admin: AdminClient,
  integrationId: string,
  userId: string,
  payload: Record<string, unknown> | null,
  status: "processed" | "duplicate" | "error" | "invalid_key",
  leadId: string | null,
  errorMessage: string | null,
) {
  await admin.from("webhook_logs").insert({
    integration_id: integrationId,
    user_id:        userId,
    payload,
    status,
    lead_id:        leadId,
    error_message:  errorMessage,
  });
}

export async function POST(req: NextRequest) {
  const admin = createAdminSupabaseClient();

  // ── Auth ────────────────────────────────────────────────────────────────────
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("X-Api-Key");
  if (!apiKey) {
    console.warn("[api/leads] Missing X-Api-Key header");
    return NextResponse.json({ success: false, error: "invalid_api_key" }, { status: 401 });
  }

  const { data: integration } = await admin
    .from("webhook_integrations")
    .select("id, user_id, is_active")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (!integration || !integration.is_active) {
    console.warn(`[api/leads] Invalid api_key: ${apiKey.slice(0, 10)}…`);
    return NextResponse.json({ success: false, error: "invalid_api_key" }, { status: 401 });
  }

  const integrationId = integration.id as string;
  const userId        = integration.user_id as string;

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    await writeLog(admin, integrationId, userId, null, "error", null, "Invalid JSON body");
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  console.log(`[api/leads] received payload keys=[${Object.keys(body).join(",")}] user=${userId}`);

  // ── Map payload (Portuguese + English field names) ──────────────────────────
  const name         = str(body.nome)       || str(body.name)          || null;
  const phone        = str(body.telefone)   || str(body.phone)         || null;
  const email        = str(body.email)      || null;
  const origin       = str(body.origem)     || str(body.source)        || null;
  const campaignName = str(body.campanha)   || str(body.campaign_name) || str(body.campaign) || null;
  const formName     = str(body.formulario) || str(body.form_name)     || str(body.form)     || null;
  const message      = str(body.mensagem)   || str(body.notes)         || str(body.message)  || null;
  const utmSource    = str(body.utm_source)    || null;
  const utmMedium    = str(body.utm_medium)    || null;
  const utmCampaign  = str(body.utm_campaign)  || null;

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!name) {
    await writeLog(admin, integrationId, userId, body, "error", null, "Campo 'nome' ou 'name' é obrigatório");
    return NextResponse.json({ success: false, error: "name_required" }, { status: 422 });
  }

  if (!phone && !email) {
    await writeLog(admin, integrationId, userId, body, "error", null, "Telefone ou e-mail é obrigatório");
    return NextResponse.json({ success: false, error: "phone_or_email_required" }, { status: 422 });
  }

  // ── Build notes ─────────────────────────────────────────────────────────────
  const noteLines: string[] = [];
  if (origin)      noteLines.push(`Origem: ${origin}`);
  if (message)     noteLines.push(`Mensagem: ${message}`);

  const utms = [
    utmSource   && `utm_source=${utmSource}`,
    utmMedium   && `utm_medium=${utmMedium}`,
    utmCampaign && `utm_campaign=${utmCampaign}`,
  ].filter(Boolean);
  if (utms.length > 0) noteLines.push(`UTMs: ${utms.join(", ")}`);

  const notes = noteLines.length > 0 ? noteLines.join("\n") : null;

  // ── Deduplication ───────────────────────────────────────────────────────────
  let is_duplicate = false;
  const orParts: string[] = [];
  if (phone) orParts.push(`contact.eq.${phone}`);
  if (email) orParts.push(`email.eq.${email}`);

  if (orParts.length > 0) {
    const { data: dupe } = await admin
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .or(orParts.join(","))
      .maybeSingle();
    if (dupe) {
      is_duplicate = true;
      console.log(`[api/leads] soft-duplicate detected for user=${userId} phone=${phone} email=${email}`);
    }
  }

  // ── Insert lead ─────────────────────────────────────────────────────────────
  const { data: lead, error: insertErr } = await admin
    .from("leads")
    .insert({
      user_id:       userId,
      name,
      contact:       phone || email || "",
      email:         email         || null,
      source:        "external_webhook",
      campaign_name: campaignName  || null,
      form_name:     formName      || null,
      notes,
      kanban_column: "novo_lead",
      tags:          [],
      deal_value:    0,
      entered_at:    new Date().toISOString().split("T")[0],
      is_duplicate,
    })
    .select("id, name")
    .single();

  if (insertErr) {
    console.error("[api/leads] insert error:", insertErr.message);
    await writeLog(admin, integrationId, userId, body, "error", null, insertErr.message);
    return NextResponse.json({ success: false, error: "internal_error" }, { status: 500 });
  }

  // ── Log + update stats ──────────────────────────────────────────────────────
  const leadId = (lead as { id: string }).id;
  await writeLog(
    admin, integrationId, userId, body,
    is_duplicate ? "duplicate" : "processed",
    leadId, null,
  );

  // Atomic counter increment via RPC (avoids race condition)
  await admin.rpc("increment_webhook_leads_count", { p_integration_id: integrationId });

  console.log(
    `[api/leads] ✓ Lead "${name}" saved — ` +
    `user=${userId} duplicate=${is_duplicate} campaign="${campaignName ?? "—"}"`,
  );

  return NextResponse.json({ success: true });
}
