export const dynamic = "force-dynamic";

// ── GET /api/leads ─────────────────────────────────────────────────────────────
// Health-check / debug endpoint — no auth required.

// ── POST /api/leads ────────────────────────────────────────────────────────────
// Webhook endpoint for receiving leads from Make.com, Zapier, etc.
// Auth: X-Api-Key header → looked up in webhook_integrations table.
// The user_id is taken from the integration record, never from the request.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Always builds a fresh service-role client so the JWT role is "service_role",
// which bypasses RLS in Supabase (BYPASSRLS privilege on the role).
function makeAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        // Explicitly set the role header so Supabase uses service_role
        // and bypasses every RLS policy on every table.
        Authorization: `Bearer ${key}`,
      },
    },
  });
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ status: "online", message: "Webhook endpoint online" });
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Build service-role admin client ─────────────────────────────────────────
  let admin: ReturnType<typeof makeAdmin>;
  try {
    admin = makeAdmin();
  } catch {
    console.error("[api/leads] Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL");
    return NextResponse.json({ success: false, error: "server_misconfigured" }, { status: 500 });
  }

  // ── Authenticate via API Key ─────────────────────────────────────────────────
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("X-Api-Key");
  if (!apiKey) {
    console.warn("[api/leads] Missing X-Api-Key header");
    return NextResponse.json({ success: false, error: "missing_api_key" }, { status: 401 });
  }

  const { data: integration, error: intErr } = await admin
    .from("webhook_integrations")
    .select("id, user_id, is_active")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (intErr) {
    // Table might not exist yet or env var is wrong key — surface clearly
    console.error("[api/leads] webhook_integrations query error:", intErr.message, intErr.code);
    return NextResponse.json(
      { success: false, error: "db_error", detail: intErr.message },
      { status: 500 },
    );
  }

  if (!integration || !integration.is_active) {
    console.warn(`[api/leads] API key not found or inactive: ${apiKey.slice(0, 12)}…`);
    return NextResponse.json({ success: false, error: "invalid_api_key" }, { status: 401 });
  }

  // These are the owner's identifiers — never supplied by the external caller.
  const integrationId = integration.id as string;
  const userId        = integration.user_id as string | null;

  if (!userId) {
    // Should be impossible (NOT NULL constraint), but guard anyway
    console.error("[api/leads] integration.user_id is null for integration:", integrationId);
    return NextResponse.json({ success: false, error: "internal_error" }, { status: 500 });
  }

  console.log(`[api/leads] authenticated — integration=${integrationId} user=${userId}`);

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  console.log(`[api/leads] payload keys=[${Object.keys(body).join(",")}]`);

  // ── Map payload — Portuguese + English field names ──────────────────────────
  const name         = str(body.nome)       || str(body.name)          || null;
  const phone        = str(body.telefone)   || str(body.phone)         || null;
  const email        = str(body.email)      || null;
  const origin       = str(body.origem)     || str(body.source)        || null;
  const campaignName = str(body.campanha)   || str(body.campaign_name) || str(body.campaign) || null;
  const formName     = str(body.formulario) || str(body.form_name)     || str(body.form)     || null;
  const message      = str(body.mensagem)   || str(body.notes)         || str(body.message)  || null;
  const utmSource    = str(body.utm_source)   || null;
  const utmMedium    = str(body.utm_medium)   || null;
  const utmCampaign  = str(body.utm_campaign) || null;

  // ── Validate required fields ────────────────────────────────────────────────
  if (!name) {
    return NextResponse.json({ success: false, error: "name_required" }, { status: 422 });
  }
  if (!phone && !email) {
    return NextResponse.json({ success: false, error: "phone_or_email_required" }, { status: 422 });
  }

  // ── Build notes ─────────────────────────────────────────────────────────────
  const noteLines: string[] = [];
  if (origin)  noteLines.push(`Origem: ${origin}`);
  if (message) noteLines.push(`Mensagem: ${message}`);
  const utms = [
    utmSource   && `utm_source=${utmSource}`,
    utmMedium   && `utm_medium=${utmMedium}`,
    utmCampaign && `utm_campaign=${utmCampaign}`,
  ].filter(Boolean);
  if (utms.length) noteLines.push(`UTMs: ${utms.join(", ")}`);
  const notes = noteLines.length ? noteLines.join("\n") : null;

  // ── Deduplication — soft check by phone or email ────────────────────────────
  let is_duplicate = false;
  const orParts: string[] = [];
  if (phone) orParts.push(`contact.eq.${phone}`);
  if (email) orParts.push(`email.eq.${email}`);

  if (orParts.length) {
    const { data: dupe } = await admin
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .or(orParts.join(","))
      .maybeSingle();
    if (dupe) {
      is_duplicate = true;
      console.log(`[api/leads] duplicate detected phone=${phone} email=${email}`);
    }
  }

  // ── Insert lead ─────────────────────────────────────────────────────────────
  // user_id is always the integration owner — never from request body.
  const { data: lead, error: insertErr } = await admin
    .from("leads")
    .insert({
      user_id:       userId,
      name,
      contact:       phone ?? email ?? "",
      email:         email ?? null,
      source:        "external_webhook",
      campaign_name: campaignName ?? null,
      form_name:     formName     ?? null,
      notes,
      kanban_column: "novo_lead",
      tags:          [],
      deal_value:    0,
      entered_at:    new Date().toISOString().split("T")[0],
      is_duplicate,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[api/leads] insert error:", insertErr.code, insertErr.message, "user_id:", userId);
    // Log to webhook_logs even on insert failure
    await admin.from("webhook_logs").insert({
      integration_id: integrationId,
      user_id:        userId,
      payload:        body,
      status:         "error",
      lead_id:        null,
      error_message:  insertErr.message,
    });
    return NextResponse.json(
      { success: false, error: "insert_failed", detail: insertErr.message },
      { status: 500 },
    );
  }

  const leadId = (lead as { id: string }).id;

  // ── Write log + increment counter ────────────────────────────────────────────
  await Promise.all([
    admin.from("webhook_logs").insert({
      integration_id: integrationId,
      user_id:        userId,
      payload:        body,
      status:         is_duplicate ? "duplicate" : "processed",
      lead_id:        leadId,
      error_message:  null,
    }),
    admin.rpc("increment_webhook_leads_count", { p_integration_id: integrationId }),
  ]);

  console.log(`[api/leads] ✓ saved lead="${name}" id=${leadId} user=${userId} dup=${is_duplicate}`);
  return NextResponse.json({ success: true });
}
