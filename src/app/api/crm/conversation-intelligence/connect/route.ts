import { NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@/lib/crypto";
import {
  check,
  CIError,
  configuration,
  context,
  fail,
  graph,
  uuid,
} from "@/lib/conversation-intelligence/server";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const { db, user, tenant } = await context(req);
    const body = await req.json();
    if (!configuration().ready)
      throw new CIError("Conexão aguardando configuração da Meta", 503);
    if (body.action === "start") {
      const { data, error } = await db
        .from("ci_signup_sessions")
        .insert({ sdr_id: user.id, tenant_id: tenant })
        .select("id")
        .single();
      check(error);
      return NextResponse.json({
        session: data!.id,
        appId: process.env.META_APP_ID,
        configId: process.env.WHATSAPP_SIGNUP_CONFIG_ID,
        version: process.env.WHATSAPP_GRAPH_VERSION,
      });
    }
    if (
      body.action !== "finish" ||
      !uuid(body.session) ||
      typeof body.code !== "string" ||
      body.code.length > 4096 ||
      !/^\d+$/.test(body.phoneId) ||
      !/^\d+$/.test(body.wabaId)
    )
      throw new CIError("Dados de conexão inválidos");
    // Consume the session atomically. Replaying code/session cannot bind another SDR.
    const session = await db
      .from("ci_signup_sessions")
      .delete()
      .eq("id", body.session)
      .eq("sdr_id", user.id)
      .eq("tenant_id", tenant)
      .gt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
    check(session.error);
    if (!session.data)
      throw new CIError("Conexão expirada. Inicie novamente.", 409);
    const existing = await db
      .from("ci_connections")
      .select("id")
      .eq("tenant_id", tenant)
      .eq("sdr_id", user.id)
      .maybeSingle();
    check(existing.error);
    if (existing.data)
      throw new CIError(
        "Desconecte a conexão atual antes de vincular outro número.",
        409,
      );
    const tokenResult = await graph("oauth/access_token", "", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        code: body.code,
      }),
    });
    if (typeof tokenResult.access_token !== "string")
      throw new CIError("A Meta não forneceu autorização", 502);
    const token = tokenResult.access_token as string;
    const debug = await graph(
      `debug_token?input_token=${encodeURIComponent(token)}`,
      `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`,
    );
    if (
      !debug.data?.is_valid ||
      debug.data.app_id !== process.env.META_APP_ID ||
      !["whatsapp_business_management", "whatsapp_business_messaging"].every(
        (scope) => debug.data.scopes?.includes(scope),
      )
    )
      throw new CIError("Permissões WhatsApp incompletas", 403);
    // Verify the selected number actually belongs to the authorized WABA, not to client-supplied metadata.
    let phone: Record<string, unknown> | undefined;
    let path = `${body.wabaId}/phone_numbers?fields=id,display_phone_number,is_on_biz_app,is_coex_enabled&limit=100`;
    for (let page = 0; page < 10; page++) {
      const phones = await graph(path, token);
      phone = phones.data?.find((p: { id: string }) => p.id === body.phoneId);
      if (phone) break;
      const after = phones.paging?.cursors?.after;
      if (!phones.paging?.next || !after) break;
      path = `${body.wabaId}/phone_numbers?fields=id,display_phone_number,is_on_biz_app,is_coex_enabled&limit=100&after=${encodeURIComponent(after)}`;
    }
    if (
      !phone ||
      phone.is_on_biz_app !== true ||
      phone.is_coex_enabled !== true
    )
      throw new CIError(
        "Coexistence não confirmada pela Meta. O número permanece sem conexão na Genesy.",
        409,
      );
    await graph(`${body.wabaId}/subscribed_apps`, token, { method: "POST" });
    // Transaction prevents a connected row without securely stored credentials.
    const saved = await db.rpc("ci_connect", {
      p_tenant: tenant,
      p_sdr: user.id,
      p_waba: body.wabaId,
      p_phone: body.phoneId,
      p_display: String(phone.display_phone_number ?? ""),
      p_token: encryptToken(token),
    });
    check(saved.error);
    return NextResponse.json({ connected: true });
  } catch (error) {
    return fail(error);
  }
}
