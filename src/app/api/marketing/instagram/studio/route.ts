import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { verifyState } from "@/lib/crypto";
import { apiError } from "@/lib/marketing/server";
import { assertMarketingAccess, canConnectInstagramAccounts, scopeByConnectionIds, scopeInstagramConnections, visibleInstagramConnectionIds } from "@/lib/marketing/instagram-access";
import { syncInstagramEditorial } from "@/lib/marketing/editorial-instagram";
import { canPublishStudio, studioAccount, studioContext, studioFail } from "@/lib/marketing/instagram-studio-server";
import { validateStudioAssets, type InstagramStudioFormat, type StudioAssetManifest } from "@/lib/marketing/instagram-studio";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type UploadTicket = { purpose: string; id: string; organizationId: string; userId: string; connectionId: string; format: InstagramStudioFormat; ratio?: "square" | "portrait" | "landscape"; assets: (StudioAssetManifest & { path: string })[]; previewPath: string; previewSize: number };
export async function GET(req: NextRequest) {
  try {
    const { ctx, db, client } = await studioContext(false);
    assertMarketingAccess(ctx, "marketing.instagram");
    const visibleIds = await visibleInstagramConnectionIds(client, ctx);
    const id = req.nextUrl.searchParams.get("id");
    const [connections, media, automations] = await Promise.all([
      scopeInstagramConnections(client.from("marketing_instagram_connections").select("id,username,profile_picture_url,followers_count,status,requested_scopes,token_expires_at,webhook_subscribed").eq("organization_id", ctx.organizationId), ctx).order("username"),
      scopeByConnectionIds(client.from("marketing_instagram_media").select("id,connection_id,instagram_media_id,media_type,media_product_type,caption,media_url,thumbnail_url,permalink,published_at,likes,comments,reach,saved,shares,total_interactions").eq("organization_id", ctx.organizationId), visibleIds).order("published_at", { ascending: false }).limit(100),
      scopeByConnectionIds(client.from("marketing_instagram_automations").select("id,connection_id,name,status,keywords,trigger_type,trigger_count,action_count").eq("organization_id", ctx.organizationId), visibleIds),
    ]);
    for (const result of [connections, media, automations]) if (result.error) throw result.error;
    let posts: Record<string, unknown>[] = [];
    if (ctx.isAdmin) {
      let query = db.from("marketing_instagram_scheduled_posts").select("id,connection_id,scheduled_at,caption,status,last_error,published_at,media_kind,media_id,paths,asset_types,preview_path").eq("organization_id", ctx.organizationId);
      if (id) query = query.eq("id", id);
      const jobs = await query.order("scheduled_at", { ascending: false }).limit(id ? 1 : 100);
      if (jobs.error) throw jobs.error;
      if (id && !jobs.data?.length) throw studioFail("Publicação não encontrada.", 404);
      const storage = db.storage.from("criativos");
      posts = await Promise.all((jobs.data ?? []).map(async job => {
        const format = job.media_kind === "reel" ? "reel" : (job.media_kind === "story" || job.paths.some((path: string) => path.includes("/instagram-stories/"))) ? "story" : job.paths.length > 1 ? "carousel" : "image";
        const thumbnail = job.preview_path || (job.asset_types?.[0] !== "video/mp4" ? job.paths[0] : null);
        const signed = thumbnail ? await storage.createSignedUrl(thumbnail, 3600) : null;
        const assets = id && !["published", "cancelled"].includes(job.status) ? await Promise.all(job.paths.map(async (path: string, index: number) => {
          const url = await storage.createSignedUrl(path, 3600);
          if (url.error) throw url.error;
          return { url: url.data.signedUrl, type: job.asset_types?.[index] ?? "image/jpeg" };
        })) : undefined;
        const { paths, asset_types, preview_path, ...post } = job;
        void asset_types; void preview_path;
        return { ...post, format, asset_count: paths.length, preview_url: signed?.data?.signedUrl ?? null, ...(assets ? { asset_urls: assets } : {}) };
      }));
    }
    return NextResponse.json({ is_admin: ctx.isAdmin, can_manage_accounts: canConnectInstagramAccounts(ctx), connections: (connections.data ?? []).map(account => ({ id: account.id, username: account.username,
      profile_picture_url: account.profile_picture_url, followers_count: account.followers_count ?? 0, status: account.status, webhook_subscribed: account.webhook_subscribed, can_publish: canPublishStudio(account) })),
      media: media.data ?? [], automations: automations.data ?? [], posts }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
export async function POST(req: NextRequest) {
  try {
    const { ctx, db } = await studioContext();
    const body = await req.json();
    let ticket: UploadTicket;
    try { ticket = verifyState<UploadTicket>(String(body.ticket ?? "")); } catch { throw studioFail("A sessão de envio expirou. Confira a agenda antes de preparar novamente."); }
    if (ticket.purpose !== "instagram-studio" || ticket.organizationId !== ctx.organizationId || ticket.userId !== ctx.user.id) throw studioFail("Envio não autorizado.", 403);
    const existing = await db.from("marketing_instagram_scheduled_posts").select("id,status,scheduled_at").eq("id", ticket.id).eq("organization_id", ctx.organizationId).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return NextResponse.json({ post: existing.data });
    validateStudioAssets(ticket.format, ticket.assets);
    await studioAccount(db, ctx.organizationId, ticket.connectionId);
    const caption = typeof body.caption === "string" ? body.caption.trim() : "";
    if (Array.from(caption).length > 2200) throw studioFail("A legenda deve ter até 2.200 caracteres.");
    if (body.timing !== "now" && body.timing !== "schedule") throw studioFail("Escolha publicar agora ou programar.");
    let scheduledAt = new Date().toISOString();
    if (body.timing === "schedule") {
      const date = typeof body.scheduledAt === "string" ? Date.parse(body.scheduledAt) : NaN;
      if (!Number.isFinite(date) || date < Date.now() + 5 * 60_000) throw studioFail("Programe com pelo menos 5 minutos de antecedência.");
      scheduledAt = new Date(date).toISOString();
    }
    const altTexts = body.altTexts ?? [];
    if (!Array.isArray(altTexts) || altTexts.length > ticket.assets.length || altTexts.some((text: unknown) => typeof text !== "string" || text.length > 1000)) throw studioFail("Texto alternativo inválido.");
    const storage = db.storage.from("criativos");
    const prefix = `marketing/${ctx.organizationId}/instagram-studio/${ticket.id}/`;
    for (const asset of [...ticket.assets, { path: ticket.previewPath, type: "image/jpeg", size: ticket.previewSize }]) {
      if (!asset.path.startsWith(prefix)) throw studioFail("Arquivo fora deste envio.", 403);
      const info = await storage.info(asset.path);
      if (info.error) throw studioFail("Um arquivo não terminou de enviar. Aguarde ou tente novamente.");
      const size = info.data.size ?? info.data.metadata?.size;
      if (Number(size) !== asset.size) throw studioFail("O tamanho do arquivo enviado não confere.");
      if (asset.type === "image/jpeg") {
        const file = await storage.download(asset.path);
        if (file.error) throw file.error;
        const meta = await sharp(Buffer.from(await file.data.arrayBuffer()), { limitInputPixels: 1080 * 1920 * 2 }).metadata();
        if (meta.format !== "jpeg") throw studioFail("Imagem JPEG inválida.");
        const expectedHeight = ticket.format === "story" ? 1920 : ticket.ratio === "square" ? 1080 : ticket.ratio === "landscape" ? 566 : 1350;
        if (asset.path !== ticket.previewPath && (meta.width !== 1080 || meta.height !== expectedHeight)) throw studioFail("A imagem não está no formato preparado na prévia.");
      } else if ((info.data.contentType ?? info.data.metadata?.mimetype) !== asset.type) throw studioFail("O vídeo enviado precisa estar no formato informado.");
    }
    const result = await db.from("marketing_instagram_scheduled_posts").insert({ id: ticket.id, organization_id: ctx.organizationId, created_by: ctx.user.id,
      connection_id: ticket.connectionId, scheduled_at: scheduledAt, caption, alt_texts: altTexts,
      paths: ticket.assets.map(asset => asset.path), asset_types: ticket.assets.map(asset => asset.type), preview_path: ticket.previewPath,
      media_kind: ticket.format === "story" ? "story" : ticket.format === "reel" ? "reel" : "feed",
    });
    if (result.error && result.error.code !== "23505") throw result.error;
    if (result.error) {
      const concurrent = await db.from("marketing_instagram_scheduled_posts").select("id,status,scheduled_at").eq("id", ticket.id).eq("organization_id", ctx.organizationId).maybeSingle();
      if (concurrent.error || !concurrent.data) throw result.error;
      return NextResponse.json({ post: concurrent.data });
    }
    await syncInstagramEditorial(db, ctx.organizationId, ticket.id).catch(() => console.error("Instagram studio editorial sync pending", ticket.id));
    return NextResponse.json({ post: { id: ticket.id, status: "scheduled", scheduled_at: scheduledAt } }, { status: 201 });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
export async function PATCH(req: NextRequest) {
  try {
    const { ctx, db } = await studioContext();
    const { id, action, scheduledAt } = await req.json();
    if (action !== "reschedule") throw studioFail("Ação inválida.");
    const time = typeof scheduledAt === "string" ? Date.parse(scheduledAt) : NaN;
    if (!Number.isFinite(time) || time < Date.now() + 5 * 60_000) throw studioFail("Programe com pelo menos 5 minutos de antecedência.");
    const result = await db.from("marketing_instagram_scheduled_posts").update({ scheduled_at: new Date(time).toISOString() })
      .eq("id", id).eq("organization_id", ctx.organizationId).eq("status", "scheduled").is("locked_until", null).select("id").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw studioFail("O envio já está em processamento ou não pode ser reprogramado.", 409);
    await syncInstagramEditorial(db, ctx.organizationId, id).catch(() => console.error("Instagram studio editorial sync pending", id));
    return NextResponse.json({ success: true });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
