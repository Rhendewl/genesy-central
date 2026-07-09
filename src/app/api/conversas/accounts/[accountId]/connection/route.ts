import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppProvider } from "@/lib/conversations/providers";
import type { WhatsAppConnectionStatus } from "@/lib/conversations/providers/types";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { ConversationWhatsAppAccount } from "@/types/conversations";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

type AccountRow = {
  id: string;
  provider: "qr_code" | "cloud_api";
};

async function loadAccount(accountId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }

  const { data: account, error } = await supabase
    .from("conversation_whatsapp_accounts")
    .select("id,provider")
    .eq("id", accountId)
    .maybeSingle<AccountRow>();

  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  }

  if (!account) {
    return { error: NextResponse.json({ error: "Conta WhatsApp não encontrada ou sem permissão." }, { status: 404 }) };
  }

  return { account };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForQrPayload(account: AccountRow, initialStatus: WhatsAppConnectionStatus) {
  if (initialStatus.qrCodePayload || initialStatus.status === "connected" || initialStatus.status === "error") {
    return initialStatus;
  }

  const provider = getWhatsAppProvider(account.provider);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await wait(1000);
    const nextStatus = await provider.getConnectionStatus(account.id);
    if (nextStatus.qrCodePayload || nextStatus.status === "awaiting_qr" || nextStatus.status === "connected" || nextStatus.status === "error") {
      return nextStatus;
    }
  }

  return initialStatus;
}

async function persistStatus(account: AccountRow, mode: "connect" | "status" | "disconnect") {
  const provider = getWhatsAppProvider(account.provider);
  const initialStatus = mode === "connect"
    ? await provider.startConnection(account.id)
    : mode === "disconnect"
      ? await provider.disconnect(account.id)
      : await provider.getConnectionStatus(account.id);
  const status = mode === "connect"
    ? await waitForQrPayload(account, initialStatus)
    : initialStatus;

  const admin = createAdminSupabaseClient();
  const update: Partial<ConversationWhatsAppAccount> = {
    status: status.status,
    qr_code_payload: mode === "disconnect" ? null : status.qrCodePayload ?? null,
    last_error: status.error ?? null,
    last_sync_at: new Date().toISOString(),
  };

  if (status.phone !== undefined) update.phone = status.phone;
  if (status.displayName !== undefined) update.display_name = status.displayName;
  if (status.status === "connected") {
    update.last_connected_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from("conversation_whatsapp_accounts")
    .update(update)
    .eq("id", account.id)
    .select("*")
    .single<ConversationWhatsAppAccount>();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Erro ao atualizar conta WhatsApp." }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { accountId } = await context.params;
  const result = await loadAccount(accountId);
  if (result.error) return result.error;
  return persistStatus(result.account, "status");
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const { accountId } = await context.params;
  const result = await loadAccount(accountId);
  if (result.error) return result.error;
  return persistStatus(result.account, "connect");
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { accountId } = await context.params;
  const result = await loadAccount(accountId);
  if (result.error) return result.error;
  return persistStatus(result.account, "disconnect");
}
