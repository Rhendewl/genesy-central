export const dynamic = "force-dynamic";

// ── GET /api/leads ─────────────────────────────────────────────────────────────
// Health-check — no auth required.

// ── POST /api/leads ────────────────────────────────────────────────────────────
// Webhook for Make.com, Zapier, etc.
// Auth: X-Api-Key header → webhook_integrations table.
// user_id is always taken from the integration record, never from the payload.
//
// Notes are built from two sections separated by a blank line:
//   Section 1 — metadata:  Origem, Campanha, Formulário, Mensagem, UTMs
//   Section 2 — custom:    every other key not in STANDARD_FIELDS, formatted as
//                           "Label: value" (snake_case keys humanised automatically)
//
// Accepted payload examples:
//   { nome, telefone, email }
//   { nome, telefone, origem, campanha, formulario }
//   { nome, telefone, qual_imovel_procura: "Cobertura", faixa_de_renda: "20k+" }
//   { name, phone, email, campaign_name, form_name, utm_source }
//   { nome, telefone, respostas: ["Sim", "Não"] }   ← arrays joined with ", "

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Supabase admin (service_role — bypasses RLS) ──────────────────────────────

function makeAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${key}` } },
  });
}

// ── Payload normalisation ─────────────────────────────────────────────────────

// Fields extracted into dedicated columns — everything else goes to notes.
const STANDARD_FIELDS = new Set([
  "nome", "name",
  "telefone", "phone",
  "email",
  "origem", "source",
  "campanha", "campaign_name", "campaign",
  "formulario", "form_name", "form",
  "mensagem", "notes", "message",
  "utm_source", "utm_medium", "utm_campaign",
]);

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  return null;
}

// Converts any scalar/array value to a printable string, or null if empty.
function fmtValue(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (Array.isArray(v)) {
    const parts = v
      .map(item => (item !== null && item !== undefined ? String(item).trim() : ""))
      .filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }
  const s = String(v).trim();
  return s || null;
}

// "qual_imovel_procura" → "Qual Imovel Procura"
function humanise(key: string): string {
  return key
    .replace(/[_\-]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Builds the structured notes string from the full payload.
function buildNotes(
  body:         Record<string, unknown>,
  origin:       string | null,
  campaignName: string | null,
  formName:     string | null,
  message:      string | null,
  utmSource:    string | null,
  utmMedium:    string | null,
  utmCampaign:  string | null,
): string | null {
  // Section 1 — metadata
  const meta: string[] = [];
  if (origin)       meta.push(`Origem: ${origin}`);
  if (campaignName) meta.push(`Campanha: ${campaignName}`);
  if (formName)     meta.push(`Formulário: ${formName}`);
  if (message)      meta.push(`Mensagem: ${message}`);

  const utms = [
    utmSource   && `utm_source=${utmSource}`,
    utmMedium   && `utm_medium=${utmMedium}`,
    utmCampaign && `utm_campaign=${utmCampaign}`,
  ].filter(Boolean) as string[];
  if (utms.length)  meta.push(`UTMs: ${utms.join(", ")}`);

  // Section 2 — custom questions (every field not in STANDARD_FIELDS)
  const custom: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (STANDARD_FIELDS.has(key)) continue;
    const formatted = fmtValue(value);
    if (!formatted) continue;
    custom.push(`${humanise(key)}: ${formatted}`);
  }

  const sections: string[] = [];
  if (meta.length)   sections.push(meta.join("\n"));
  if (custom.length) sections.push(custom.join("\n"));

  return sections.length ? sections.join("\n\n") : null;
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ status: "online", message: "Webhook endpoint online" });
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let admin: ReturnType<typeof makeAdmin>;
  try {
    admin = makeAdmin();
  } catch {
    console.error("[api/leads] Missing env vars");
    return NextResponse.json({ success: false, error: "server_misconfigured" }, { status: 500 });
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("X-Api-Key");
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "missing_api_key" }, { status: 401 });
  }

  const { data: integration, error: intErr } = await admin
    .from("webhook_integrations")
    .select("id, user_id, is_active")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (intErr) {
    console.error("[api/leads] integration lookup:", intErr.message);
    return NextResponse.json({ success: false, error: "db_error", detail: intErr.message }, { status: 500 });
  }

  if (!integration || !integration.is_active) {
    console.warn(`[api/leads] invalid key: ${apiKey.slice(0, 12)}…`);
    return NextResponse.json({ success: false, error: "invalid_api_key" }, { status: 401 });
  }

  const integrationId = integration.id as string;
  const userId        = integration.user_id as string | null;

  if (!userId) {
    console.error("[api/leads] user_id null on integration:", integrationId);
    return NextResponse.json({ success: false, error: "internal_error" }, { status: 500 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  console.log(`[api/leads] user=${userId} keys=[${Object.keys(body).join(",")}]`);

  // ── Extract standard fields ─────────────────────────────────────────────────
  const name         = str(body.nome)       ?? str(body.name)                                   ?? null;
  const phone        = str(body.telefone)   ?? str(body.phone)                                  ?? null;
  const email        = str(body.email)                                                           ?? null;
  const origin       = str(body.origem)     ?? str(body.source)                                 ?? null;
  const campaignName = str(body.campanha)   ?? str(body.campaign_name) ?? str(body.campaign)    ?? null;
  const formName     = str(body.formulario) ?? str(body.form_name)     ?? str(body.form)        ?? null;
  const message      = str(body.mensagem)   ?? str(body.notes)         ?? str(body.message)     ?? null;
  const utmSource    = str(body.utm_source)    ?? null;
  const utmMedium    = str(body.utm_medium)    ?? null;
  const utmCampaign  = str(body.utm_campaign)  ?? null;

  // ── Validate ────────────────────────────────────────────────────────────────
  if (!name) {
    return NextResponse.json({ success: false, error: "name_required" }, { status: 422 });
  }
  if (!phone && !email) {
    return NextResponse.json({ success: false, error: "phone_or_email_required" }, { status: 422 });
  }

  // ── Build notes (metadata + custom questions) ───────────────────────────────
  const notes = buildNotes(
    body, origin, campaignName, formName, message,
    utmSource, utmMedium, utmCampaign,
  );

  // ── Deduplication ───────────────────────────────────────────────────────────
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
      console.log(`[api/leads] duplicate phone=${phone} email=${email}`);
    }
  }

  // ── Insert ──────────────────────────────────────────────────────────────────
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
    console.error("[api/leads] insert:", insertErr.code, insertErr.message);
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

  console.log(`[api/leads] ✓ "${name}" id=${leadId} dup=${is_duplicate} notes_len=${notes?.length ?? 0}`);
  return NextResponse.json({ success: true });
}
