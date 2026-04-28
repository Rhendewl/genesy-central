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
