import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { startOfMonth, format } from "date-fns";
import type { PortalCreative } from "@/types";

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

// GET /api/portal/[slug]/creatives — public endpoint, no auth required
// Reads from Supabase (campaign_metrics). Thumbnails are stored during meta-sync.
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

    // 4. Platform accounts for this portal owner
    const { data: platformAccounts } = await admin
      .from("ad_platform_accounts")
      .select("id")
      .eq("user_id", rawPortal.user_id)
      .in("account_id", allowedAccountIds);

    if (!platformAccounts?.length) {
      console.log("[portal/creatives] no platform accounts matched:", allowedAccountIds);
      return NextResponse.json({ creatives: [] });
    }

    const platformAccountIds = platformAccounts.map((pa: { id: string }) => pa.id);

    // 5. Campaigns — base query WITHOUT thumbnail_url so it works even before migration
    const { data: campaignsRaw } = await admin
      .from("campaigns")
      .select("id, name, status")
      .in("platform_account_id", platformAccountIds);

    if (!campaignsRaw?.length) {
      console.log("[portal/creatives] no campaigns for this portal");
      return NextResponse.json({ creatives: [] });
    }

    type CampaignRow = { id: string; name: string; status: string };
    const campaignMap = new Map<string, CampaignRow>();
    campaignsRaw.forEach((c: CampaignRow) => campaignMap.set(c.id, c));
    const campaignIds = Array.from(campaignMap.keys());

    // 6. Thumbnails — optional separate query; silently skipped if column doesn't exist yet
    const thumbnailMap = new Map<string, string>();
    const { data: thumbData, error: thumbErr } = await admin
      .from("campaigns")
      .select("id, thumbnail_url")
      .in("id", campaignIds)
      .not("thumbnail_url", "is", null);

    if (!thumbErr) {
      for (const t of thumbData ?? []) {
        if (t.thumbnail_url) thumbnailMap.set(t.id, t.thumbnail_url as string);
      }
    } else {
      console.warn("[portal/creatives] thumbnail_url column not ready yet (run migration):", thumbErr.message);
    }

    console.log(`[portal/creatives] ${thumbnailMap.size} thumbnails available`);

    // 7. Aggregate campaign_metrics for the date range
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

    console.log(`[portal/creatives] ${campaignMap.size} campaigns, ${agg.size} with metrics`);

    // 8. Build creative entries
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
        leads:         totals.leads,
        cpl,
        spend:         totals.spend,
        reach:         totals.reach,
        clicks:        totals.clicks,
        ctr,
        cpc,
        ranking:       0,
      });
    }

    // 9. Rank: leads desc → spend desc → CPL asc → CTR desc
    creatives.sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads;
      if (b.spend !== a.spend) return b.spend - a.spend;
      if (a.cpl   !== b.cpl)  return a.cpl   - b.cpl;
      return b.ctr - a.ctr;
    });
    creatives.forEach((c, i) => { c.ranking = i + 1; });

    const top8 = creatives.slice(0, 8);
    console.log(`[portal/creatives] returning ${top8.length} creatives, ${top8.filter(c => c.image_url).length} with thumbnail`);

    return NextResponse.json({ creatives: top8 });

  } catch (err) {
    console.error("[portal/creatives] unhandled error:", err);
    return NextResponse.json({ creatives: [] });
  }
}
