import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { decryptToken } from "@/lib/crypto";
import { getAdsWithCreatives } from "@/lib/meta-api";
import type { MetaAdWithCreative } from "@/lib/meta-api";
import { startOfMonth, format } from "date-fns";
import type { PortalCreative } from "@/types";

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function pickBestAdImage(creative: MetaAdWithCreative["creative"], logLabel?: string): string | null {
  if (!creative) return null;

  const eff = creative.effective_object_story_spec;
  if (eff?.link_data?.picture)         { if (logLabel) console.log(`[${logLabel}] img via eff.link_data.picture`);         return eff.link_data.picture; }
  if (eff?.link_data?.image_url)       { if (logLabel) console.log(`[${logLabel}] img via eff.link_data.image_url`);       return eff.link_data.image_url; }
  if (eff?.video_data?.image_url)      { if (logLabel) console.log(`[${logLabel}] img via eff.video_data.image_url`);      return eff.video_data.image_url; }
  if (eff?.video_data?.thumbnail_url)  { if (logLabel) console.log(`[${logLabel}] img via eff.video_data.thumbnail_url`);  return eff.video_data.thumbnail_url; }
  if (eff?.photo_data?.images?.[0]?.url) { if (logLabel) console.log(`[${logLabel}] img via eff.photo_data`);             return eff.photo_data!.images![0].url!; }
  if (eff?.template_data?.link_data?.picture) { if (logLabel) console.log(`[${logLabel}] img via eff.template_data`);     return eff.template_data!.link_data!.picture!; }

  const spec = creative.object_story_spec;
  if (spec?.link_data?.picture)        { if (logLabel) console.log(`[${logLabel}] img via spec.link_data.picture`);        return spec.link_data.picture; }
  if (spec?.link_data?.image_url)      { if (logLabel) console.log(`[${logLabel}] img via spec.link_data.image_url`);      return spec.link_data.image_url; }
  if (spec?.video_data?.image_url)     { if (logLabel) console.log(`[${logLabel}] img via spec.video_data.image_url`);     return spec.video_data.image_url; }
  if (spec?.video_data?.thumbnail_url) { if (logLabel) console.log(`[${logLabel}] img via spec.video_data.thumbnail_url`); return spec.video_data.thumbnail_url; }
  if (spec?.photo_data?.images?.[0]?.url) { if (logLabel) console.log(`[${logLabel}] img via spec.photo_data`);           return spec.photo_data!.images![0].url!; }

  // asset_feed_spec — Dynamic/Advantage+ and Lead Ads that skip object_story_spec
  const feed = creative.asset_feed_spec;
  if (feed?.images?.[0]?.url)          { if (logLabel) console.log(`[${logLabel}] img via asset_feed_spec.images`);        return feed.images[0].url!; }
  if (feed?.videos?.[0]?.thumbnail_url){ if (logLabel) console.log(`[${logLabel}] img via asset_feed_spec.videos`);        return feed.videos[0].thumbnail_url!; }

  if (creative.image_url)              { if (logLabel) console.log(`[${logLabel}] img via creative.image_url`);            return creative.image_url; }
  if (creative.thumbnail_url)          { if (logLabel) console.log(`[${logLabel}] img via creative.thumbnail_url`);        return creative.thumbnail_url; }

  if (logLabel) console.log(`[${logLabel}] no image found. creative keys: ${Object.keys(creative).join(",")}`);
  return null;
}

// GET /api/portal/[slug]/creatives — public endpoint, no auth required
// Metrics from Supabase (always). Thumbnails: Supabase first, Meta API fallback.
// Query params: since, until (YYYY-MM-DD)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const sp = req.nextUrl.searchParams;

    let admin;
    let db: ReturnType<typeof createAnonClient>;
    try {
      admin = createAdminSupabaseClient();
      db = admin;
    } catch {
      db = createAnonClient();
    }

    // 1. Portal
    const { data: rawPortal } = await db
      .from("portals")
      .select("id, user_id, status")
      .eq("slug", slug)
      .maybeSingle();

    if (!rawPortal || rawPortal.status === "pausado") {
      return NextResponse.json({ creatives: [] });
    }
    if (!admin) {
      return NextResponse.json({ creatives: [] });
    }

    // 2. Date range
    const now = new Date();
    const since = sp.get("since") || format(startOfMonth(now), "yyyy-MM-dd");
    const until = sp.get("until") || format(now, "yyyy-MM-dd");

    // 3. Linked accounts
    const { data: portalAccounts } = await admin
      .from("portal_accounts")
      .select("ad_account_id")
      .eq("portal_id", rawPortal.id);

    const allowedAccountIds = (portalAccounts ?? []).map(
      (pa: { ad_account_id: string }) => pa.ad_account_id
    );
    if (!allowedAccountIds.length) return NextResponse.json({ creatives: [] });

    // 4. Platform accounts — include account_id for Meta API fallback
    const { data: platformAccounts } = await admin
      .from("ad_platform_accounts")
      .select("id, account_id")
      .eq("user_id", rawPortal.user_id)
      .in("account_id", allowedAccountIds);

    if (!platformAccounts?.length) return NextResponse.json({ creatives: [] });

    const platformAccountIds = platformAccounts.map((pa: { id: string }) => pa.id);

    // 5. Campaigns — base query with columns that always exist
    const { data: campaignsRaw } = await admin
      .from("campaigns")
      .select("id, name, status, external_id")
      .in("platform_account_id", platformAccountIds);

    if (!campaignsRaw?.length) return NextResponse.json({ creatives: [] });

    type CampaignRow = { id: string; name: string; status: string; external_id: string | null };
    const campaignMap = new Map<string, CampaignRow>();
    campaignsRaw.forEach((c: CampaignRow) => campaignMap.set(c.id, c));
    const campaignIds = Array.from(campaignMap.keys());

    // 6. Thumbnail map — try to load from Supabase (populated after migration + sync)
    //    Silently skipped if the thumbnail_url column doesn't exist yet.
    const thumbnailMap = new Map<string, string>();
    const { data: thumbRows, error: thumbColErr } = await admin
      .from("campaigns")
      .select("id, thumbnail_url")
      .in("id", campaignIds)
      .not("thumbnail_url", "is", null);

    if (!thumbColErr) {
      for (const t of thumbRows ?? []) {
        if (t.thumbnail_url) thumbnailMap.set(t.id, t.thumbnail_url as string);
      }
    }

    console.log(`[portal/creatives] ${thumbnailMap.size}/${campaignIds.length} thumbs from Supabase`);

    // 7. Aggregate metrics
    const { data: metricsRaw } = await admin
      .from("campaign_metrics")
      .select("campaign_id, spend, leads, clicks, reach, impressions")
      .in("campaign_id", campaignIds)
      .gte("date", since)
      .lte("date", until);

    type Agg = { spend: number; leads: number; clicks: number; reach: number; impressions: number };
    const agg = new Map<string, Agg>();
    for (const m of metricsRaw ?? []) {
      const ex = agg.get(m.campaign_id);
      agg.set(m.campaign_id, {
        spend:       (ex?.spend       ?? 0) + Number(m.spend       ?? 0),
        leads:       (ex?.leads       ?? 0) + Number(m.leads       ?? 0),
        clicks:      (ex?.clicks      ?? 0) + Number(m.clicks      ?? 0),
        reach:       (ex?.reach       ?? 0) + Number(m.reach       ?? 0),
        impressions: (ex?.impressions ?? 0) + Number(m.impressions ?? 0),
      });
    }

    // 8. Build initial list (top 8 ranked)
    const creatives: PortalCreative[] = [];
    for (const [campaignId, totals] of Array.from(agg)) {
      if (totals.spend < 0.01 && totals.clicks === 0 && totals.leads === 0) continue;
      const campaign = campaignMap.get(campaignId);
      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
      const cpl = totals.leads  > 0 ? totals.spend / totals.leads  : 0;
      creatives.push({
        ad_id:         campaignId,
        creative_name: campaign?.name ?? campaignId,
        campaign_name: campaign?.name ?? "",
        image_url:     thumbnailMap.get(campaignId) ?? null,
        status:        campaign?.status === "ativa" ? "ativa" : "pausada",
        leads: totals.leads, cpl, spend: totals.spend,
        reach: totals.reach, clicks: totals.clicks, ctr, cpc, ranking: 0,
      });
    }
    creatives.sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads;
      if (b.spend !== a.spend) return b.spend - a.spend;
      if (a.cpl   !== b.cpl)  return a.cpl   - b.cpl;
      return b.ctr - a.ctr;
    });
    creatives.forEach((c, i) => { c.ranking = i + 1; });
    const top8 = creatives.slice(0, 8);

    // 9. Real-time thumbnail enrichment via Meta API (when Supabase has none)
    //    Builds: Meta campaign_id → image_url, then maps to Supabase UUID via external_id
    const needsThumb = top8.filter(c => !c.image_url);
    if (needsThumb.length > 0) {
      try {
        // external_id → Supabase UUID (for matching Meta campaign_id)
        const extIdToUUID = new Map<string, string>();
        for (const [uuid, camp] of Array.from(campaignMap)) {
          if (camp.external_id) extIdToUUID.set(camp.external_id, uuid);
        }

        const { data: tokens } = await admin
          .from("meta_tokens")
          .select("platform_account_id, encrypted_token")
          .in("platform_account_id", platformAccountIds);

        const metaCampThumb = new Map<string, string>(); // Meta campaign_id → img

        for (const t of tokens ?? []) {
          let accessToken: string;
          try { accessToken = decryptToken(t.encrypted_token); } catch { continue; }

          const pa = (platformAccounts as { id: string; account_id: string }[])
            .find(p => p.id === t.platform_account_id);
          if (!pa) continue;

          let ads: Awaited<ReturnType<typeof getAdsWithCreatives>> = [];
          try {
            ads = await getAdsWithCreatives(pa.account_id, accessToken);
          } catch (err) {
            console.warn(`[portal/creatives] Meta API failed for ${pa.account_id}:`, err);
            continue;
          }

          console.log(`[portal/creatives] Meta API: ${ads.length} ads for ${pa.account_id}`);

          // Log first 3 ads raw creative payload for diagnosis
          ads.slice(0, 3).forEach((ad, i) => {
            console.log(`[portal/creatives] ad[${i}] id=${ad.id} campaign=${ad.campaign_id} creative=${JSON.stringify(ad.creative)}`);
          });

          for (const ad of ads) {
            if (!ad.campaign_id || metaCampThumb.has(ad.campaign_id)) continue;
            const label = `portal/creatives ad=${ad.id}`;
            const img = pickBestAdImage(ad.creative, label);
            if (img) metaCampThumb.set(ad.campaign_id, img);
          }
        }

        // Map Meta campaign_id → Supabase UUID → apply to top8
        for (const [metaId, imgUrl] of Array.from(metaCampThumb)) {
          const uuid = extIdToUUID.get(metaId);
          if (!uuid) continue;
          const entry = top8.find(c => c.ad_id === uuid);
          if (entry && !entry.image_url) entry.image_url = imgUrl;
        }

        const enriched = top8.filter(c => c.image_url).length;
        console.log(`[portal/creatives] after Meta API: ${enriched}/${top8.length} with thumbnail`);
      } catch (err) {
        console.warn("[portal/creatives] thumbnail enrichment non-fatal error:", err);
      }
    }

    return NextResponse.json({ creatives: top8 });

  } catch (err) {
    console.error("[portal/creatives] unhandled error:", err);
    return NextResponse.json({ creatives: [] });
  }
}
