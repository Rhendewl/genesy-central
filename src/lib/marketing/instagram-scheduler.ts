import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/crypto";
import { createInstagramFeedImage, createInstagramCarousel, createInstagramStory, createInstagramVideo, getInstagramContainerStatus, publishInstagramStory } from "@/lib/instagram-api";

// Checkpoint every remote container. A retry reuses it and checks PUBLISHED first.
export async function runScheduledInstagramPost(db: SupabaseClient) {
  const { data, error } = await db.rpc("claim_instagram_scheduled_post");
  if (error) throw error;
  const job = data?.[0];
  if (!job) return { processed: 0 };
  async function save(patch: Record<string, unknown>) {
    const result = await db.from("marketing_instagram_scheduled_posts").update(patch).eq("id", job.id).eq("locked_until", job.locked_until);
    if (result.error) throw result.error;
  }
  try {
    const { data: account, error: accountError } = await db.from("marketing_instagram_connections")
      .select("instagram_user_id,encrypted_access_token,requested_scopes,status,token_expires_at")
      .eq("id", job.connection_id).eq("organization_id", job.organization_id).single();
    if (accountError || !account) throw new Error("Conta do Instagram indisponível.");
    if (account.status === "disconnected" || !account.requested_scopes?.includes("instagram_business_content_publish") ||
      (account.token_expires_at && Date.parse(account.token_expires_at) <= Date.now())) throw new Error("Reconecte a conta do Instagram para autorizar a publicação.");
    const token = decryptToken(account.encrypted_access_token);
    const storage = db.storage.from("criativos");
    const children: string[] = [...job.children];
    // Once a parent is checkpointed, only reconcile that container. Never create replacement media.
    for (let index = job.container_id ? job.paths.length : children.length; index < job.paths.length; index++) {
      const signed = await storage.createSignedUrl(job.paths[index], 3600);
      if (signed.error) throw signed.error;
      const container = job.media_kind === "reel" || job.asset_types?.[index] === "video/mp4"
        ? await createInstagramVideo(account.instagram_user_id, token, signed.data.signedUrl, { story: job.media_kind === "story", caption: job.caption })
        : job.media_kind === "story" ? await createInstagramStory(account.instagram_user_id, token, signed.data.signedUrl)
        : await createInstagramFeedImage(account.instagram_user_id, token, signed.data.signedUrl, {
        caption: job.caption, altText: job.alt_texts[index], carousel: job.paths.length > 1,
      });
      if (!container.id) throw new Error("Instagram não confirmou o recebimento do slide.");
      children.push(container.id); await save({ children });
    }
    let containerId = job.container_id || (children.length === 1 ? children[0] : "");
    if (!containerId) {
      const states = await Promise.all(children.map((id) => getInstagramContainerStatus(id, token)));
      if (states.some((state) => ["ERROR", "EXPIRED"].includes(state.status_code))) throw new Error("O Instagram não conseguiu processar os slides.");
      if (states.some((state) => state.status_code !== "FINISHED")) {
        await save({ locked_until: null, next_attempt_at: new Date(Date.now() + 30_000).toISOString() });
        return { processed: 1, processing: true };
      }
      const parent = await createInstagramCarousel(account.instagram_user_id, token, children, job.caption);
      if (!parent.id) throw new Error("Instagram não confirmou o carrossel.");
      containerId = parent.id;
    }
    // Persist before making any request capable of publishing the post.
    await save({ container_id: containerId });
    const state = await getInstagramContainerStatus(containerId, token);
    if (state.status_code === "IN_PROGRESS") {
      await save({ locked_until: null, next_attempt_at: new Date(Date.now() + 30_000).toISOString() });
      return { processed: 1, processing: true };
    }
    if (!["FINISHED", "PUBLISHED"].includes(state.status_code)) throw new Error("O Instagram não conseguiu processar o post.");
    let mediaId = job.media_id;
    if (state.status_code !== "PUBLISHED") {
      const published = await publishInstagramStory(account.instagram_user_id, token, containerId);
      if (!published.id) throw new Error("Verificando confirmação da publicação.");
      mediaId = published.id;
    }
    await save({ status: "published", media_id: mediaId, published_at: new Date().toISOString(), locked_until: null, last_error: null });
    return { processed: 1, published: true };
  } catch (error) {
    const attempts = job.attempts + 1;
    await save({ attempts, status: attempts >= 8 ? "failed" : "publishing", locked_until: null,
      next_attempt_at: new Date(Date.now() + 60_000 * Math.min(attempts, 5)).toISOString(),
      last_error: error instanceof Error ? error.message.slice(0, 500) : "Erro ao publicar no Instagram.",
    });
    return { processed: 1, failed: attempts >= 8 };
  }
}

/** Remove original uploads and preview 12 hours after confirmed publication. */
export async function cleanupPublishedInstagramAssets(db: SupabaseClient, now = Date.now()) {
  const cutoff = new Date(now - 12 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db.from("marketing_instagram_scheduled_posts")
    .select("id,paths,preview_path")
    .eq("status", "published")
    .lt("published_at", cutoff)
    .or("preview_path.not.is.null,paths.neq.{}")
    .limit(100);
  if (error) throw error;
  let cleaned = 0;
  const storage = db.storage.from("criativos");
  for (const row of data ?? []) {
    const paths = [...(row.paths ?? []), ...(row.preview_path ? [row.preview_path] : [])];
    if (paths.length) {
      const removed = await storage.remove(paths);
      if (removed.error) continue;
    }
    const saved = await db.from("marketing_instagram_scheduled_posts")
      .update({ paths: [], asset_types: [], preview_path: null })
      .eq("id", row.id).eq("status", "published");
    if (saved.error) throw saved.error;
    cleaned++;
  }
  return { cleaned };
}
