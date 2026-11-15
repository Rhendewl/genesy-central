import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const INSTAGRAM_EDITORIAL_NOTE = "Integração automática do Instagram.";
export const isInstagramEditorial = (notes?: string | null) => notes?.startsWith(INSTAGRAM_EDITORIAL_NOTE) === true;
export function instagramEditorialId(organizationId: string, containerId: string) {
  const hex = createHash("sha256").update(`${organizationId}:${containerId}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export type EditorialInstagramPost = {
  id: string; organization_id: string; created_by: string; caption: string; paths: string[];
  status: string; scheduled_at: string; published_at: string | null; last_error: string | null; media_kind?: string;
};
export function editorialInstagramRecord(post: EditorialInstagramPost) {
  if (!post.organization_id || !post.created_by) throw new Error("Publicação do Instagram sem organização ou autoria. Revise o registro antes de sincronizar.");
  const published = post.status === "published";
  const status = published ? "published" : post.status === "cancelled" ? "cancelled" : post.status === "failed" ? "planned" : "scheduled";
  return {
    id: post.id, organization_id: post.organization_id, created_by: post.created_by,
    title: post.caption.trim().split("\n")[0]?.slice(0, 160) || (post.paths.length > 1 ? "Carrossel do Instagram" : "Post do Instagram"),
    platform: "instagram", format: post.media_kind === "reel" ? "reel" : post.media_kind === "story" || post.paths.some((path) => path.includes("/instagram-stories/")) ? "story" : post.paths.length > 1 ? "carousel" : "static_post", caption: post.caption,
    reference_links: [], workspace_tag_ids: [],
    status, scheduled_at: published ? post.published_at ?? post.scheduled_at : post.scheduled_at,
    published_at: published ? post.published_at ?? post.scheduled_at : null, manual_publication: false,
    notes: `${INSTAGRAM_EDITORIAL_NOTE} Gerencie o envio na Central do Instagram.${post.status === "failed" ? ` Falha no envio: ${post.last_error || "confira a conexão do Instagram"}. Este conteúdo precisa ser replanejado.` : post.status === "publishing" ? " O Instagram está processando o envio." : ""}`,
  };
}

// Reconcile the durable publication ledger, including schedules created before this integration.
// Compare first: unchanged records must not generate repeated updates or notifications.
export async function syncInstagramEditorial(db: SupabaseClient, organizationId?: string, postId?: string) {
  let synced = 0;
  for (let offset = 0; ; offset += 200) {
    let query = db.from("marketing_instagram_scheduled_posts")
      .select("id,organization_id,created_by,caption,paths,status,scheduled_at,published_at,last_error,media_kind")
      .order("created_at", { ascending: true }).range(offset, offset + 199);
    if (organizationId) query = query.eq("organization_id", organizationId);
    if (postId) query = query.eq("id", postId);
    const jobs = await query;
    if (jobs.error) throw jobs.error;
    if (!jobs.data?.length) break;
    const ids = jobs.data.map((post) => post.id);
    const existing = await db.from("marketing_contents").select("*").in("id", ids);
    if (existing.error) throw existing.error;
    const byId = new Map((existing.data ?? []).map((row) => [row.id, row]));
    const changes = jobs.data.map((post) => editorialInstagramRecord(post)).filter((row) => {
      const current = byId.get(row.id);
      return !current || Object.entries(row).some(([key, value]) => JSON.stringify(current[key]) !== JSON.stringify(value));
    });
    if (changes.length) {
      const saved = await db.from("marketing_contents").upsert(changes, { onConflict: "id" });
      if (saved.error) throw saved.error;
      synced += changes.length;
    }
    if (jobs.data.length < 200) break;
  }
  return synced;
}

export async function recordInstagramPublication(db: SupabaseClient, input: {
  organizationId: string; userId: string; connectionId: string; containerId: string; paths: string[]; caption?: string; mediaId?: string;
}) {
  const id = instagramEditorialId(input.organizationId, input.containerId);
  const now = new Date().toISOString();
  const saved = await db.from("marketing_instagram_scheduled_posts").upsert({
    id, organization_id: input.organizationId, connection_id: input.connectionId, created_by: input.userId,
    scheduled_at: now, published_at: now, caption: input.caption ?? "", paths: input.paths,
    status: "published", container_id: input.containerId, media_id: input.mediaId ?? null,
  }, { onConflict: "id", ignoreDuplicates: true });
  if (saved.error) throw saved.error;
  await syncInstagramEditorial(db, input.organizationId, id).catch(() => console.error("Instagram editorial sync pending", id));
}
