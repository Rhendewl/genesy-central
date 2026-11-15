import { NextRequest, NextResponse } from "next/server";
import {
  CIError,
  context,
  fail,
  graph,
} from "@/lib/conversation-intelligence/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
function settings() {
  const wabaId = process.env.WHATSAPP_REVIEW_WABA_ID?.trim() ?? "";
  const phoneId = process.env.WHATSAPP_REVIEW_PHONE_NUMBER_ID?.trim() ?? "";
  const recipient = process.env.WHATSAPP_REVIEW_RECIPIENT?.trim() ?? "";
  const ready =
    /^\d+$/.test(wabaId) &&
    /^\d+$/.test(phoneId) &&
    /^\d{8,15}$/.test(recipient);
  return { wabaId, phoneId, recipient, ready };
}
async function owner(req: NextRequest) {
  const actor = await context(req);
  if (actor.user.id !== actor.tenant || actor.role !== "admin")
    throw new CIError(
      "Demonstração disponível apenas para o administrador proprietário.",
      403,
    );
  return actor;
}
export async function GET(req: NextRequest) {
  try {
    await owner(req);
    const config = settings();
    return NextResponse.json(
      {
        configured: config.ready,
        recipientLabel: config.ready
          ? `WhatsApp confirmado ••••${config.recipient.slice(-4)}`
          : null,
      },
      { headers: noStore },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    await owner(req);
    const config = settings();
    if (!config.ready)
      throw new CIError(
        "O administrador precisa configurar o número de teste e o destinatário na Vercel.",
        503,
      );
    if (Number(req.headers.get("content-length")) > 10000)
      throw new CIError("Solicitação muito grande.", 413);
    const reader = req.body?.getReader();
    if (!reader) throw new CIError("Solicitação inválida.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 10000) {
        await reader.cancel();
        throw new CIError("Solicitação muito grande.", 413);
      }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new CIError("Solicitação inválida.");
    }
    if (
      !body ||
      !["inspect", "send"].includes(body.action) ||
      typeof body.token !== "string" ||
      body.token.length < 20 ||
      body.token.length > 4096
    )
      throw new CIError("Informe o token temporário e uma ação válida.");
    // Browser cannot select a different account, sender, recipient, template or content.
    if (Object.keys(body).some((key) => !["action", "token"].includes(key)))
      throw new CIError(
        "A demonstração não permite alterar o destinatário ou a mensagem.",
      );
    const appId = process.env.META_APP_ID?.trim();
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret)
      throw new CIError("Aplicativo Meta não configurado.", 503);
    const token = body.token.trim();
    if (token.length < 20)
      throw new CIError("Informe um token temporário válido.");
    const debug = await graph(
      `debug_token?input_token=${encodeURIComponent(token)}`,
      `${appId}|${appSecret}`,
    );
    if (
      !debug.data?.is_valid ||
      String(debug.data.app_id) !== appId ||
      !["whatsapp_business_management", "whatsapp_business_messaging"].every(
        (scope) => debug.data.scopes?.includes(scope),
      )
    )
      throw new CIError(
        "Token inválido para este aplicativo ou sem as duas permissões do WhatsApp.",
        403,
      );
    // Prove that this token can actually access the preconfigured WABA and sender.
    let phone:
      | { id: string; display_phone_number?: string; verified_name?: string }
      | undefined;
    let path = `${config.wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100`;
    for (let page = 0; page < 10; page++) {
      const result = await graph(path, token);
      phone = result.data?.find(
        (item: { id: string }) => item.id === config.phoneId,
      );
      if (phone) break;
      const cursor = result.paging?.cursors?.after;
      if (!result.paging?.next || typeof cursor !== "string") break;
      path = `${config.wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100&after=${encodeURIComponent(cursor)}`;
    }
    if (!phone)
      throw new CIError(
        "O token não dá acesso ao número de teste configurado.",
        403,
      );
    // This console is for Meta's generated test number, not a production SDR number.
    if (
      phone.verified_name !== "Test Number" ||
      !phone.display_phone_number?.replace(/\D/g, "").startsWith("1555")
    )
      throw new CIError(
        "Esta demonstração aceita apenas o número de teste identificado pela Meta como Test Number.",
        409,
      );
    if (body.action === "inspect")
      return NextResponse.json(
        {
          accountId: config.wabaId,
          phone: {
            id: phone.id,
            name: phone.verified_name,
            displayNumber: phone.display_phone_number,
          },
          inspectedAt: new Date().toISOString(),
        },
        { headers: noStore },
      );
    const response = await graph(`${config.phoneId}/messages`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: config.recipient,
        type: "template",
        template: { name: "hello_world", language: { code: "en_US" } },
      }),
    });
    const messageId = response.messages?.[0]?.id;
    if (typeof messageId !== "string" || !messageId.startsWith("wamid."))
      throw new CIError(
        "A Meta não confirmou a aceitação da mensagem. Confira seu WhatsApp antes de repetir o envio.",
        502,
      );
    // No token, message body or recipient phone is persisted or returned.
    return NextResponse.json(
      {
        accepted: true,
        messageId,
        acceptedAt: new Date().toISOString(),
        recipientLabel: `WhatsApp confirmado ••••${config.recipient.slice(-4)}`,
      },
      { headers: noStore },
    );
  } catch (error) {
    return fail(error);
  }
}
