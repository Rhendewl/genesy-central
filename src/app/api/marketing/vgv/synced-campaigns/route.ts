import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";

const validDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

export async function GET(req: NextRequest) {
  const db = await createServerSupabaseClient();
  try {
    await getMarketingServerContext(db);
    const start = req.nextUrl.searchParams.get("start");
    const end = req.nextUrl.searchParams.get("end");
    if (!validDate(start) || !validDate(end) || start >= end) throw Object.assign(new Error("Período inválido"), { status: 400 });
    const { data: accounts, error: accountError } = await db.from("ad_platform_accounts").select("id,client_id,client:agency_clients(name)").eq("platform", "meta").eq("status", "connected").not("client_id", "is", null);
    if (accountError) throw new Error(accountError.message);
    const accountIds = (accounts ?? []).map((account) => account.id);
    if (!accountIds.length) return NextResponse.json({ campaigns: [] });
    const { data: campaigns, error: campaignError } = await db.from("campaigns").select("id,name,platform_account_id").in("platform_account_id", accountIds);
    if (campaignError) throw new Error(campaignError.message);
    const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);
    const { data: metrics, error: metricError } = campaignIds.length
      ? await db.from("campaign_metrics").select("campaign_id,spend,leads").in("campaign_id", campaignIds).gte("date", start).lt("date", end)
      : { data: [], error: null };
    if (metricError) throw new Error(metricError.message);
    const accountById = new Map((accounts ?? []).map((account) => [account.id, account]));
    const totals = new Map<string, { spend: number; leads: number }>();
    for (const metric of metrics ?? []) {
      const total = totals.get(metric.campaign_id) ?? { spend: 0, leads: 0 };
      total.spend += Number(metric.spend) || 0;
      total.leads += Number(metric.leads) || 0;
      totals.set(metric.campaign_id, total);
    }
    const result = (campaigns ?? []).flatMap((campaign) => {
      const account = accountById.get(campaign.platform_account_id);
      const total = totals.get(campaign.id);
      if (!account?.client_id || !total) return [];
      const relation = account.client as unknown as { name?: string } | Array<{ name?: string }> | null;
      const clientName = Array.isArray(relation) ? relation[0]?.name : relation?.name;
      return [{ id: campaign.id, agency_client_id: account.client_id, client_name: clientName ?? "Cliente", campaign_name: campaign.name, spend: total.spend, leads: total.leads }];
    });
    return NextResponse.json({ campaigns: result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status }); }
}
