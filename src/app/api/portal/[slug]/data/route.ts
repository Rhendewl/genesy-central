import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { startOfMonth, format } from "date-fns";

// Anon client — reads public tables (portals, portal_accounts have SELECT USING true)
// Does NOT require SUPABASE_SERVICE_ROLE_KEY
function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

// GET /api/portal/[slug]/data — public endpoint, no auth required
// Query params: since, until, account_id, campaign_id, status
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
  const { slug } = await params;
  const sp = req.nextUrl.searchParams;

  // Use anon client for public tables — portals & portal_accounts have SELECT USING(true)
  // This never requires SUPABASE_SERVICE_ROLE_KEY
  const anon = createAnonClient();

  // 1. Load portal by slug
  const { data: rawPortal, error: portalErr } = await anon
    .from("portals")
    .select("id, user_id, name, status, client_id")
    .eq("slug", slug)
    .maybeSingle();

  if (portalErr) {
    console.error("[portal/data] portals query error:", portalErr);
    return NextResponse.json({ error: "Portal não encontrado" }, { status: 404 });
  }
  if (!rawPortal) {
    return NextResponse.json({ error: "Portal não encontrado" }, { status: 404 });
  }

  if (rawPortal.status === "pausado") {
    return NextResponse.json({ error: "Portal pausado" }, { status: 403 });
  }

  // Load client name (also public via agency_clients — owner's data, but safe since name only)
  let clientName: string | null = null;
  if (rawPortal.client_id) {
    const { data: clientData } = await anon
      .from("agency_clients")
      .select("name")
      .eq("id", rawPortal.client_id)
      .maybeSingle();
    clientName = clientData?.name ?? null;
  }

  // 2. Load allowed ad_account_ids — portal_accounts has SELECT USING(true)
  const { data: portalAccounts } = await anon
    .from("portal_accounts")
    .select("ad_account_id")
    .eq("portal_id", rawPortal.id);

  const allowedAccountIds: string[] = (portalAccounts ?? []).map(
    (pa: { ad_account_id: string }) => pa.ad_account_id
  );

  if (allowedAccountIds.length === 0) {
    return NextResponse.json(buildEmptyResponse(rawPortal.name, clientName, rawPortal.status));
  }

  // 3. Campaign data requires service role — graceful fallback if key not configured
  let admin;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY not set — return portal info with empty metrics
    console.warn("[portal/data] service role key not configured — returning empty metrics");
    return NextResponse.json(buildEmptyResponse(rawPortal.name, clientName, rawPortal.status));
  }

  // Find ad_platform_accounts records (scoped to portal owner for security)
  const { data: platformAccounts } = await admin
    .from("ad_platform_accounts")
    .select("id, account_id, account_name")
    .eq("user_id", rawPortal.user_id)
    .in("account_id", allowedAccountIds);

  const platformAccountIds = (platformAccounts ?? []).map(
    (pa: { id: string }) => pa.id
  );

  // 4. Parse date range (default: current month)
  const now = new Date();
  const defaultSince = format(startOfMonth(now), "yyyy-MM-dd");
  const defaultUntil = format(now, "yyyy-MM-dd");

  const since = sp.get("since") || defaultSince;
  const until = sp.get("until") || defaultUntil;
  const filterAccountId = sp.get("account_id") || null;
  const filterCampaignId = sp.get("campaign_id") || null;
  const filterStatus = sp.get("status") || null; // "ativa" | "pausada" | null

  // Resolve platform_account_id filter from account_id filter
  let filteredPlatformAccountIds = platformAccountIds;
  if (filterAccountId && platformAccounts) {
    const filtered = (platformAccounts as { id: string; account_id: string }[])
      .filter(pa => pa.account_id === filterAccountId)
      .map(pa => pa.id);
    filteredPlatformAccountIds = filtered;
  }

  if (filteredPlatformAccountIds.length === 0) {
    return NextResponse.json(buildEmptyResponse(rawPortal.name, clientName, rawPortal.status));
  }

  // 5. Get campaigns for these platform accounts
  let campaignsQuery = admin
    .from("campaigns")
    .select("id, name, status, platform_account_id")
    .in("platform_account_id", filteredPlatformAccountIds);

  if (filterStatus) {
    campaignsQuery = campaignsQuery.eq("status", filterStatus);
  }
  if (filterCampaignId) {
    campaignsQuery = campaignsQuery.eq("id", filterCampaignId);
  }

  const { data: campaigns } = await campaignsQuery;
  const campaignMap = new Map<string, { name: string; status: string }>();
  (campaigns ?? []).forEach((c: { id: string; name: string; status: string }) => {
    campaignMap.set(c.id, { name: c.name, status: c.status });
  });

  const campaignIds = Array.from(campaignMap.keys());

  // 6. Get all available campaigns (for filter dropdown — no status filter)
  const { data: allCampaigns } = await admin
    .from("campaigns")
    .select("id, name, status")
    .in("platform_account_id", filteredPlatformAccountIds)
    .order("name");

  // 7. Fetch campaign metrics
  const metricsData: {
    campaign_id: string;
    date: string;
    spend: number;
    leads: number;
    clicks: number;
    link_clicks: number;
    impressions: number;
    reach: number;
    unique_ctr: number;
    ctr: number;
  }[] = [];

  if (campaignIds.length > 0) {
    const { data: metrics } = await admin
      .from("campaign_metrics")
      .select("campaign_id, date, spend, leads, clicks, link_clicks, impressions, reach, unique_ctr, ctr")
      .in("campaign_id", campaignIds)
      .gte("date", since)
      .lte("date", until)
      .order("date", { ascending: true });

    metricsData.push(...(metrics ?? []));
  }

  // 8. Aggregate KPIs
  let totalSpend = 0;
  let totalLeads = 0;
  let totalClicks = 0;
  let totalImpressions = 0;
  let totalReach = 0;

  const dailyMap = new Map<string, { investimento: number; leads: number; cliques: number }>();

  for (const m of metricsData) {
    totalSpend += m.spend || 0;
    totalLeads += m.leads || 0;
    totalClicks += m.link_clicks || m.clicks || 0;
    totalImpressions += m.impressions || 0;
    totalReach += m.reach || 0;

    const existing = dailyMap.get(m.date) ?? { investimento: 0, leads: 0, cliques: 0 };
    dailyMap.set(m.date, {
      investimento: existing.investimento + (m.spend || 0),
      leads: existing.leads + (m.leads || 0),
      cliques: existing.cliques + (m.link_clicks || m.clicks || 0),
    });
  }

  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // 9. Build daily array (fill gaps with 0s)
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, vals]) => ({
      data,
      investimento: vals.investimento,
      leads: vals.leads,
      cpl: vals.leads > 0 ? vals.investimento / vals.leads : 0,
    }));

  // 10. Per-campaign summary
  const campaignStatsMap = new Map<string, {
    investimento: number; leads: number; cliques: number; impressoes: number;
  }>();

  for (const m of metricsData) {
    const s = campaignStatsMap.get(m.campaign_id) ?? {
      investimento: 0, leads: 0, cliques: 0, impressoes: 0,
    };
    campaignStatsMap.set(m.campaign_id, {
      investimento: s.investimento + (m.spend || 0),
      leads: s.leads + (m.leads || 0),
      cliques: s.cliques + (m.link_clicks || m.clicks || 0),
      impressoes: s.impressoes + (m.impressions || 0),
    });
  }

  const campaignSummaries = Array.from(campaignStatsMap.entries()).map(([cid, stats]) => {
    const meta = campaignMap.get(cid) ?? { name: "Campanha", status: "desconhecida" };
    const campCpl = stats.leads > 0 ? stats.investimento / stats.leads : 0;
    const campCtr = stats.impressoes > 0 ? (stats.cliques / stats.impressoes) * 100 : 0;
    return {
      id: cid,
      nome: meta.name,
      status: meta.status,
      investimento: stats.investimento,
      leads: stats.leads,
      cpl: campCpl,
      ctr: campCtr,
      impressoes: stats.impressoes,
      cliques: stats.cliques,
    };
  });

  campaignSummaries.sort((a, b) => b.leads - a.leads);

  // 11. Geographic metrics aggregation
  const geoMap = new Map<string, { spend: number; leads: number; clicks: number; impressions: number; reach: number }>();

  if (campaignIds.length > 0) {
    const { data: geoMetrics } = await admin
      .from("campaign_geo_metrics")
      .select("region, spend, leads, clicks, link_clicks, impressions, reach")
      .in("campaign_id", campaignIds)
      .gte("date", since)
      .lte("date", until)
      .not("region", "is", null)
      .neq("region", "");

    for (const g of geoMetrics ?? []) {
      const key = (g.region as string).trim();
      if (!key) continue;
      const existing = geoMap.get(key) ?? { spend: 0, leads: 0, clicks: 0, impressions: 0, reach: 0 };
      geoMap.set(key, {
        spend:       existing.spend       + (g.spend       || 0),
        leads:       existing.leads       + (g.leads       || 0),
        clicks:      existing.clicks      + (g.link_clicks || g.clicks || 0),
        impressions: existing.impressions + (g.impressions || 0),
        reach:       existing.reach       + (g.reach       || 0),
      });
    }
  }

  const geoData = Array.from(geoMap.entries())
    .map(([region, stats]) => ({ region, ...stats }))
    .sort((a, b) => b.leads - a.leads || b.clicks - a.clicks || b.reach - a.reach)
    .slice(0, 10);

  // 12. Available accounts for filter
  const availableAccounts = (platformAccounts ?? []).map(
    (pa: { id: string; account_id: string; account_name: string }) => ({
      id: pa.account_id,
      name: pa.account_name,
    })
  );

  return NextResponse.json({
    portal: {
      name: rawPortal.name,
      client_name: clientName,
      status: rawPortal.status,
    },
    kpis: {
      investimento: totalSpend,
      leads: totalLeads,
      cpl,
      alcance: totalReach,
      cliques: totalClicks,
      ctr,
      impressoes: totalImpressions,
    },
    daily,
    campaigns: campaignSummaries,
    geo: geoData,
    available_accounts: availableAccounts,
    available_campaigns: (allCampaigns ?? []).map(
      (c: { id: string; name: string; status: string }) => ({
        id: c.id,
        name: c.name,
        status: c.status,
      })
    ),
  });
  } catch (err) {
    console.error("[portal/data] unhandled error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

function buildEmptyResponse(name: string, clientName: string | null, status: string) {
  return {
    portal: { name, client_name: clientName, status },
    kpis: { investimento: 0, leads: 0, cpl: 0, alcance: 0, cliques: 0, ctr: 0, impressoes: 0 },
    daily: [],
    campaigns: [],
    geo: [],
    available_accounts: [],
    available_campaigns: [],
  };
}
