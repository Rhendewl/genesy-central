import {DiscoveryError,metaDiscoveryError} from "./discovery-error";
import {
  normalizeUsername,
  publicCount,
  safeInstagramLink,
  safeMediaPreview,
} from "./competitor-domain";
export function discoveryConfig(organizationId: string) {
  const token = process.env.META_DISCOVERY_ACCESS_TOKEN;
  const userId = process.env.META_DISCOVERY_IG_USER_ID;
  const version = process.env.META_DISCOVERY_GRAPH_VERSION;
  if (
    organizationId !== process.env.META_DISCOVERY_ORGANIZATION_ID ||
    !token ||
    !userId ||
    !/^\d+$/.test(userId) ||
    !/^v\d+\.0$/.test(version ?? "")
  )
    throw Object.assign(
      new Error(
        "Business Discovery pendente: configure a conta Facebook Login desta organização no servidor.",
      ),
      { status: 503 },
    );
  return { token, userId, version };
}
export function discoveryReady(organizationId: string) {
  try {
    discoveryConfig(organizationId);
    return true;
  } catch {
    return false;
  }
}
export async function discover(organizationId: string, username: string) {
  const { token, userId, version } = discoveryConfig(organizationId);
  const target = normalizeUsername(username);
  const url = new URL(`https://graph.facebook.com/${version}/${userId}`);
  // One bounded request per run. Recent window is explicit; never follow arbitrary paging URLs.
  url.searchParams.set(
    "fields",
    `business_discovery.username(${target}){id,username,name,followers_count,media_count,media.limit(50){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}}`,
  );
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const json = await response.json();
  if (!response.ok || json.error) {
    throw metaDiscoveryError(response.status,json.error,token);
  }
  const data = json.business_discovery;
  if (!data?.id || !data?.username)
    throw Object.assign(
      new DiscoveryError("Este perfil não está disponível na consulta oficial. Confira o @ e se a conta é profissional e pública.",404,"profile_unavailable"),
      { status: 404 },
    );
  const posts = (Array.isArray(data.media?.data) ? data.media.data : [])
    .slice(0, 50)
    .map((item: Record<string, unknown>) => {
      if (
        typeof item.id !== "string" ||
        !/^\d+$/.test(item.id) ||
        typeof item.timestamp !== "string" ||
        !Number.isFinite(Date.parse(item.timestamp))
      )
        throw new Error("Resposta de publicação inválida da Meta.");
      return {
        id: item.id,
        caption:
          typeof item.caption === "string"
            ? item.caption.slice(0, 10000)
            : null,
        media_type:
          typeof item.media_type === "string" ? item.media_type : "UNKNOWN",
        permalink: safeInstagramLink(item.permalink),
        preview_url: safeMediaPreview(item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url),
        published_at: new Date(item.timestamp).toISOString(),
        like_count: publicCount(item.like_count),
        comments_count: publicCount(item.comments_count),
      };
    });
  return {
    instagram_id: String(data.id),
    username: String(data.username),
    name: typeof data.name === "string" ? data.name : null,
    followers_count: publicCount(data.followers_count),
    media_count: publicCount(data.media_count),
    posts,
    partial: !!data.media?.paging?.next || publicCount(data.media_count) === null || data.media_count > posts.length,
  };
}
