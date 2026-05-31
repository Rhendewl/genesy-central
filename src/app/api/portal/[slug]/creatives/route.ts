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

// Extract the best available image URL from a creative object.
// Priority: thumbnail_url → image_url → effective_object_story_spec (resolved) → object_story_spec
function pickBestImage(creative: MetaAdWithCreative["creative"]): string | null {
  if (!creative) return null;
  if (creative.thumbnail_url) return creative.thumbnail_url;
  if (creative.image_url) return creative.image_url;
  const eff = creative.effective_object_story_spec;
  if (eff?.link_data?.picture) return eff.link_data.picture;
  if (eff?.link_data?.image_url) return eff.link_data.image_url;
  if (eff?.video_data?.image_url) return eff.video_data.image_url;
  if (eff?.photo_data?.images?.[0]?.url) return eff.photo_data.images[0].url;
  const spec = creative.object_story_spec;
  if (spec?.link_data?.picture) return spec.link_data.picture;
  if (spec?.link_data?.image_url) return spec.link_data.image_url;
  if (spec?.video_data?.image_url) return spec.video_data.image_url;
  if (spec?.photo_data?.images?.[0]?.url) return spec.photo_data.images[0].url;
  return null;
}

// GET /api/portal/[slug]/creatives — public endpoint, no auth required
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
      console.warn("[portal/creatives] service role key not configured");
      db = createAnonClient();
    }

    // 1. Load portal
    const { data: rawPortal } = await db
      .from("portals")
      .select("id, user_id, status")
      .eq("slug", slug)
      .maybeSingle();

    if (!rawPortal || rawPortal.status === "pausado") {
      return NextResponse.json({ creatives: [] });
    }

    if (!admin) {
      console.error("[portal/creatives] service role key missing");
      return NextResponse.json({ creatives: [] });
    }

    // 2. Date range
    const now = new Date();
    const since = sp.get("since") || format(startOfMonth(now), "yyyy-MM-dd");
    const until = sp.get("until") || format(now, "yyyy-MM-dd");

    console.log(`[portal/creatives] slug="${slug}" range=${since}→${until}`);

    // 3. Allowed ad account IDs for this portal
    const { data: portalAccounts } = await admin
      .from("portal_accounts")
      .select("ad_account_id")
      .eq("portal_id", rawPortal.id);

    const allowedAccountIds = (portalAccounts ?? []).map(
      (pa: { ad_account_id: string }) => pa.ad_account_id
    );

    if (allowedAccountIds.length === 0) {
      console.log(`[portal/creatives] no accounts linked to portal "${slug}"`);
      return NextResponse.json({ creatives: [] });
    }

    // 4. Platform accounts
    const { data: platformAccounts } = await admin
      .from("ad_platform_accounts")
      .select("id, account_id")
      .eq("user_id", rawPortal.user_id)
      .in("account_id", allowedAccountIds);

    if (!platformAccounts?.length) {
      console.log("[portal/creatives] no platform accounts matched:", allowedAccountIds);
      return NextResponse.json({ creatives: [] });
    }

    const platformAccountIds = platformAccounts.map((pa: { id: string }) => pa.id);

    // ── PRIMARY: Supabase campaign-level data ──────────────────────────────────
    // This always works even when the Meta token is expired.
    // We use it as the base; Meta API is only used to enrich with thumbnails.

    const { data: campaignsRaw } = await admin
      .from("campaigns")
      .select("id, name, status")
      .in("platform_account_id", platformAccountIds);

    const campaignMap = new Map<string, { name: string; status: string }>();
    (campaignsRaw ?? []).forEach((c: { id: string; name: string; status: string }) => {
      campaignMap.set(c.id, { name: c.name, status: c.status });
    });

    const campaignIds = Array.from(campaignMap.keys());

    if (campaignIds.length === 0) {
      console.log("[portal/creatives] no campaigns in Supabase for this portal");
      return NextResponse.json({ creatives: [] });
    }

    // Aggregate metrics per campaign across the date range
    const { data: metricsRaw } = await admin
      .from("campaign_metrics")
      .select("campaign_id, spend, leads, clicks, reach, impressions")
      .in("campaign_id", campaignIds)
      .gte("date", since)
      .lte("date", until);

    type CampAgg = { spend: number; leads: number; clicks: number; reach: number; impressions: number };
    const campAgg = new Map<string, CampAgg>();

    for (const m of metricsRaw ?? []) {
      const ex = campAgg.get(m.campaign_id);
      campAgg.set(m.campaign_id, {
        spend:       (ex?.spend       ?? 0) + (m.spend       ?? 0),
        leads:       (ex?.leads       ?? 0) + (m.leads       ?? 0),
        clicks:      (ex?.clicks      ?? 0) + (m.clicks      ?? 0),
        reach:       (ex?.reach       ?? 0) + (m.reach       ?? 0),
        impressions: (ex?.impressions ?? 0) + (m.impressions ?? 0),
      });
    }

    console.log(`[portal/creatives] Supabase: ${campaignMap.size} campaigns, ${campAgg.size} with metrics`);

    // Build initial creatives from campaign data
    const creatives: PortalCreative[] = [];

    for (const [campaignId, agg] of Array.from(campAgg)) {
      if (agg.spend < 0.01 && agg.clicks === 0 && agg.leads === 0) continue;

      const campaign = campaignMap.get(campaignId);
      const ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0;
      const cpc = agg.clicks > 0 ? agg.spend / agg.clicks : 0;
      const cpl = agg.leads > 0 ? agg.spend / agg.leads : 0;

      creatives.push({
        ad_id:         campaignId,
        creative_name: campaign?.name ?? campaignId,
        campaign_name: campaign?.name ?? "",
        image_url:     null,
        status:        campaign?.status === "ativa" ? "ativa" : "pausada",
        leads:         agg.leads,
        cpl,
        spend:         agg.spend,
        reach:         agg.reach,
        clicks:        agg.clicks,
        ctr,
        cpc,
        ranking:       0,
      });
    }

    // Rank: leads desc → spend desc → CPL asc → CTR desc
    creatives.sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads;
      if (b.spend !== a.spend) return b.spend - a.spend;
      if (a.cpl !== b.cpl)    return a.cpl - b.cpl;
      return b.ctr - a.ctr;
    });
    creatives.forEach((c, i) => { c.ranking = i + 1; });

    const top8 = creatives.slice(0, 8);

    // ── OPTIONAL: enrich thumbnails via Meta API ───────────────────────────────
    // Non-blocking: if Meta token is expired or API fails, we still return data.
    // We try to get thumbnails for the campaigns that appear in the top 8.
    try {
      const { data: tokens } = await admin
        .from("meta_tokens")
        .select("platform_account_id, encrypted_token")
        .in("platform_account_id", platformAccountIds);

      if (tokens?.length) {
        // Build a map: campaign_id → image_url using the Meta API for ads
        // We match by campaign_id since the Supabase data is at campaign level
        const campaignImageMap = new Map<string, string>();

        for (const t of tokens) {
          let accessToken: string;
          try {
            accessToken = decryptToken(t.encrypted_token);
          } catch {
            continue;
          }

          const pa = (platformAccounts as { id: string; account_id: string }[])
            .find(p => p.id === t.platform_account_id);
          if (!pa) continue;

          let ads: Awaited<ReturnType<typeof getAdsWithCreatives>> = [];
          try {
            ads = await getAdsWithCreatives(pa.account_id, accessToken);
          } catch (err) {
            console.warn(`[portal/creatives] getAdsWithCreatives failed for ${pa.account_id}:`, err);
            continue;
          }

          console.log(`[portal/creatives] Meta API: ${ads.length} ads for account ${pa.account_id}`);

          for (const ad of ads) {
            const imageUrl = pickBestImage(ad.creative);
            if (imageUrl && ad.campaign_id && !campaignImageMap.has(ad.campaign_id)) {
              campaignImageMap.set(ad.campaign_id, imageUrl);
            }
          }
        }

        // external_id column stores the Meta campaign_id string (saved during sync)
        if (campaignImageMap.size > 0) {
          const { data: campaignsWithExtId } = await admin
            .from("campaigns")
            .select("id, external_id")
            .in("id", campaignIds)
            .not("external_id", "is", null);

          if (campaignsWithExtId?.length) {
            for (const c of campaignsWithExtId as { id: string; external_id: string }[]) {
              const img = campaignImageMap.get(c.external_id);
              if (img) {
                const entry = top8.find(cr => cr.ad_id === c.id);
                if (entry) entry.image_url = img;
              }
            }
            const enriched = top8.filter(c => c.image_url).length;
            console.log(`[portal/creatives] enriched ${enriched}/${top8.length} entries with thumbnails`);
          }
        }
      }
    } catch (enrichErr) {
      console.warn("[portal/creatives] thumbnail enrichment failed (non-fatal):", enrichErr);
    }

    console.log(`[portal/creatives] returning ${top8.length} creatives`);
    return NextResponse.json({ creatives: top8 });

  } catch (err) {
    console.error("[portal/creatives] unhandled error:", err);
    return NextResponse.json({ creatives: [] });
  }
}
