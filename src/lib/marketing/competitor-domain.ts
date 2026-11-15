export type CompetitorPost = {
  id: string;
  profile_id: string;
  media_type: string;
  caption: string | null;
  permalink: string | null;
  published_at: string;
  like_count: number | null;
  comments_count: number | null;
  collected_at: string;
  preview_url?: string | null;
};
export function normalizeUsername(value: unknown) {
  const username =
    typeof value === "string"
      ? value.trim().replace(/^@/, "").toLowerCase()
      : "";
  if (
    !/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(username) ||
    username.includes("..")
  )
    throw Object.assign(new Error("Informe um @ válido, sem URL."), {
      status: 400,
    });
  return username;
}
// Profile links are accepted only from Instagram; post/reel links are not profiles.
export function competitorUsernameInput(value:unknown){
 if(typeof value!=="string"||value.length>512)throw Object.assign(new Error("Informe o @ ou o link do perfil no Instagram."),{status:400});
 let text=value.trim();
 if(/^https?:\/\//i.test(text)){
  let url:URL;try{url=new URL(text);}catch{throw Object.assign(new Error("Link de perfil inválido."),{status:400});}
  const path=url.pathname.split("/").filter(Boolean);
  if(url.protocol!=="https:"||!['instagram.com','www.instagram.com'].includes(url.hostname)||url.username||url.password||url.port||path.length!==1||['p','reel','reels','stories','tv','accounts','explore','direct'].includes(path[0]))throw Object.assign(new Error("Cole o link do perfil, como https://www.instagram.com/concorrente/, ou informe o @."),{status:400});
  text=path[0];
 }
 return normalizeUsername(text);
}
export function publicCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
export function interactions(post: CompetitorPost) {
  return post.like_count === null || post.comments_count === null
    ? null
    : post.like_count + post.comments_count;
}
// Same profile, format and selected publication window; incomplete metrics never become zero.
export function rankPosts(posts: CompetitorPost[]) {
  return posts
    .map((post) => {
      const cohort = posts.filter(
        (p) =>
          p.profile_id === post.profile_id && p.media_type === post.media_type,
      );
      const values = cohort
        .map(interactions)
        .filter((v): v is number => v !== null);
      const mean = values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
      const total = interactions(post);
      return {
        ...post,
        interactions: total,
        baseline: mean,
        sample: values.length,
        score:
          values.length >= 5 && mean !== null && mean > 0 && total !== null
            ? total / mean
            : null,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
export function safeInstagramLink(value: unknown): string | null {
  try {
    const u = new URL(String(value));
    return u.protocol === "https:" &&
      ["instagram.com", "www.instagram.com"].includes(u.hostname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}

export function safeMediaPreview(value: unknown): string | null {
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.searchParams.has("access_token")) return null;
    return ["cdninstagram.com", "fbcdn.net"].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : null;
  } catch { return null; }
}

export function instagramEmbed(value: unknown): string | null {
  const link = safeInstagramLink(value);
  if (!link) return null;
  const match = new URL(link).pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/);
  return match ? `https://www.instagram.com/${match[1]}/${match[2]}/embed/` : null;
}
