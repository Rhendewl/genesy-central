import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { aggregateTrafficReport, type TrafficReportCampaignRow, type TrafficReportMetricRow } from "@/lib/traffic-report";

export const dynamic = "force-dynamic";

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()));
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");
  const accountId = request.nextUrl.searchParams.get("platform_account_id");
  const since = request.nextUrl.searchParams.get("since");
  const until = request.nextUrl.searchParams.get("until");
  if (!clientId || !validDate(since) || !validDate(until)) return NextResponse.json({ error: "Cliente e período são obrigatórios" }, { status: 400 });
  const start = new Date(`${since}T12:00:00`);
  const end = new Date(`${until}T12:00:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days < 0 || days > 366) return NextResponse.json({ error: "Selecione um período de até 12 meses" }, { status: 400 });

  const [{ data: client }, { data: accounts }] = await Promise.all([
    supabase.from("agency_clients").select("id,name").eq("id", clientId).maybeSingle(),
    supabase.from("ad_platform_accounts").select("id,account_name").eq("client_id", clientId).eq("platform", "meta").eq("status", "connected"),
  ]);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const selectedAccounts = accountId ? (accounts ?? []).filter((account) => account.id === accountId) : (accounts ?? []);
  if (!selectedAccounts.length) return NextResponse.json({ error: "Nenhuma conta Meta conectada para este cliente" }, { status: 400 });

  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id,name,status")
    .in("platform_account_id", selectedAccounts.map((account) => account.id));
  if (campaignsError) return NextResponse.json({ error: campaignsError.message }, { status: 400 });
  const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);
  const { data: metrics, error: metricsError } = campaignIds.length
    ? await supabase.from("campaign_metrics").select("campaign_id,spend,leads,impressions,reach,clicks,link_clicks,conversions,unique_ctr").in("campaign_id", campaignIds).gte("date", since).lte("date", until)
    : { data: [], error: null };
  if (metricsError) return NextResponse.json({ error: metricsError.message }, { status: 400 });
  if (!(metrics ?? []).length) return NextResponse.json({ error: "Não encontramos métricas para esta conta no período selecionado. Confirme se houve veiculação na Meta e tente sincronizar novamente." }, { status: 422 });

  const report = aggregateTrafficReport({
    clientName: client.name,
    accountName: selectedAccounts.length === 1 ? selectedAccounts[0].account_name : null,
    since,
    until,
    campaigns: (campaigns ?? []) as TrafficReportCampaignRow[],
    metrics: (metrics ?? []) as TrafficReportMetricRow[],
  });
  return NextResponse.json({ report }, { headers: { "Cache-Control": "private, no-store" } });
}
