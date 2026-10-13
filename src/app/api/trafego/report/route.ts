import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DEFAULT_CAMPAIGN_PARSER, extractDevelopmentName } from "@/lib/clientes/commercial-intelligence";
import { aggregateTrafficReport, buildTrafficReportCampaignOptions, type TrafficReportCampaignRow, type TrafficReportMetricRow } from "@/lib/traffic-report";

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
  const campaignOptionsOnly = request.nextUrl.searchParams.get("campaign_options") === "1";
  const requestedCampaignIds = request.nextUrl.searchParams.getAll("campaign_id").filter(Boolean);
  const since = request.nextUrl.searchParams.get("since");
  const until = request.nextUrl.searchParams.get("until");
  if ((!clientId && !accountId) || !validDate(since) || !validDate(until)) return NextResponse.json({ error: "Selecione uma conta ou cliente e o período" }, { status: 400 });
  const start = new Date(`${since}T12:00:00`);
  const end = new Date(`${until}T12:00:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days < 0 || days > 366) return NextResponse.json({ error: "Selecione um período de até 12 meses" }, { status: 400 });

  // A selected account defines the data scope. The optional client only names
  // the report; generating it never changes the account's persistent linkage.
  let accountsQuery = supabase.from("ad_platform_accounts").select("id,account_name")
    .eq("user_id", user.id).eq("platform", "meta").eq("status", "connected");
  accountsQuery = accountId ? accountsQuery.eq("id", accountId) : accountsQuery.eq("client_id", clientId!);
  const [{ data: client, error: clientError }, { data: accounts, error: accountsError }] = await Promise.all([
    clientId ? supabase.from("agency_clients").select("id,name").eq("id", clientId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    accountsQuery,
  ]);
  if (clientError || accountsError) return NextResponse.json({ error: "Não foi possível carregar o cliente ou as contas" }, { status: 400 });
  if (clientId && !client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const selectedAccounts = accounts ?? [];
  if (!selectedAccounts.length) return NextResponse.json({ error: "Nenhuma conta Meta conectada disponível para esta seleção" }, { status: 400 });

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

  const campaignRows = (campaigns ?? []) as TrafficReportCampaignRow[];
  const metricRows = (metrics ?? []) as TrafficReportMetricRow[];
  if (campaignOptionsOnly) {
    return NextResponse.json({ campaigns: buildTrafficReportCampaignOptions(campaignRows, metricRows) }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const allowedCampaignIds = new Set(campaignRows.map((campaign) => campaign.id));
  const selectedCampaignIds = requestedCampaignIds.length
    ? new Set(requestedCampaignIds.filter((campaignId) => allowedCampaignIds.has(campaignId)))
    : allowedCampaignIds;
  if (!selectedCampaignIds.size) return NextResponse.json({ error: "Selecione ao menos uma campanha válida para o relatório" }, { status: 400 });
  const selectedCampaigns = campaignRows.filter((campaign) => selectedCampaignIds.has(campaign.id));
  const selectedMetrics = metricRows.filter((metric) => selectedCampaignIds.has(metric.campaign_id));
  if (!selectedMetrics.length) return NextResponse.json({ error: "As campanhas selecionadas não possuem métricas no período" }, { status: 422 });
  const parserPattern = DEFAULT_CAMPAIGN_PARSER;
  const parserGroup = 1;
  const campaignDisplayNames = Object.fromEntries(selectedCampaigns.map((campaign) => [
    campaign.id,
    extractDevelopmentName(campaign.name, parserPattern, parserGroup) ?? campaign.name,
  ]));

  const report = aggregateTrafficReport({
    clientName: client?.name ?? selectedAccounts[0].account_name,
    accountName: selectedAccounts.length === 1 ? selectedAccounts[0].account_name : null,
    since,
    until,
    campaigns: selectedCampaigns,
    metrics: selectedMetrics,
    campaignDisplayNames,
  });
  return NextResponse.json({ report }, { headers: { "Cache-Control": "private, no-store" } });
}
