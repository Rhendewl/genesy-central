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
    values?: Array<{ value: number; end_time?: string }>;
    value?: number;
    total_value?: {
      value?: number | { follows?: number; unfollows?: number };
      breakdowns?: Array<{
        dimension_keys?: string[];
        results?: Array<{ dimension_values?: string[]; value?: number }>;
      }>;
    };
  }>;
}

export type InstagramAccountMetrics = {
  reach: number; views: number; profile_views: number; accounts_engaged: number; total_interactions: number;
  likes: number; comments: number; shares: number; saves: number; profile_links_taps: number; follower_count: number;
};

const ACCOUNT_METRICS = [
  "reach", "views", "profile_views", "accounts_engaged", "total_interactions",
  "likes", "comments", "shares", "saves", "profile_links_taps", "follower_count",
] as const;

function emptyAccountMetrics(): InstagramAccountMetrics {
  return Object.fromEntries(ACCOUNT_METRICS.map((name) => [name, 0])) as InstagramAccountMetrics;
}

function metricValue(metric: NonNullable<InstagramMetricResponse["data"]>[number]) {
  const value = metric.total_value?.value ?? metric.value ?? metric.values?.at(-1)?.value ?? 0;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function addUtcDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function followerNet(metric?: NonNullable<InstagramMetricResponse["data"]>[number]) {
  const value = metric?.total_value?.value;
  if (value && typeof value === "object") return Number(value.follows ?? 0) - Number(value.unfollows ?? 0);
  const results = metric?.total_value?.breakdowns?.flatMap((breakdown) => breakdown.results ?? []) ?? [];
  let follows = 0;
  let unfollows = 0;
  for (const result of results) {
    const dimension = result.dimension_values?.[0]?.toUpperCase();
    if (dimension === "FOLLOWER" || dimension === "FOLLOW") follows += Number(result.value ?? 0);
    if (dimension === "NON_FOLLOWER" || dimension === "UNFOLLOW") unfollows += Number(result.value ?? 0);
  }
  return follows - unfollows;
}

async function getMetricsWithFallback(path: (metrics: string[]) => string, metrics: string[], accessToken: string) {
  try {
    return await instagramGet<InstagramMetricResponse>(path(metrics), accessToken);
  } catch {
    const settled = await Promise.allSettled(metrics.map((metric) => instagramGet<InstagramMetricResponse>(path([metric]), accessToken)));
    return { data: settled.flatMap((result) => result.status === "fulfilled" ? result.value.data ?? [] : []) };
  }
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
    groups.map((metrics) => getMetricsWithFallback(
      (requested) => `/${mediaId}/insights?metric=${requested.join(",")}`,
      metrics,
      accessToken,
    )),
  );
  return settled.reduce<Record<string, number>>((metrics, result) => {
    if (result.status === "fulfilled") {
      for (const metric of result.value.data ?? []) {
        metrics[metric.name] = metricValue(metric);
      }
    }
    return metrics;
  }, {});
}

export async function getInstagramAccountTotals(userId: string, accessToken: string, since: string, until: string) {
  const groups = [
    ["reach", "views", "accounts_engaged", "total_interactions"],
    ["profile_views", "profile_links_taps"],
    ["likes", "comments", "shares", "saves"],
    ["follower_count"],
  ];
  const settled = await Promise.allSettled(groups.map((metrics) => getMetricsWithFallback(
    (requested) => `/${userId}/insights?metric=${requested.join(",")}&period=total_over_range&metric_type=total_value&since=${since}&until=${until}`,
    metrics,
    accessToken,
  )));
  const totals = emptyAccountMetrics();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const metric of result.value.data ?? []) {
      if (metric.name in totals) totals[metric.name as keyof InstagramAccountMetrics] = metricValue(metric);
    }
  }
  return totals;
}

export async function getInstagramAccountDailyInsights(userId: string, accessToken: string, since: string, until: string) {
  const shiftBoundary = (date: string) => {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + 1);
    return value.toISOString().slice(0, 10);
  };
  const apiSince = shiftBoundary(since);
  const apiUntil = shiftBoundary(until);
  const groups = [
    ["reach", "views", "accounts_engaged", "total_interactions"],
    ["profile_views", "profile_links_taps"],
    ["likes", "comments", "shares", "saves"],
    ["follower_count"],
  ];
  const settled = await Promise.allSettled(groups.map((metrics) => getMetricsWithFallback(
    (requested) => `/${userId}/insights?metric=${requested.join(",")}&period=day&since=${apiSince}&until=${apiUntil}`,
    metrics,
    accessToken,
  )));
  const byDate = new Map<string, InstagramAccountMetrics>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const metric of result.value.data ?? []) {
      if (!(metric.name in emptyAccountMetrics())) continue;
      for (const point of metric.values ?? []) {
        if (!point.end_time) continue;
        // Meta identifies a daily bucket by its exclusive end timestamp. The
        // value ending on Aug 6 therefore belongs to Aug 5.
        const endTime = new Date(point.end_time);
        endTime.setUTCDate(endTime.getUTCDate() - 1);
        const date = endTime.toISOString().slice(0, 10);
        const row = byDate.get(date) ?? emptyAccountMetrics();
        row[metric.name as keyof InstagramAccountMetrics] = Number(point.value) || 0;
        byDate.set(date, row);
      }
    }
  }
  return Array.from(byDate, ([insight_date, metrics]) => ({ insight_date, ...metrics }));
}

export async function getInstagramAccountDailyExactMetrics(userId: string, accessToken: string, since: string, until: string) {
  const dates: string[] = [];
  for (let date = since; date <= until && dates.length < 31; date = addUtcDays(date, 1)) dates.push(date);
  const rows: Array<{ insight_date: string; views: number; follower_count: number }> = [];
  for (let index = 0; index < dates.length; index += 10) {
    const batch = dates.slice(index, index + 10);
    rows.push(...await Promise.all(batch.map(async (insightDate) => {
      // A total_value request already treats `since` as the displayed day.
      // Shifting these boundaries forward assigned the following day's views
      // to the current label (for example, Aug 5 was shown as Aug 4).
      const viewsSince = insightDate;
      const viewsUntil = addUtcDays(insightDate, 1);
      const followerUntil = addUtcDays(insightDate, 1);
      const [viewsResult, followersResult] = await Promise.allSettled([
        instagramGet<InstagramMetricResponse>(
          `/${userId}/insights?metric=views&period=day&metric_type=total_value&since=${viewsSince}&until=${viewsUntil}`,
          accessToken,
        ),
        instagramGet<InstagramMetricResponse>(
          `/${userId}/insights?metric=follows_and_unfollows&period=day&metric_type=total_value&breakdown=follow_type&since=${insightDate}&until=${followerUntil}`,
          accessToken,
        ),
      ]);
      const viewsMetric = viewsResult.status === "fulfilled" ? viewsResult.value.data?.find((metric) => metric.name === "views") : undefined;
      const followersMetric = followersResult.status === "fulfilled" ? followersResult.value.data?.find((metric) => metric.name === "follows_and_unfollows") : undefined;
      return { insight_date: insightDate, views: metricValue(viewsMetric ?? { name: "views" }), follower_count: followerNet(followersMetric) };
    })));
  }
  return rows;
}
