import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { getInstagramMedia, getInstagramMediaMetrics, getInstagramProfile, refreshInstagramToken } from "@/lib/instagram-api";

type InstagramConnection = {
  id: string;
  organization_id: string;
  encrypted_access_token: string;
  token_expires_at: string | null;
};

function normalizePermalink(value: string | null | undefined) {
  return value?.trim().replace(/\?.*$/, "").replace(/\/$/, "") ?? "";
}

async function loadMetricsInBatches(media: Awaited<ReturnType<typeof getInstagramMedia>>, accessToken: string) {
  const rows: Array<{ item: (typeof media)[number]; metrics: Record<string, number> }> = [];
  for (let index = 0; index < media.length; index += 5) {
    const batch = media.slice(index, index + 5);
    rows.push(...await Promise.all(batch.map(async (item) => ({
      item,
      metrics: await getInstagramMediaMetrics(item.id, accessToken),
    }))));
  }
  return rows;
}

export async function syncInstagramConnection(supabase: SupabaseClient, connection: InstagramConnection) {
  let accessToken = decryptToken(connection.encrypted_access_token);
  let encryptedToken = connection.encrypted_access_token;
  let tokenExpiresAt = connection.token_expires_at;

  if (tokenExpiresAt && new Date(tokenExpiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000) {
    const refreshed = await refreshInstagramToken(accessToken);
    accessToken = refreshed.access_token;
    encryptedToken = encryptToken(accessToken);
    tokenExpiresAt = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      : tokenExpiresAt;
  }

  const [profile, media, contentsResult] = await Promise.all([
    getInstagramProfile(accessToken),
    getInstagramMedia(accessToken),
    supabase
      .from("marketing_contents")
      .select("id,publication_url")
      .eq("organization_id", connection.organization_id)
      .not("publication_url", "is", null),
  ]);
  if (contentsResult.error) throw new Error(contentsResult.error.message);

  const contentByUrl = new Map(
    (contentsResult.data ?? []).map((content) => [normalizePermalink(content.publication_url), content.id]),
  );
  const now = new Date().toISOString();
  const metricRows = await loadMetricsInBatches(media, accessToken);
  const rows = metricRows.map(({ item, metrics }) => ({
    organization_id: connection.organization_id,
    connection_id: connection.id,
    marketing_content_id: contentByUrl.get(normalizePermalink(item.permalink)) ?? null,
    instagram_media_id: item.id,
    media_type: item.media_type,
    media_product_type: item.media_product_type ?? null,
    caption: item.caption ?? null,
    media_url: item.media_url ?? null,
    thumbnail_url: item.thumbnail_url ?? null,
    permalink: item.permalink ?? null,
    published_at: item.timestamp,
    reach: metrics.reach ?? 0,
    views: metrics.views ?? 0,
    plays: metrics.plays ?? 0,
    likes: item.like_count ?? 0,
    comments: item.comments_count ?? 0,
    saved: metrics.saved ?? 0,
    shares: metrics.shares ?? 0,
    total_interactions: metrics.total_interactions
      ?? ((item.like_count ?? 0) + (item.comments_count ?? 0) + (metrics.saved ?? 0) + (metrics.shares ?? 0)),
    average_watch_time: metrics.ig_reels_avg_watch_time ?? 0,
    total_watch_time: metrics.ig_reels_video_view_total_time ?? 0,
    raw_metrics: metrics,
    last_synced_at: now,
    updated_at: now,
  }));

  if (rows.length) {
    const saved = await supabase
      .from("marketing_instagram_media")
      .upsert(rows, { onConflict: "connection_id,instagram_media_id" });
    if (saved.error) throw new Error(saved.error.message);
  }

  const updated = await supabase.from("marketing_instagram_connections").update({
    username: profile.username,
    display_name: profile.name ?? null,
    profile_picture_url: profile.profile_picture_url ?? null,
    followers_count: profile.followers_count ?? 0,
    media_count: profile.media_count ?? media.length,
    encrypted_access_token: encryptedToken,
    token_expires_at: tokenExpiresAt,
    status: "connected",
    sync_error: null,
    last_sync_at: now,
    updated_at: now,
  }).eq("id", connection.id);
  if (updated.error) throw new Error(updated.error.message);

  return { mediaSynced: rows.length, lastSyncAt: now };
}
