import { recordInstagramPublication, syncInstagramEditorial } from "@/lib/marketing/editorial-instagram";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { decryptToken, signState, verifyState } from "@/lib/crypto";
import { createInstagramFeedImage, createInstagramCarousel, getInstagramContainerStatus, publishInstagramStory } from "@/lib/instagram-api";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
const SCOPE = "instagram_business_content_publish";
const MAX_SIZE = 3 * 1024 * 1024;
type Ticket = { purpose: string; organizationId: string; userId: string; connectionId: string; containerId: string; path: string; paths?: string[]; children?: string[]; caption?: string };
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });

async function context() {
  const supabase = await createServerSupabaseClient();
  const ctx = await getMarketingServerContext(supabase);
  if (!ctx.isAdmin) throw fail("Apenas administradores podem publicar no Instagram.", 403);
  return { supabase, ctx };
}

export async function GET() {
  try {
    const { supabase, ctx } = await context();
    const { data, error } = await supabase.from("marketing_instagram_connections")
      .select("id,username,status,requested_scopes,token_expires_at").eq("organization_id", ctx.organizationId).order("username");
    if (error) throw error;
    return NextResponse.json({ accounts: (data ?? []).map((account) => ({
      id: account.id, username: account.username,
      needsReconnect: !account.requested_scopes?.includes(SCOPE) || account.status === "disconnected" ||
        Boolean(account.token_expires_at && Date.parse(account.token_expires_at) <= Date.now()),
    })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, ctx } = await context();
    const isPrepare = req.headers.get("content-type")?.includes("multipart/form-data");
    let ticket: Ticket | undefined;
    let images: File[] = [];
    let caption = "";
    let scheduledAt: string | null = null;
    let scheduleId = "";
    let altTexts: string[] = [];
    let connectionId: string;
    if (isPrepare) {
      if (Number(req.headers.get("content-length")) > MAX_SIZE * 10 + 32768) throw fail("A imagem deve ter até 3 MB.");
      const form = await req.formData();
      connectionId = String(form.get("connectionId") ?? "");
      if (form.get("scheduledAt")) {
        const date = new Date(String(form.get("scheduledAt")));
        if (!Number.isFinite(date.getTime()) || date.getTime() < Date.now() + 5 * 60_000) throw fail("Escolha um horário com pelo menos 5 minutos de antecedência.");
        scheduledAt = date.toISOString();
        scheduleId = String(form.get("scheduleId") ?? "");
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scheduleId)) throw fail("Identificador de agendamento inválido.");
        const existing = await createAdminSupabaseClient().from("marketing_instagram_scheduled_posts").select("id,scheduled_at").eq("id", scheduleId).eq("organization_id", ctx.organizationId).maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) return NextResponse.json({ scheduled: true, id: existing.data.id, scheduledAt: existing.data.scheduled_at });
      }
      const files = form.getAll("images");
      if (!files.length || files.length > 10 || files.some((file) => !(file instanceof File) || file.type !== "image/jpeg" || !file.size || file.size > MAX_SIZE)) throw fail("Selecione de 1 a 10 imagens JPEG de até 3 MB cada.");
      images = files as File[];
      caption = String(form.get("caption") ?? "");
      if (Array.from(caption).length > 2200) throw fail("A legenda deve ter até 2.200 caracteres.");
      try { altTexts = JSON.parse(String(form.get("altTexts") ?? "[]")); } catch { throw fail("Textos alternativos inválidos."); }
      if (!Array.isArray(altTexts) || altTexts.some((text) => typeof text !== "string" || text.length > 1000)) throw fail("Texto alternativo inválido (máximo de 1.000 caracteres).");
    } else {
      const body = await req.json();
      try { ticket = verifyState<Ticket>(body.ticket); } catch { throw fail("A sessão de publicação expirou. Confira o Instagram antes de iniciar outra publicação."); }
      if (ticket.purpose !== "instagram-feed" || ticket.organizationId !== ctx.organizationId || ticket.userId !== ctx.user.id) throw fail("Publicação não autorizada.", 403);
      connectionId = ticket.connectionId;
    }
    const { data: account, error } = await supabase.from("marketing_instagram_connections")
      .select("id,instagram_user_id,encrypted_access_token,requested_scopes,token_expires_at,status")
      .eq("id", connectionId).eq("organization_id", ctx.organizationId).single();
    if (error || !account) throw fail("Conta do Instagram não encontrada.", 404);
    if (!account.requested_scopes?.includes(SCOPE) || account.status === "disconnected" ||
      (account.token_expires_at && Date.parse(account.token_expires_at) <= Date.now())) throw fail("Reconecte o Instagram em Marketing para autorizar a publicação no feed.");
    const token = decryptToken(account.encrypted_access_token);
    const storage = createAdminSupabaseClient().storage.from("criativos");
    const recordPublished = async (mediaId?: string) => {
      if (!ticket) return;
      await recordInstagramPublication(createAdminSupabaseClient(), {
        organizationId: ctx.organizationId, userId: ctx.user.id, connectionId, containerId: ticket.containerId,
        paths: ticket.paths ?? [ticket.path], caption: ticket.caption, mediaId,
      });
    }
    if (images.length) {
      const paths: string[] = [];
      const children: string[] = [];
      try {
        // Validate every file before creating any remote containers.
        const buffers = [];
        for (const image of images) {
          const input = Buffer.from(await image.arrayBuffer());
          const metadata = await sharp(input, { limitInputPixels: 1080 * 1350 * 2 }).metadata();
          if (metadata.format !== "jpeg" || metadata.width !== 1080 || metadata.height !== 1350) throw fail("Use o formato Feed 1080 × 1350 para publicar.");
          buffers.push(await sharp(input).jpeg({ quality: 92 }).toBuffer());
        }
        // Limit concurrent Meta requests while avoiding ten serial upload round trips.
        for (let offset = 0; offset < buffers.length; offset += 3) {
          const batch = await Promise.allSettled(buffers.slice(offset, offset + 3).map(async (buffer, position) => {
          const index = offset + position;
          const path = `marketing/${ctx.organizationId}/instagram-feed/${crypto.randomUUID()}.jpg`;
          const uploaded = await storage.upload(path, buffer, { contentType: "image/jpeg", upsert: false });
          if (uploaded.error) throw uploaded.error;
          paths[index] = path;
          if (scheduledAt) return;
          const signed = await storage.createSignedUrl(path, 3600);
          if (signed.error) throw signed.error;
          const container = await createInstagramFeedImage(account.instagram_user_id, token, signed.data.signedUrl, {
            caption, altText: altTexts[index], carousel: images.length > 1,
          });
          if (!container.id) throw fail("O Instagram não confirmou o recebimento da imagem.", 502);
          children[index] = container.id;
          }));
          // Let every upload settle before cleaning up a failed batch.
          const failed = batch.find((result) => result.status === "rejected");
          if (failed?.status === "rejected") throw failed.reason;
        }
        if (scheduledAt) {
          const result = await createAdminSupabaseClient().from("marketing_instagram_scheduled_posts").insert({
            id: scheduleId, organization_id: ctx.organizationId, connection_id: connectionId, created_by: ctx.user.id,
            scheduled_at: scheduledAt, caption, alt_texts: altTexts, paths,
          });
          if (result.error) {
            if (result.error.code === "23505") {
              const existing = await createAdminSupabaseClient().from("marketing_instagram_scheduled_posts").select("id,scheduled_at").eq("id", scheduleId).eq("organization_id", ctx.organizationId).single();
              if (existing.data) { await storage.remove(paths); return NextResponse.json({ scheduled: true, id: existing.data.id, scheduledAt: existing.data.scheduled_at }); }
            }
            throw result.error;
          }
          await syncInstagramEditorial(createAdminSupabaseClient(), ctx.organizationId, scheduleId).catch(() => console.error("Instagram editorial sync pending", scheduleId));
          return NextResponse.json({ scheduled: true, id: scheduleId, scheduledAt });
        }
        return NextResponse.json({ ticket: signState({ purpose: "instagram-feed", organizationId: ctx.organizationId,
          userId: ctx.user.id, connectionId, containerId: images.length === 1 ? children[0] : "", path: paths[0], paths,
          children: images.length > 1 ? children : undefined, caption }) });
      } catch (error) { if (paths.length) await storage.remove(paths.filter(Boolean)); throw error; }
    }
    if (!ticket) throw fail("Publicação inválida.");
    if (!ticket.containerId && ticket.children?.length) {
      const states = await Promise.all(ticket.children.map((id) => getInstagramContainerStatus(id, token)));
      if (states.some((state) => ["ERROR", "EXPIRED"].includes(state.status_code))) {
        await storage.remove(ticket.paths ?? [ticket.path]);
        throw fail("O Instagram não conseguiu processar os slides.");
      }
      if (states.some((state) => state.status_code !== "FINISHED")) return NextResponse.json({ published: false, processing: true });
      const parent = await createInstagramCarousel(account.instagram_user_id, token, ticket.children, ticket.caption ?? "");
      if (!parent.id) throw fail("O Instagram não confirmou o carrossel.", 502);
      return NextResponse.json({ published: false, ticket: signState({ ...ticket, containerId: parent.id }) });
    }
    const state = await getInstagramContainerStatus(ticket.containerId, token);
    if (state.status_code === "PUBLISHED") {
      await recordPublished();
      await storage.remove(ticket.paths ?? [ticket.path]);
      return NextResponse.json({ published: true });
    }
    if (state.status_code === "IN_PROGRESS") return NextResponse.json({ published: false, processing: true });
    if (state.status_code !== "FINISHED") {
      await storage.remove(ticket.paths ?? [ticket.path]);
      throw fail("O Instagram não conseguiu processar a imagem. Confira a conta antes de tentar novamente.");
    }
    // Retrying always uses this same container; never creates a second post.
    const published = await publishInstagramStory(account.instagram_user_id, token, ticket.containerId);
    if (!published.id) throw fail("Não foi possível confirmar a publicação. Verifique o status novamente.", 502);
    await recordPublished(published.id);
    await storage.remove(ticket.paths ?? [ticket.path]);
    return NextResponse.json({ published: true, mediaId: published.id });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
