import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import type { ConversationWhatsAppAccount } from "@/types/conversations";

const allowedStatuses: ConversationWhatsAppAccount["status"][] = [
  "connected",
  "awaiting_qr",
  "connecting",
  "disconnected",
  "error",
  "expired",
  "reconnect",
];

function isAuthorized(request: NextRequest) {
  const configured = process.env.CONVERSATIONS_WORKER_SECRET || process.env.CRON_SECRET;
  if (!configured) return false;
  return request.headers.get("x-conversations-secret") === configured;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const accountId = typeof body?.whatsapp_account_id === "string" ? body.whatsapp_account_id : "";
  const status = typeof body?.status === "string"
    ? body.status as ConversationWhatsAppAccount["status"]
    : null;

  if (!accountId || !status || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "whatsapp_account_id e status válido são obrigatórios." }, { status: 400 });
  }

  const update: Partial<ConversationWhatsAppAccount> = {
    status,
    qr_code_payload: status === "awaiting_qr" ? nullableString(body?.qr_code_payload) : null,
    phone: nullableString(body?.phone),
    display_name: nullableString(body?.display_name),
    last_error: nullableString(body?.error),
    last_sync_at: new Date().toISOString(),
  };

  if (status === "connected") {
    update.last_connected_at = new Date().toISOString();
  }

  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("conversation_whatsapp_accounts")
    .update(update)
    .eq("id", accountId)
    .select("*")
    .maybeSingle<ConversationWhatsAppAccount>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Conta WhatsApp não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, account: data });
}
