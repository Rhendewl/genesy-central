import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { decryptToken } from "@/lib/crypto";
import { getAdsWithCreatives, getCreativeById, getAdImageUrls, getVideoThumbnail } from "@/lib/meta-api";
import type { MetaCreativeExtended } from "@/lib/meta-api";
import { startOfMonth, format } from "date-fns";
import type { PortalCreative } from "@/types";

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function pickBestAdImage(
  creative: MetaCreativeExtended | null | undefined,
  logLabel?: string
): string | null {
  if (!creative) return null;

  function emit(field: string) {
    if (logLabel) console.log(`[${logLabel}] img via ${field}`);
  }

  if (creative.thumbnail_url)     { emit("thumbnail_url");     return creative.thumbnail_url; }
  if (creative.image_url)         { emit("image_url");         return creative.image_url; }

  const spec = creative.object_story_spec;
  if (spec?.link_data?.picture)   { emit("spec.link_data.picture");   return spec.link_data.picture; }
  if (spec?.link_data?.image_url) { emit("spec.link_data.image_url"); return spec.link_data.image_url; }
  // Carousel — first child attachment
  const att = spec?.link_data?.child_attachments?.[0];
  if (att?.picture)               { emit("child_attachments[0].picture");   return att.picture; }
  if (att?.image_url)             { emit("child_attachments[0].image_url"); return att.image_url; }
  if (spec?.video_data?.image_url)     { emit("spec.video_data.image_url");     return spec.video_data.image_url; }
  if (spec?.video_data?.thumbnail_url) { emit("spec.video_data.thumbnail_url"); return spec.video_data.thumbnail_url; }
  if (spec?.photo_data?.images?.[0]?.url) { emit("spec.photo_data"); return spec.photo_data!.images![0].url!; }
  if (spec?.template_data?.link_data?.picture) { emit("spec.template_data"); return spec.template_data!.link_data!.picture!; }

  // asset_feed_spec — Dynamic/Advantage+, Lead Ads, and multi-asset creatives
  const feed = creative.asset_feed_spec;
  if (feed?.images?.[0]?.url)           { emit("asset_feed_spec.images[0].url");   return feed.images[0].url!; }
  if (feed?.videos?.[0]?.thumbnail_url) { emit("asset_feed_spec.videos[0].thumb"); return feed.videos[0].thumbnail_url!; }

  if (logLabel) {
    const specKeys = spec ? Object.keys(spec).join(",") : "none";
    const feedKeys = feed ? Object.keys(feed).join(",") : "none";
    console.log(`[${logLabel}] NO IMAGE — creative keys: ${Object.keys(creative).join(",")}, spec keys: ${specKeys}, feed keys: ${feedKeys}`);
    if (spec?.link_data) console.log(`[${logLabel}] link_data keys: ${Object.keys(spec.link_data).join(",")}`);
    if (feed?.images?.length) console.log(`[${logLabel}] feed.images[0] keys: ${Object.keys(feed.images[0]).join(",")}`);
  }
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

    // 9. Real-time thumbnail enrichment — 4 phases, all non-fatal
    const needsThumb = top8.filter(c => !c.image_url);
    if (needsThumb.length > 0) {
      try {
        const extIdToUUID = new Map<string, string>();
        for (const [uuid, camp] of Array.from(campaignMap)) {
          if (camp.external_id) extIdToUUID.set(camp.external_id, uuid);
        }

        // Meta campaign IDs we actually need thumbnails for
        const neededMetaIds = new Set(
          needsThumb
            .map(c => campaignMap.get(c.ad_id)?.external_id)
            .filter((x): x is string => Boolean(x))
        );

        const { data: tokens } = await admin
          .from("meta_tokens")
          .select("platform_account_id, encrypted_token")
          .in("platform_account_id", platformAccountIds);

        const metaCampThumb = new Map<string, string>();

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

          console.log(`[portal/creatives] ${ads.length} ads for ${pa.account_id}`);

          // ── Phase 1: pickBestAdImage from nested creative fields ──────────
          const stuckAds: typeof ads = [];
          for (const ad of ads) {
            if (!ad.campaign_id) continue;
            if (metaCampThumb.has(ad.campaign_id)) continue;
            const img = pickBestAdImage(ad.creative, `P1 ad=${ad.id}`);
            if (img) {
              metaCampThumb.set(ad.campaign_id, img);
            } else if (neededMetaIds.has(ad.campaign_id)) {
              stuckAds.push(ad);
              // Full creative payload for stuck ads
              console.log(`[portal/creatives] P1-stuck ad=${ad.id} campaign=${ad.campaign_id} creative=${JSON.stringify(ad.creative)}`);
            }
          }
          console.log(`[portal/creatives] P1 done: ${metaCampThumb.size} resolved, ${stuckAds.length} stuck`);

          // ── Phase 2: batch resolve image_hash → CDN URL ───────────────────
          const hashEntries = stuckAds
            .filter(ad => ad.creative?.image_hash && !metaCampThumb.has(ad.campaign_id))
            .map(ad => ({ ad, hash: ad.creative!.image_hash! }));

          if (hashEntries.length > 0) {
            const uniqueHashes = Array.from(new Set(hashEntries.map(e => e.hash)));
            const hashToUrl = await getAdImageUrls(pa.account_id, uniqueHashes, accessToken);
            for (const { ad, hash } of hashEntries) {
              if (metaCampThumb.has(ad.campaign_id)) continue;
              const url = hashToUrl.get(hash);
              if (url) {
                console.log(`[portal/creatives] P2 ad=${ad.id} resolved via image_hash`);
                metaCampThumb.set(ad.campaign_id, url);
              }
            }
          }

          // ── Phase 3: secondary creative fetch via /{creative_id} ──────────
          const phase3Ads = stuckAds.filter(
            ad => !metaCampThumb.has(ad.campaign_id) && ad.creative?.id
          );
          const phase3Results = await Promise.all(
            phase3Ads.map(ad =>
              getCreativeById(ad.creative!.id!, accessToken).then(ext => ({ ad, ext }))
            )
          );
          for (const { ad, ext } of phase3Results) {
            if (!ext || metaCampThumb.has(ad.campaign_id)) continue;
            console.log(`[portal/creatives] P3 ad=${ad.id} extended creative=${JSON.stringify(ext)}`);
            const img = pickBestAdImage(ext, `P3 ad=${ad.id}`);
            if (img) {
              metaCampThumb.set(ad.campaign_id, img);
              continue;
            }

            // ── Phase 4: video thumbnail via /{video_id}/thumbnails ─────────
            const videoId =
              ext.object_story_spec?.video_data?.video_id ??
              ext.asset_feed_spec?.videos?.[0]?.video_id;
            if (videoId) {
              const thumb = await getVideoThumbnail(videoId, accessToken);
              if (thumb) {
                console.log(`[portal/creatives] P4 ad=${ad.id} resolved via video thumbnail`);
                metaCampThumb.set(ad.campaign_id, thumb);
              } else {
                console.log(`[portal/creatives] P4 ad=${ad.id} video thumbnail also empty (videoId=${videoId})`);
              }
            } else {
              console.log(`[portal/creatives] P4 ad=${ad.id} no video_id — all phases exhausted`);
            }
          }
        }

        // Apply results to top8
        for (const [metaId, imgUrl] of Array.from(metaCampThumb)) {
          const uuid = extIdToUUID.get(metaId);
          if (!uuid) continue;
          const entry = top8.find(c => c.ad_id === uuid);
          if (entry && !entry.image_url) entry.image_url = imgUrl;
        }

        const enriched = top8.filter(c => c.image_url).length;
        console.log(`[portal/creatives] final: ${enriched}/${top8.length} with thumbnail`);
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
