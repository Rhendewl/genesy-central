import { NextRequest, NextResponse } from "next/server";
import { decryptToken } from "@/lib/crypto";
import {
  contactHash,
  metrics,
  ObservedMessage,
} from "@/lib/conversation-intelligence/domain";
import {
  check,
  CIError,
  configuration,
  context,
  fail,
  graph,
  uuid,
} from "@/lib/conversation-intelligence/server";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const { db, user, tenant, role } = await context(req);
    const clientId = req.nextUrl.searchParams.get("client_id");
    const conn = await db
      .from("ci_connections")
      .select("id,display_phone,status,connected_at,last_event_at")
      .eq("tenant_id", tenant)
      .eq("sdr_id", user.id)
      .maybeSingle();
    check(conn.error);
    let query = db
      .from("ci_consents")
      .select(
        "id,connection_id,contact_label,client_id,allow_ai,share_summary,granted_at,expires_at,revoked_at",
      )
      .eq("tenant_id", tenant);
    if (clientId) {
      if (!uuid(clientId)) throw new CIError("Cliente inválido");
      const client = await db
        .from("agency_clients")
        .select("id")
        .eq("id", clientId)
        .eq("user_id", tenant)
        .maybeSingle();
      check(client.error);
      if (!client.data) throw new CIError("Cliente não encontrado", 404);
      query = query
        .eq("client_id", clientId)
        .eq("share_summary", true)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString());
      if (!["admin", "gestor_comercial"].includes(role))
        query = query.eq("sdr_id", user.id);
    } else query = query.eq("sdr_id", user.id);
    const consents = await query.limit(1001);
    check(consents.error);
    if ((consents.data?.length ?? 0) > 1000)
      throw new CIError("Reduza o escopo da consulta", 422);
    const active = (consents.data ?? []).filter(
      (c) => !c.revoked_at && Date.parse(c.expires_at) > Date.now(),
    );
    const ids = active.map((c) => c.id);
    const days = Number(req.nextUrl.searchParams.get("days") ?? 7);
    if (![7, 14, 30].includes(days)) throw new CIError("Período inválido");
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const rows: ObservedMessage[] = [];
    // Page explicitly: Supabase's default 1000-row cap must not silently alter metrics.
    for (let offset = 0; ids.length; offset += 1000) {
      const r = await db
        .from("ci_messages")
        .select("id,consent_id,direction,sent_at,kind")
        .in("consent_id", ids)
        .gte("sent_at", since)
        .order("sent_at")
        .order("id")
        .range(offset, offset + 999);
      check(r.error);
      rows.push(...((r.data ?? []) as ObservedMessage[]));
      if ((r.data?.length ?? 0) < 1000) break;
      if (offset >= 49000)
        throw new CIError(
          "Volume acima do limite. Selecione um período menor.",
          422,
        );
    }
    const analyses = ids.length
      ? await db
          .from("ci_analyses")
          .select("consent_id,generated_at,model,source_ids,findings")
          .in("consent_id", ids)
          .gte("generated_at", since)
      : { data: [], error: null };
    check(analyses.error);
    const validIds = new Set(rows.map((r) => r.id));
    const currentAnalyses = (analyses.data ?? []).filter((a) =>
      a.source_ids.every((id: string) => validIds.has(id)),
    );
    const detailId = req.nextUrl.searchParams.get("consent_id");
    let messages: unknown[] = [];
    if (detailId) {
      if (clientId || !active.some((c) => c.id === detailId))
        throw new CIError("Conversa não encontrada", 404);
      const detail = await db
        .from("ci_messages")
        .select("id,direction,sent_at,kind,encrypted_body")
        .eq("consent_id", detailId)
        .gte("sent_at", since)
        .order("sent_at", { ascending: false })
        .limit(200);
      check(detail.error);
      messages = (detail.data ?? []).map(({ encrypted_body, ...row }) => ({
        ...row,
        text: encrypted_body ? decryptToken(encrypted_body) : null,
      }));
    }
    return NextResponse.json(
      {
        configuration: clientId ? undefined : configuration(),
        connection: clientId ? undefined : conn.data,
        consents: clientId ? undefined : consents.data,
        messages,
        metrics: metrics(rows),
        period: { days, since, until: new Date().toISOString() },
        analyses: clientId
          ? currentAnalyses.map((a) => ({
              generated_at: a.generated_at,
              findings: a.findings.map(
                (f: {
                  category: string;
                  label: string;
                  confidence: number;
                }) => ({
                  category: f.category,
                  label: f.label,
                  confidence: f.confidence,
                }),
              ),
            }))
          : currentAnalyses,
        coverage:
          "Somente mensagens observadas após autorização; histórico, mídias e clientes não compatíveis podem estar ausentes.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    const { db, user, tenant } = await context(req);
    const b = await req.json();
    const conn = await db
      .from("ci_connections")
      .select("*")
      .eq("tenant_id", tenant)
      .eq("sdr_id", user.id)
      .maybeSingle();
    check(conn.error);
    if (!conn.data)
      throw new CIError("Conecte seu WhatsApp Business primeiro", 409);
    if (b.action === "consent") {
      if (
        typeof b.phone !== "string" ||
        typeof b.evidence !== "string" ||
        b.evidence.trim().length < 10 ||
        b.evidence.length > 500 ||
        b.confirmed !== true ||
        typeof b.allowAi !== "boolean" ||
        typeof b.share !== "boolean"
      )
        throw new CIError(
          "Registre a autorização e sua referência antes de coletar",
        );
      if (b.clientId) {
        if (!uuid(b.clientId)) throw new CIError("Cliente inválido");
        const client = await db
          .from("agency_clients")
          .select("id")
          .eq("id", b.clientId)
          .eq("user_id", tenant)
          .maybeSingle();
        check(client.error);
        if (!client.data) throw new CIError("Cliente não encontrado", 404);
      }
      if (b.share && !b.clientId)
        throw new CIError("Selecione o cliente para consolidar");
      const hash = contactHash(b.phone);
      const saved = await db.rpc("ci_authorize", {
        p_connection: conn.data.id,
        p_sdr: user.id,
        p_contact: hash,
        p_label: `Contato •${b.phone.replace(/\D/g, "").slice(-4)}`,
        p_client: b.clientId || null,
        p_evidence: b.evidence.trim(),
        p_ai: b.allowAi,
        p_share: b.share,
      });
      check(saved.error);
    } else if (b.action === "revoke") {
      if (!uuid(b.id)) throw new CIError("Autorização inválida");
      const result = await db.rpc("ci_revoke", { p_id: b.id, p_sdr: user.id });
      check(result.error);
    } else if (b.action === "pause" || b.action === "resume") {
      if (
        b.action === "resume" &&
        conn.data.status === "reauthorization_required"
      )
        throw new CIError("Reconecte pela Meta", 409);
      const result = await db
        .from("ci_connections")
        .update({ status: b.action === "pause" ? "paused" : "connected" })
        .eq("id", conn.data.id);
      check(result.error);
    } else if (b.action === "disconnect") {
      // Delete is serialized against ingestion by FK and connection locks. All content/tokens cascade.
      const result = await db
        .from("ci_connections")
        .delete()
        .eq("id", conn.data.id);
      check(result.error);
    } else if (b.action === "check") {
      const credentials = await db
        .from("ci_credentials")
        .select("encrypted_token")
        .eq("connection_id", conn.data.id)
        .single();
      check(credentials.error);
      try {
        await graph(
          `${conn.data.phone_number_id}?fields=id`,
          decryptToken(credentials.data!.encrypted_token),
        );
      } catch (error) {
        if (error instanceof CIError && error.status === 502) {
          const r = await db
            .from("ci_connections")
            .update({ status: "reauthorization_required" })
            .eq("id", conn.data.id);
          check(r.error);
        }
        throw error;
      }
    } else throw new CIError("Ação inválida");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
