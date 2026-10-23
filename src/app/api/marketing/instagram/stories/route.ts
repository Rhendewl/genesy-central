import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { decryptToken, signState, verifyState } from "@/lib/crypto";
import { createInstagramStory, getInstagramContainerStatus, publishInstagramStory } from "@/lib/instagram-api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const SCOPE = "instagram_business_content_publish";
const MAX_SIZE = 3 * 1024 * 1024;
type Ticket = { purpose: string; organizationId: string; userId: string; connectionId: string; containerId: string; path: string };
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
    let image: File | undefined;
    let connectionId: string;
    if (isPrepare) {
      if (Number(req.headers.get("content-length")) > MAX_SIZE + 16384) throw fail("A imagem deve ter até 3 MB.");
      const form = await req.formData();
      connectionId = String(form.get("connectionId") ?? "");
      const file = form.get("image");
      if (!(file instanceof File) || file.type !== "image/jpeg" || !file.size || file.size > MAX_SIZE) throw fail("Envie uma imagem JPEG de até 3 MB.");
      image = file;
    } else {
      const body = await req.json();
      try { ticket = verifyState<Ticket>(body.ticket); } catch { throw fail("A sessão de publicação expirou. Confira o Instagram antes de iniciar outra publicação."); }
      if (ticket.purpose !== "instagram-story" || ticket.organizationId !== ctx.organizationId || ticket.userId !== ctx.user.id) throw fail("Publicação não autorizada.", 403);
      connectionId = ticket.connectionId;
    }
    const { data: account, error } = await supabase.from("marketing_instagram_connections")
      .select("id,instagram_user_id,encrypted_access_token,requested_scopes,token_expires_at,status")
      .eq("id", connectionId).eq("organization_id", ctx.organizationId).single();
    if (error || !account) throw fail("Conta do Instagram não encontrada.", 404);
    if (!account.requested_scopes?.includes(SCOPE) || account.status === "disconnected" ||
      (account.token_expires_at && Date.parse(account.token_expires_at) <= Date.now())) throw fail("Reconecte o Instagram em Marketing para autorizar a publicação de stories.");
    const token = decryptToken(account.encrypted_access_token);
    const storage = createAdminSupabaseClient().storage.from("criativos");
    if (image) {
      const input = Buffer.from(await image.arrayBuffer());
      const metadata = await sharp(input, { limitInputPixels: 1080 * 1920 * 2 }).metadata();
      if (metadata.format !== "jpeg" || metadata.width !== 1080 || metadata.height !== 1920) throw fail("O story deve ter 1080 × 1920 pixels.");
      const jpeg = await sharp(input).jpeg({ quality: 95 }).toBuffer();
      const path = `marketing/${ctx.organizationId}/instagram-stories/${crypto.randomUUID()}.jpg`;
      const uploaded = await storage.upload(path, jpeg, { contentType: "image/jpeg", upsert: false });
      if (uploaded.error) throw uploaded.error;
      try {
        const signed = await storage.createSignedUrl(path, 3600);
        if (signed.error) throw signed.error;
        const container = await createInstagramStory(account.instagram_user_id, token, signed.data.signedUrl);
        if (!container.id) throw fail("O Instagram não confirmou o recebimento da imagem.", 502);
        return NextResponse.json({ ticket: signState({ purpose: "instagram-story", organizationId: ctx.organizationId,
          userId: ctx.user.id, connectionId, containerId: container.id, path }) });
      } catch (error) { await storage.remove([path]); throw error; }
    }
    if (!ticket) throw fail("Publicação inválida.");
    const state = await getInstagramContainerStatus(ticket.containerId, token);
    if (state.status_code === "PUBLISHED") {
      await storage.remove([ticket.path]);
      return NextResponse.json({ published: true });
    }
    if (state.status_code === "IN_PROGRESS") return NextResponse.json({ published: false, processing: true });
    if (state.status_code !== "FINISHED") {
      await storage.remove([ticket.path]);
      throw fail("O Instagram não conseguiu processar a imagem. Confira a conta antes de tentar novamente.");
    }
    // Retrying always uses this same container; never creates a second story.
    const published = await publishInstagramStory(account.instagram_user_id, token, ticket.containerId);
    if (!published.id) throw fail("Não foi possível confirmar a publicação. Verifique o status novamente.", 502);
    await storage.remove([ticket.path]);
    return NextResponse.json({ published: true, mediaId: published.id });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
