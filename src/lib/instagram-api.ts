const INSTAGRAM_GRAPH = "https://graph.instagram.com";

export interface InstagramProfile {
  id?: string;
  user_id?: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

interface InstagramMetricResponse {
  data?: Array<{
    name: string;
    values?: Array<{ value: number }>;
    value?: number;
  }>;
}

async function instagramGet<T>(pathOrUrl: string, accessToken: string): Promise<T> {
  const url = pathOrUrl.startsWith("http")
    ? new URL(pathOrUrl)
    : new URL(pathOrUrl, INSTAGRAM_GRAPH);
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { cache: "no-store" });
  const json = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(json.error?.message ?? `Instagram API ${response.status}`);
  return json;
}

export async function exchangeInstagramCode(code: string, redirectUri: string) {
  const clientId = process.env.INSTAGRAM_APP_ID ?? process.env.META_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET;
  if (!clientId || !clientSecret) throw new Error("Credenciais do Instagram não configuradas");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({})) as { access_token?: string; user_id?: string; error_message?: string };
  if (!response.ok || !json.access_token) throw new Error(json.error_message ?? "Não foi possível autorizar o Instagram");
  return json;
}

export async function exchangeInstagramLongLivedToken(shortToken: string) {
  const clientSecret = process.env.INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET;
  if (!clientSecret) throw new Error("INSTAGRAM_APP_SECRET não configurado");
  const url = new URL("/access_token", INSTAGRAM_GRAPH);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("access_token", shortToken);
  const response = await fetch(url, { cache: "no-store" });
  const json = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: { message?: string } };
  if (!response.ok || !json.access_token) throw new Error(json.error?.message ?? "Não foi possível prolongar a conexão do Instagram");
  return json as { access_token: string; expires_in?: number };
}

export function refreshInstagramToken(accessToken: string) {
  return instagramGet<{ access_token: string; expires_in?: number }>("/refresh_access_token?grant_type=ig_refresh_token", accessToken);
}

export function getInstagramProfile(accessToken: string) {
  return instagramGet<InstagramProfile>(
    "/me?fields=id,user_id,username,name,profile_picture_url,followers_count,media_count",
    accessToken,
  );
}

export async function getInstagramMedia(accessToken: string, limit = 100) {
  const fields = [
    "id", "caption", "media_type", "media_product_type", "media_url", "permalink",
    "thumbnail_url", "timestamp", "like_count", "comments_count",
  ].join(",");
  let next: string | undefined = `/me/media?fields=${fields}&limit=50`;
  const rows: InstagramMedia[] = [];
  while (next && rows.length < limit) {
    const page: { data?: InstagramMedia[]; paging?: { next?: string } } = await instagramGet(next, accessToken);
    rows.push(...(page.data ?? []));
    next = page.paging?.next;
  }
  return rows.slice(0, limit);
}

export async function getInstagramMediaMetrics(mediaId: string, accessToken: string) {
  // Reels-only metrics are kept separate so an unsupported metric never hides
  // the common metrics of image and carousel posts.
  const groups = [
    ["reach", "saved", "total_interactions"],
    ["views", "shares"],
    ["plays", "ig_reels_avg_watch_time", "ig_reels_video_view_total_time"],
  ];
  const settled = await Promise.allSettled(
    groups.map((metrics) => instagramGet<InstagramMetricResponse>(`/${mediaId}/insights?metric=${metrics.join(",")}`, accessToken)),
  );
  return settled.reduce<Record<string, number>>((metrics, result) => {
    if (result.status === "fulfilled") {
      for (const metric of result.value.data ?? []) {
        const value = metric.value ?? metric.values?.at(-1)?.value ?? 0;
        metrics[metric.name] = Number.isFinite(Number(value)) ? Number(value) : 0;
      }
    }
    return metrics;
  }, {});
}
