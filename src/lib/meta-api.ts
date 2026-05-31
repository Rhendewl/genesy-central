// ─────────────────────────────────────────────────────────────────────────────
// Meta Graph API v21.0 client
// All functions run server-side only (API routes / server components).
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH = "https://graph.facebook.com/v21.0";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MetaAdAccount {
  id: string;          // "act_123456789"
  name: string;
  account_status: number; // 1 = active, 2 = disabled, 3 = unsettled
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  objective: string;
  created_time: string;
  daily_budget?: string;   // cents as string
  lifetime_budget?: string;
}

export interface MetaInsightAction {
  action_type: string;
  value: string;
}

export interface MetaInsightRow {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  reach: string;
  // Total clicks (all types: link, reactions, shares, comments, etc.)
  clicks: string;
  // Link clicks only — matches "Cliques no Link" in Meta Ads Manager
  inline_link_clicks?: string;
  cpm: string;
  cpc: string;
  // All-click CTR (clicks / impressions * 100)
  ctr: string;
  // Unique CTR — matches "CTR Único" in Meta Ads Manager (unique link clicks / reach * 100)
  unique_ctr?: string;
  frequency: string;
  actions?: MetaInsightAction[];
  cost_per_action_type?: MetaInsightAction[];
  // Primary optimization result (Meta's "Resultados" column)
  results?: MetaInsightAction[];
  cost_per_result?: MetaInsightAction[];
}

// ── Core fetcher ──────────────────────────────────────────────────────────────

async function metaGet<T>(path: string, token: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${token}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(body?.error?.message ?? `Meta API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Ad accounts ───────────────────────────────────────────────────────────────

export async function getAdAccounts(token: string): Promise<MetaAdAccount[]> {
  const data = await metaGet<{ data: MetaAdAccount[] }>(
    "/me/adaccounts?fields=id,name,account_status&limit=100",
    token
  );
  return (data.data ?? []).filter(a => a.account_status === 1);
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export async function getCampaigns(adAccountId: string, token: string): Promise<MetaCampaign[]> {
  const cleanId = adAccountId.replace(/^act_/, "");
  const fields = "id,name,status,objective,created_time,daily_budget,lifetime_budget";
  const data = await metaGet<{ data: MetaCampaign[] }>(
    `/act_${cleanId}/campaigns?fields=${fields}&limit=200`,
    token
  );
  return data.data ?? [];
}

// ── Insights (daily breakdown per campaign) ───────────────────────────────────

export async function getInsights(
  adAccountId: string,
  token: string,
  since: string,
  until: string
): Promise<MetaInsightRow[]> {
  const cleanId = adAccountId.replace(/^act_/, "");
  const fields = [
    // Time breakdown (also returned automatically with time_increment=1)
    "date_start", "date_stop",
    // Campaign identifiers
    "campaign_id", "campaign_name",
    // Reach & delivery
    "impressions", "reach", "frequency",
    // Spend
    "spend", "cpm",
    // Clicks — total (all types) and link-only
    "clicks", "inline_link_clicks",
    // CTR — all-click and unique (matches Meta Ads Manager "CTR Único")
    "ctr", "unique_ctr",
    // CPC (cost per total click)
    "cpc",
    // Actions (conversions, leads, etc.)
    "actions", "cost_per_action_type",
    // Primary optimization result ("Resultados" in Meta Ads Manager)
    "results", "cost_per_result",
  ].join(",");

  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));

  const first = await metaGet<{ data: MetaInsightRow[]; paging?: { next?: string } }>(
    `/act_${cleanId}/insights?fields=${fields}&time_range=${timeRange}&time_increment=1&level=campaign&limit=500`,
    token
  );

  const rows: MetaInsightRow[] = [...(first.data ?? [])];

  // Follow pagination
  let nextUrl = first.paging?.next;
  while (nextUrl) {
    const page = await fetch(nextUrl).then(r => r.json()) as {
      data: MetaInsightRow[];
      paging?: { next?: string };
    };
    rows.push(...(page.data ?? []));
    nextUrl = page.paging?.next;
  }

  return rows;
}

// ── Pages ─────────────────────────────────────────────────────────────────────

export interface MetaPage {
  id:   string;
  name: string;
}

export interface MetaPageWithToken extends MetaPage {
  access_token: string;
}

export interface MetaLeadGenForm {
  id:          string;
  name:        string;
  status:      string; // 'ACTIVE' | 'ARCHIVED'
  leads_count?: number;
}

export async function getPages(token: string): Promise<MetaPage[]> {
  const data = await metaGet<{ data: MetaPage[] }>(
    "/me/accounts?fields=id,name&limit=100",
    token
  );
  return data.data ?? [];
}

export async function getPagesWithTokens(token: string): Promise<MetaPageWithToken[]> {
  const data = await metaGet<{ data: MetaPageWithToken[] }>(
    "/me/accounts?fields=id,name,access_token&limit=100",
    token
  );
  return data.data ?? [];
}

export async function getLeadGenForms(pageId: string, pageToken: string): Promise<MetaLeadGenForm[]> {
  const data = await metaGet<{ data: MetaLeadGenForm[] }>(
    `/${pageId}/leadgen_forms?fields=id,name,status,leads_count&limit=100`,
    pageToken
  );
  return data.data ?? [];
}

// ── Insights with geographic breakdown (region) ───────────────────────────────

export interface MetaGeoInsightRow {
  campaign_id: string;
  date_start: string;
  region: string;
  spend: string;
  impressions: string;
  reach: string;
  clicks: string;
  inline_link_clicks?: string;
  actions?: MetaInsightAction[];
}

export async function getInsightsGeo(
  adAccountId: string,
  token: string,
  since: string,
  until: string
): Promise<MetaGeoInsightRow[]> {
  const cleanId = adAccountId.replace(/^act_/, "");
  const fields = [
    "date_start", "campaign_id",
    "impressions", "reach", "spend", "clicks", "inline_link_clicks", "actions",
  ].join(",");

  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));

  const first = await metaGet<{ data: MetaGeoInsightRow[]; paging?: { next?: string } }>(
    `/act_${cleanId}/insights?fields=${fields}&time_range=${timeRange}&time_increment=1&level=campaign&breakdowns=region&limit=500`,
    token
  );

  const rows: MetaGeoInsightRow[] = [...(first.data ?? [])];

  let nextUrl = first.paging?.next;
  while (nextUrl) {
    const page = await fetch(nextUrl).then(r => r.json()) as {
      data: MetaGeoInsightRow[];
      paging?: { next?: string };
    };
    rows.push(...(page.data ?? []));
    nextUrl = page.paging?.next;
  }

  return rows;
}

// ── Page webhook subscription ─────────────────────────────────────────────────

/**
 * Subscribe a Facebook Page to receive leadgen webhook events.
 * Must be called with a Page Access Token (not a user token).
 * This is the call the old Make integration made on setup and Genesy never did.
 *
 * POST /{page_id}/subscribed_apps?subscribed_fields=leadgen
 */
export async function subscribePageToWebhook(
  pageId: string,
  pageToken: string
): Promise<void> {
  const params = new URLSearchParams({
    subscribed_fields: "leadgen",
    access_token: pageToken,
  });
  const res = await fetch(`${GRAPH}/${pageId}/subscribed_apps`, {
    method: "POST",
    body: params,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(body?.error?.message ?? `subscribed_apps failed HTTP ${res.status}`);
  }
}

/**
 * Returns the list of apps currently subscribed to a Page's webhooks.
 * Used for diagnostic: confirms whether our app received the subscription.
 */
export async function getPageSubscribedApps(
  pageId: string,
  pageToken: string
): Promise<{ id: string; name: string; subscribed_fields: string[] }[]> {
  const data = await metaGet<{
    data: { id: string; name: string; subscribed_fields: string[] }[];
  }>(`/${pageId}/subscribed_apps`, pageToken);
  return data.data ?? [];
}

// ── Token exchange ────────────────────────────────────────────────────────────

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; expires_in?: number }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("META_APP_ID / META_APP_SECRET not configured");

  const params = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code });
  const res = await fetch(`${GRAPH}/oauth/access_token?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(body?.error?.message ?? "Token exchange failed");
  }
  return res.json() as Promise<{ access_token: string; expires_in?: number }>;
}

// Exchange a short-lived user token for a long-lived token (~60 days).
// Must be called server-side; requires META_APP_SECRET.
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("META_APP_ID / META_APP_SECRET not configured");

  const params = new URLSearchParams({
    grant_type:          "fb_exchange_token",
    client_id:           appId,
    client_secret:       appSecret,
    fb_exchange_token:   shortLivedToken,
  });

  const res = await fetch(`${GRAPH}/oauth/access_token?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(body?.error?.message ?? "Long-lived token exchange failed");
  }
  return res.json() as Promise<{ access_token: string; token_type: string; expires_in: number }>;
}

// ── Ad Account Details (balance, status, funding) ────────────────────────────

export interface MetaAdAccountDetails {
  id: string;
  name: string;
  account_status: number;
  // balance: NET available balance in minor currency units (centavos for BRL).
  // For prepaid accounts this IS what Ads Manager shows as "Saldo disponível".
  // Taxes/fees are deducted by Meta at the time of deposit, NOT at query time.
  balance: string;
  amount_spent: string;   // total spent in minor currency units (current billing period)
  spend_cap: string;      // postpaid account spending cap (0 = unlimited)
  currency: string;       // e.g. "BRL"
  funding_source_details?: {
    // type is returned as a numeric code by the Graph API:
    // 1=credit_card 2=manual_pay 4=prepay_credit 8=extended_credit 9=tax_exempt 12=agency_credit_line
    type: number | string;
    display_string?: string;
    id?: string;
  };
}

export async function getAdAccountDetails(
  adAccountId: string,
  token: string
): Promise<MetaAdAccountDetails> {
  const cleanId = adAccountId.replace(/^act_/, "");
  const fields = [
    "id", "name", "account_status",
    "balance", "amount_spent", "spend_cap",
    "currency",
    "funding_source_details",
  ].join(",");
  return metaGet<MetaAdAccountDetails>(`/act_${cleanId}?fields=${fields}`, token);
}

// ── Ad-level insights ─────────────────────────────────────────────────────────

export interface MetaAdInsightRow {
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  reach: string;
  clicks: string;
  inline_link_clicks?: string;
  ctr: string;
  unique_ctr?: string;
  cpc: string;
  actions?: MetaInsightAction[];
}

type AdStorySpec = {
  link_data?: { picture?: string; image_url?: string; };
  video_data?: { image_url?: string; thumbnail_url?: string; };
  photo_data?: { images?: Array<{ url?: string }>; };
  template_data?: { link_data?: { picture?: string; image_url?: string; }; };
};

type AssetFeedSpec = {
  images?: Array<{ hash?: string; url?: string; }>;
  videos?: Array<{ thumbnail_url?: string; video_id?: string; }>;
};

export interface MetaAdWithCreative {
  id: string;
  name: string;
  status: string; // "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED"
  campaign_id: string;
  creative?: {
    id?: string;
    thumbnail_url?: string;
    image_url?: string;
    title?: string;
    body?: string;
    // effective_object_story_spec has fully-resolved image URLs (preferred over object_story_spec)
    effective_object_story_spec?: AdStorySpec;
    object_story_spec?: AdStorySpec;
    // asset_feed_spec used by Dynamic/Advantage+ Ads and some Lead Ads
    asset_feed_spec?: AssetFeedSpec;
  };
}

export async function getAdInsights(
  adAccountId: string,
  token: string,
  since: string,
  until: string
): Promise<MetaAdInsightRow[]> {
  const cleanId = adAccountId.replace(/^act_/, "");
  const fields = [
    "ad_id", "ad_name",
    "campaign_id", "campaign_name",
    "spend", "impressions", "reach",
    "clicks", "inline_link_clicks",
    "ctr", "cpc",
    "actions",
  ].join(",");
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));

  const first = await metaGet<{ data: MetaAdInsightRow[]; paging?: { next?: string } }>(
    `/act_${cleanId}/insights?fields=${fields}&time_range=${timeRange}&time_increment=all&level=ad&limit=500`,
    token
  );

  const rows = [...(first.data ?? [])];
  let nextUrl = first.paging?.next;
  while (nextUrl) {
    const page = await fetch(nextUrl).then(r => r.json()) as { data: MetaAdInsightRow[]; paging?: { next?: string } };
    rows.push(...(page.data ?? []));
    nextUrl = page.paging?.next;
  }
  return rows;
}

export async function getAdsWithCreatives(
  adAccountId: string,
  token: string
): Promise<MetaAdWithCreative[]> {
  const cleanId = adAccountId.replace(/^act_/, "");
  // effective_object_story_spec returns fully-resolved image URLs (better than object_story_spec)
  // asset_feed_spec covers Dynamic/Advantage+ Ads and Lead Ads that skip object_story_spec
  const fields = "id,name,status,campaign_id,creative{id,thumbnail_url,image_url,effective_object_story_spec,object_story_spec,asset_feed_spec{images,videos}}";
  // Include all effective statuses so archived/deleted ads from the insight period are captured
  const filtering = encodeURIComponent(JSON.stringify([
    { field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED", "IN_PROCESS", "WITH_ISSUES"] },
  ]));

  const first = await metaGet<{ data: MetaAdWithCreative[]; paging?: { next?: string } }>(
    `/act_${cleanId}/ads?fields=${fields}&filtering=${filtering}&limit=200`,
    token
  );

  const ads = [...(first.data ?? [])];
  let nextUrl = first.paging?.next;
  while (nextUrl) {
    const page = await fetch(nextUrl).then(r => r.json()) as { data: MetaAdWithCreative[]; paging?: { next?: string } };
    ads.push(...(page.data ?? []));
    nextUrl = page.paging?.next;
  }
  return ads;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getActionCount(actions: MetaInsightAction[] | undefined, ...types: string[]): number {
  if (!actions) return 0;
  return actions
    .filter(a => types.includes(a.action_type))
    .reduce((sum, a) => sum + parseInt(a.value, 10), 0);
}

/**
 * Extract lead count WITHOUT double-counting.
 *
 * Meta API caveat: `onsite_conversion.lead_grouped` is an aggregation that
 * ALREADY INCLUDES `lead` and `leadgen.other`. Summing all three types
 * doubles the count.
 *
 * Priority:
 *   1. onsite_conversion.lead_grouped  (most complete, avoids double-count)
 *   2. lead + leadgen.other            (direct form submissions)
 *   3. offsite_conversion.fb_pixel_lead (website pixel leads)
 */
export function extractLeads(actions: MetaInsightAction[] | undefined): number {
  if (!actions) return 0;

  // Priority 1: grouped (already aggregates lead + leadgen.other)
  const grouped = getActionCount(actions, "onsite_conversion.lead_grouped");
  if (grouped > 0) return grouped;

  // Priority 2: direct form submissions (no grouped aggregation present)
  const direct =
    getActionCount(actions, "lead") +
    getActionCount(actions, "leadgen.other");
  if (direct > 0) return direct;

  // Priority 3: website pixel leads
  return getActionCount(actions, "offsite_conversion.fb_pixel_lead");
}

/**
 * Extract the primary optimization result from Meta's `results` field.
 * This maps to "Resultados" in Meta Ads Manager — the metric the campaign
 * is optimized for (leads for lead campaigns, purchases for purchase, etc.).
 */
export function extractPrimaryResults(results: MetaInsightAction[] | undefined): number {
  if (!results || results.length === 0) return 0;
  return results.reduce((sum, r) => sum + parseInt(r.value, 10), 0);
}

export function mapCampaignStatus(s: string): string {
  return s === "ACTIVE" ? "ativa" : s === "PAUSED" ? "pausada" : "finalizada";
}

export function mapObjective(obj: string): string {
  const map: Record<string, string> = {
    LEAD_GENERATION:    "leads",
    OUTCOME_LEADS:      "leads",
    LINK_CLICKS:        "trafego",
    OUTCOME_TRAFFIC:    "trafego",
    CONVERSIONS:        "conversoes",
    OUTCOME_SALES:      "vendas",
    REACH:              "alcance",
    BRAND_AWARENESS:    "alcance",
    OUTCOME_AWARENESS:  "alcance",
    VIDEO_VIEWS:        "engajamento",
    POST_ENGAGEMENT:    "engajamento",
    OUTCOME_ENGAGEMENT: "engajamento",
  };
  return map[obj] ?? "outro";
}
