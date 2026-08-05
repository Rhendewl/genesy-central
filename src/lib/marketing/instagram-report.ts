import { format } from "date-fns";
import type { MarketingInstagramMedia } from "@/types/marketing";

const number = (value: number) => Number(value) || 0;

export function instagramReport(media: MarketingInstagramMedia[]) {
  const totals = media.reduce((sum, item) => ({
    reach: sum.reach + number(item.reach),
    views: sum.views + Math.max(number(item.views), number(item.plays)),
    interactions: sum.interactions + number(item.total_interactions),
    likes: sum.likes + number(item.likes),
    comments: sum.comments + number(item.comments),
    saved: sum.saved + number(item.saved),
    shares: sum.shares + number(item.shares),
  }), { reach: 0, views: 0, interactions: 0, likes: 0, comments: 0, saved: 0, shares: 0 });

  const daily = new Map<string, { date: string; reach: number; interactions: number; posts: number }>();
  for (const item of [...media].reverse()) {
    const key = format(new Date(item.published_at), "yyyy-MM-dd");
    const current = daily.get(key) ?? { date: format(new Date(item.published_at), "dd/MM"), reach: 0, interactions: 0, posts: 0 };
    current.reach += number(item.reach);
    current.interactions += number(item.total_interactions);
    current.posts += 1;
    daily.set(key, current);
  }

  const formats = new Map<string, number>();
  for (const item of media) {
    const raw = item.media_product_type || item.media_type;
    const label = raw === "REELS" ? "Reels" : raw === "CAROUSEL_ALBUM" ? "Carrossel" : raw === "VIDEO" ? "Vídeo" : "Imagem";
    formats.set(label, (formats.get(label) ?? 0) + 1);
  }

  return {
    totals,
    engagementRate: totals.reach ? (totals.interactions / totals.reach) * 100 : 0,
    daily: Array.from(daily.values()),
    formats: Array.from(formats, ([name, value]) => ({ name, value })),
    best: [...media].sort((a, b) => number(b.total_interactions) - number(a.total_interactions)).slice(0, 6),
  };
}
