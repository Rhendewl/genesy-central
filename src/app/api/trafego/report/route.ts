import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { aggregateTrafficReport, type TrafficReportCampaignRow, type TrafficReportMetricRow } from "@/lib/traffic-report";

export const dynamic = "force-dynamic";

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()));
}

function allowedImageHost(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["fbcdn.net", "facebook.com", "cdninstagram.com"].some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

async function imageDataUrl(value?: string | null) {
  if (!value || !allowedImageHost(value)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(value, { signal: controller.signal });
    const type = response.headers.get("content-type")?.split(";")[0] ?? "";
    const length = Number(response.headers.get("content-length") ?? 0);
    if (!response.ok || !["image/jpeg", "image/png", "image/webp"].includes(type) || length > 4_000_000) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 4_000_000) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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
    .select("id,name,status,thumbnail_url")
    .eq("client_id", clientId)
    .in("platform_account_id", selectedAccounts.map((account) => account.id));
  if (campaignsError) return NextResponse.json({ error: campaignsError.message }, { status: 400 });
  const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);
  const { data: metrics, error: metricsError } = campaignIds.length
    ? await supabase.from("campaign_metrics").select("campaign_id,spend,leads,impressions,reach,clicks,link_clicks,conversions,unique_ctr").in("campaign_id", campaignIds).gte("date", since).lte("date", until)
    : { data: [], error: null };
  if (metricsError) return NextResponse.json({ error: metricsError.message }, { status: 400 });

  const report = aggregateTrafficReport({
    clientName: client.name,
    accountName: selectedAccounts.length === 1 ? selectedAccounts[0].account_name : null,
    since,
    until,
    campaigns: (campaigns ?? []) as TrafficReportCampaignRow[],
    metrics: (metrics ?? []) as TrafficReportMetricRow[],
  });
  report.creatives = await Promise.all(report.creatives.map(async (creative) => ({
    ...creative,
    thumbnailDataUrl: await imageDataUrl(creative.thumbnailDataUrl),
  })));

  return NextResponse.json({ report }, { headers: { "Cache-Control": "private, no-store" } });
}
