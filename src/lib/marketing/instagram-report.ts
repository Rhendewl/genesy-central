import { format } from "date-fns";
import type { MarketingInstagramAccountTotals, MarketingInstagramDailyInsight, MarketingInstagramMedia } from "@/types/marketing";

const number = (value: number) => Number(value) || 0;

export function instagramReport(media: MarketingInstagramMedia[], account?: MarketingInstagramAccountTotals | null, dailyInsights: MarketingInstagramDailyInsight[] = []) {
  const contentTotals = media.reduce((sum, item) => ({
    reach: sum.reach + number(item.reach),
    views: sum.views + Math.max(number(item.views), number(item.plays)),
    interactions: sum.interactions + number(item.total_interactions),
    likes: sum.likes + number(item.likes),
    comments: sum.comments + number(item.comments),
    saved: sum.saved + number(item.saved),
    shares: sum.shares + number(item.shares),
  }), { reach: 0, views: 0, interactions: 0, likes: 0, comments: 0, saved: 0, shares: 0 });

  const totals = account ? {
    reach: number(account.reach), views: number(account.views), interactions: number(account.total_interactions),
    accountsEngaged: number(account.accounts_engaged), profileViews: number(account.profile_views), profileLinksTaps: number(account.profile_links_taps),
    likes: number(account.likes), comments: number(account.comments), saved: number(account.saves), shares: number(account.shares),
  } : { ...contentTotals, accountsEngaged: 0, profileViews: 0, profileLinksTaps: 0 };

  const contentDaily = new Map<string, { date: string; reach: number; views: number; interactions: number; posts: number }>();
  for (const item of [...media].reverse()) {
    const key = format(new Date(item.published_at), "yyyy-MM-dd");
    const current = contentDaily.get(key) ?? { date: format(new Date(item.published_at), "dd/MM"), reach: 0, views: 0, interactions: 0, posts: 0 };
    current.reach += number(item.reach);
    current.views += Math.max(number(item.views), number(item.plays));
    current.interactions += number(item.total_interactions);
    current.posts += 1;
    contentDaily.set(key, current);
  }

  const formats = new Map<string, { name: string; publications: number; reach: number }>();
  for (const item of media) {
    const raw = item.media_product_type || item.media_type;
    const label = raw === "REELS" || item.media_type === "VIDEO" ? "Reels" : item.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : "Estático";
    const current = formats.get(label) ?? { name: label, publications: 0, reach: 0 };
    current.publications += 1;
    current.reach += number(item.reach);
    formats.set(label, current);
  }

  const accountDaily = dailyInsights.map((item) => {
    const content = contentDaily.get(item.insight_date);
    return {
      date: format(new Date(`${item.insight_date}T12:00:00`), "dd/MM"),
      reach: number(item.reach),
      views: number(item.views),
      interactions: number(item.total_interactions) || content?.interactions || 0,
      followers: number(item.follower_count),
      posts: content?.posts ?? 0,
    };
  });

  return {
    totals,
    contentTotals,
    engagementRate: totals.reach ? ((totals.accountsEngaged || totals.interactions) / totals.reach) * 100 : 0,
    profileConversionRate: totals.reach ? (totals.profileViews / totals.reach) * 100 : 0,
    averageInteractions: media.length ? contentTotals.interactions / media.length : 0,
    daily: accountDaily.length ? accountDaily : Array.from(contentDaily.values()).map((item) => ({ ...item, followers: 0 })),
    contentDaily: Array.from(contentDaily.values()),
    formats: ["Estático", "Carrossel", "Reels"].map((name) => formats.get(name) ?? { name, publications: 0, reach: 0 }),
    best: [...media].sort((a, b) => number(b.total_interactions) - number(a.total_interactions)).slice(0, 6),
  };
}
