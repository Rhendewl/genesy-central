import type { InstagramMedia } from "@/lib/instagram-api";

/** A post as shown in the automation post picker. */
export type AutomationPost = {
  id: string; caption: string; type: "reel" | "carousel" | "video" | "image";
  thumbnail: string | null; permalink: string | null; publishedAt: string; comments: number;
};

export function toAutomationPost(media: InstagramMedia): AutomationPost {
  const type = media.media_product_type === "REELS" ? "reel"
    : media.media_type === "CAROUSEL_ALBUM" ? "carousel" : media.media_type === "VIDEO" ? "video" : "image";
  return {
    id: media.id,
    caption: (media.caption ?? "").slice(0, 280),
    type,
    thumbnail: media.thumbnail_url ?? (media.media_type === "VIDEO" ? null : media.media_url ?? null),
    permalink: media.permalink ?? null,
    publishedAt: media.timestamp,
    comments: Number(media.comments_count ?? 0),
  };
}

