// ─────────────────────────────────────────────────────────────────────────────
// Meta Ads — core sync logic
// Importado pelos API routes /connect e /sync.
// Recebe um Supabase client server-side já autenticado.
// ─────────────────────────────────────────────────────────────────────────────

import { format, startOfMonth, endOfToday } from "date-fns";
import {
  getCampaigns,
  getInsights,
  getInsightsGeo,
  getAdsWithCreatives,
  extractLeads,
  extractPrimaryResults,
  mapCampaignStatus,
  mapObjective,
} from "@/lib/meta-api";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetaAdWithCreative } from "@/lib/meta-api";

function pickBestAdImage(creative: MetaAdWithCreative["creative"]): string | null {
  if (!creative) return null;
  // High-res sources first — thumbnail_url last (compressed)
  if (creative.image_url)     return creative.image_url;
  const spec = creative.object_story_spec;
  if (spec?.link_data?.picture)   return spec.link_data.picture;
  if (spec?.link_data?.image_url) return spec.link_data.image_url;
  if (spec?.photo_data?.images?.[0]?.url) return spec.photo_data.images[0].url;
  const att = spec?.link_data?.child_attachments?.[0];
  if (att?.picture)               return att.picture;
  if (att?.image_url)             return att.image_url;
  const feed = creative.asset_feed_spec;
  if (feed?.images?.[0]?.url)     return feed.images[0].url!;
  if (spec?.video_data?.image_url)         return spec.video_data.image_url;
  if (spec?.template_data?.link_data?.picture) return spec.template_data.link_data.picture;
  if (feed?.videos?.[0]?.thumbnail_url)    return feed.videos[0].thumbnail_url!;
  if (spec?.video_data?.thumbnail_url)     return spec.video_data.thumbnail_url;
  if (creative.thumbnail_url)     return creative.thumbnail_url; // last resort
  return null;
}

export interface SyncParams {
  supabase: SupabaseClient;
  userId: string;
  platformAccountId: string;
  adAccountId: string;
  clientId: string | null;
  accessToken: string;
  since?: string;   // YYYY-MM-DD, default = start of current month
  until?: string;   // YYYY-MM-DD, default = today
}

export interface SyncResult {
  campaignsSynced: number;
  metricsSynced:   number;
  metricsSkipped:  number;
  warnings:        string[];
}

export async function syncMetaAccount(params: SyncParams): Promise<SyncResult> {
  const {
    supabase, userId, platformAccountId,
    adAccountId, clientId, accessToken,
  } = params;

  const since = params.since ?? format(startOfMonth(new Date()), "yyyy-MM-dd");
  const until = params.until ?? format(endOfToday(), "yyyy-MM-dd");

  console.log(`[meta-sync] START account=${adAccountId} period=${since}→${until}`);

  // Create sync log
  const { data: log, error: logErr } = await supabase
    .from("meta_sync_logs")
    .insert({ user_id: userId, platform_account_id: platformAccountId, status: "running" })
    .select("id")
    .single();

  if (logErr) {
    console.error("[meta-sync] failed to create sync log:", logErr.message);
  }

  let campaignsSynced = 0;
  let metricsSynced   = 0;
  let metricsSkipped  = 0;
  const warnings: string[] = [];

  try {
    // ── Fetch from Meta API ──────────────────────────────────────────────────

    console.log("[meta-sync] fetching campaigns and insights from Meta API…");
    const [metaCampaigns, insights] = await Promise.all([
      getCampaigns(adAccountId, accessToken),
      getInsights(adAccountId, accessToken, since, until),
    ]);

    console.log(
      `[meta-sync] Meta API: ${metaCampaigns.length} campanhas, ${insights.length} linhas de insight`
    );

    if (insights.length === 0) {
      const msg = `Meta API retornou 0 linhas de insight para o período ${since}→${until}. ` +
        `Verifique se há campanhas com investimento nesse período.`;
      console.warn("[meta-sync]", msg);
      warnings.push(msg);
    }

    // Debug: log first insight row to validate field mapping
    if (insights.length > 0) {
      const sample = insights[0];
      console.log("[meta-sync] Amostra da primeira linha de insight:", {
        campaign_id:          sample.campaign_id,
        campaign_name:        sample.campaign_name,
        date_start:           sample.date_start,
        spend:                sample.spend,
        impressions:          sample.impressions,
        clicks:               sample.clicks,
        inline_link_clicks:   sample.inline_link_clicks,
        ctr:                  sample.ctr,
        unique_ctr:           sample.unique_ctr,
        actions_count:        sample.actions?.length ?? 0,
        results_count:        sample.results?.length ?? 0,
        actions_types:        sample.actions?.map(a => `${a.action_type}=${a.value}`).join(", ") ?? "none",
        results_raw:          sample.results?.map(r => `${r.action_type}=${r.value}`).join(", ") ?? "none",
      });
    }

    // ── Sync campaigns ───────────────────────────────────────────────────────

    const metaCampaignIds = metaCampaigns.map(campaign => campaign.id);
    const { data: existingCampaigns, error: existingCampaignsError } = metaCampaignIds.length
      ? await supabase
          .from("campaigns")
          .select("id, external_id")
          .eq("user_id", userId)
          .in("external_id", metaCampaignIds)
      : { data: [], error: null };

    if (existingCampaignsError) {
      throw new Error(`Falha ao buscar campanhas existentes: ${existingCampaignsError.message}`);
    }

    const existingByExternalId = new Map(
      (existingCampaigns ?? []).map(campaign => [campaign.external_id as string, campaign.id as string]),
    );
    const campaignWrites = metaCampaigns.map(async campaign => {
      const existingId = existingByExternalId.get(campaign.id);
      const values = {
        name:                campaign.name,
        status:              mapCampaignStatus(campaign.status),
        objective:           mapObjective(campaign.objective),
        platform_account_id: platformAccountId,
      };

      const { error } = existingId
        ? await supabase.from("campaigns").update(values).eq("id", existingId)
        : await supabase.from("campaigns").insert({
            ...values,
            user_id:         userId,
            client_id:       clientId,
            platform:        "meta",
            daily_budget:    campaign.daily_budget    ? parseFloat(campaign.daily_budget)    / 100 : 0,
            total_budget:    campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : 0,
            start_date:      campaign.created_time.split("T")[0],
            external_id:     campaign.id,
          });

      if (error) {
        warnings.push(`Erro ao sincronizar ${campaign.name}: ${error.message}`);
        return false;
      }
      return true;
    });

    const campaignWriteResults = await Promise.all(campaignWrites);
    campaignsSynced = campaignWriteResults.filter(Boolean).length;

    console.log(`[meta-sync] campanhas sincronizadas: ${campaignsSynced}`);

    // ── Build external_id → internal campaign id map ─────────────────────────

    const { data: dbCamps, error: dbCampsErr } = await supabase
      .from("campaigns")
      .select("id, external_id")
      .eq("user_id", userId)
      .eq("platform", "meta")
      .not("external_id", "is", null);

    if (dbCampsErr) {
      throw new Error(`Falha ao buscar campanhas do banco: ${dbCampsErr.message}`);
    }

    const campMap = new Map(
      (dbCamps ?? [])
        .filter(c => c.external_id)
        .map(c => [c.external_id as string, c.id as string])
    );

    console.log(`[meta-sync] campMap com ${campMap.size} entradas`);

    // ── Sync metrics ─────────────────────────────────────────────────────────

    const monthlySpend = new Map<string, number>();
    const metricRows: Record<string, unknown>[] = [];

    for (const row of insights) {
      if (!row.date_start) {
        console.warn("[meta-sync] linha sem date_start, pulando:", row.campaign_id);
        metricsSkipped++;
        continue;
      }

      const internalId = campMap.get(row.campaign_id);
      if (!internalId) {
        console.warn(`[meta-sync] campanha Meta ${row.campaign_id} não encontrada no banco`);
        metricsSkipped++;
        continue;
      }

      // ── Parse raw values ────────────────────────────────────────────────────

      const spend       = parseFloat(row.spend             ?? "0");
      const imps        = parseInt(row.impressions         ?? "0", 10);
      const reach       = parseInt(row.reach               ?? "0", 10);
      const freq        = parseFloat(row.frequency         ?? "0");

      // Total clicks (all types) — keep in `clicks` for backward compat
      const totalClicks = parseInt(row.clicks              ?? "0", 10);
      // Link clicks only (inline_link_clicks) — more meaningful for performance
      const linkClicks  = parseInt(row.inline_link_clicks  ?? "0", 10);

      // Unique CTR from Meta API — matches "CTR Único" in Meta Ads Manager
      const uniqueCtr   = parseFloat(row.unique_ctr        ?? "0");

      // ── Leads — priority logic, NO double-counting ──────────────────────────
      // WRONG (old):  lead + leadgen.other + onsite_conversion.lead_grouped
      //               → lead_grouped ALREADY INCLUDES the others → 2x count
      // CORRECT:      use lead_grouped if present, otherwise sum direct types
      const leads = extractLeads(row.actions);

      // ── Conversions — Meta's primary optimization result ────────────────────
      // results[] = "Resultados" in Meta Ads Manager (campaign's primary goal)
      // For lead campaigns: results = leads; for purchase: results = purchases
      const primaryResults = extractPrimaryResults(row.results);
      // Fallback: if results not returned by API, use leads (lead campaigns)
      const conversions = primaryResults > 0 ? primaryResults : leads;

      console.log(
        `[meta-sync] ${row.date_start} | camp=${row.campaign_id} | ` +
        `spend=${spend} imps=${imps} clicks=${totalClicks} link_clicks=${linkClicks} ` +
        `leads=${leads} conv=${conversions} unique_ctr=${uniqueCtr}%`
      );

      // ── Upsert campaign_metrics ─────────────────────────────────────────────

      metricRows.push({
        user_id:             userId,
        campaign_id:         internalId,
        client_id:           clientId,
        platform_account_id: platformAccountId,
        date:                row.date_start,
        impressions:         imps,
        clicks:              totalClicks,
        link_clicks:         linkClicks,
        unique_ctr:          uniqueCtr,
        spend,
        leads,
        conversions,
        reach,
        frequency:           freq,
        video_views:         0,
      });

      // Accumulate monthly spend for financial integration
      const monthKey = row.date_start.slice(0, 7);
      monthlySpend.set(monthKey, (monthlySpend.get(monthKey) ?? 0) + spend);
    }

    // Persiste em lotes, reduzindo centenas de viagens ao banco a poucas
    // operações mesmo em contas com muitas campanhas.
    const METRIC_BATCH_SIZE = 500;
    for (let index = 0; index < metricRows.length; index += METRIC_BATCH_SIZE) {
      const batch = metricRows.slice(index, index + METRIC_BATCH_SIZE);
      const { error: upsertErr } = await supabase
        .from("campaign_metrics")
        .upsert(batch, { onConflict: "campaign_id,date" });
      if (upsertErr) {
        warnings.push(`Erro ao salvar lote de métricas: ${upsertErr.message}`);
        metricsSkipped += batch.length;
      } else {
        metricsSynced += batch.length;
      }
    }

    console.log(
      `[meta-sync] métricas sincronizadas: ${metricsSynced}, puladas: ${metricsSkipped}`
    );

    // ── Sync monthly spend → expenses (financeiro) ───────────────────────────

    for (const [monthKey, totalSpend] of Array.from(monthlySpend)) {
      if (totalSpend <= 0) continue;

      const [yearStr, monthStr] = monthKey.split("-");
      const year  = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const date  = `${monthKey}-01`;
      const extRef = `meta::${adAccountId}::${clientId ?? "global"}::${monthKey}`;

      const { error: expErr } = await supabase
        .from("expenses")
        .upsert(
          {
            user_id:       userId,
            client_id:     clientId,
            category:      "trafego_pago",
            description:   `Meta Ads — investimento ${month.toString().padStart(2, "0")}/${year}`,
            amount:        totalSpend,
            date,
            type:          "variavel",
            auto_imported: true,
            notes:         `Importado automaticamente via integração Meta Ads (conta: ${adAccountId})`,
            external_ref:  extRef,
          },
          { onConflict: "user_id,external_ref" }
        );

      if (expErr) {
        console.error("[meta-sync] expense upsert error:", expErr.message);
        warnings.push(`Erro ao sincronizar despesa financeira: ${expErr.message}`);
      }

      const tcRef = `meta::${adAccountId}::${clientId ?? "global"}::${monthKey}::cost`;
      const { error: tcErr } = await supabase
        .from("traffic_costs")
        .upsert(
          {
            user_id:       userId,
            client_id:     clientId,
            campaign_name: "Meta Ads",
            platform:      "meta",
            amount:        totalSpend,
            date,
            period_start:  `${monthKey}-01`,
            period_end:    since > until ? since : until,
            reference_id:  platformAccountId,
            external_ref:  tcRef,
          },
          { onConflict: "user_id,external_ref" }
        );

      if (tcErr) {
        console.error("[meta-sync] traffic_cost upsert error:", tcErr.message);
      }
    }

    // ── Sync geographic metrics (best-effort, non-fatal) ─────────────────────

    try {
      const geoRows = await getInsightsGeo(adAccountId, accessToken, since, until);
      console.log(`[meta-sync] geo: ${geoRows.length} linhas com breakdown de região`);

      const geoValues = geoRows.flatMap(row => {
        if (!row.date_start || !row.region?.trim()) return [];
        const internalId = campMap.get(row.campaign_id);
        if (!internalId) return [];
        return [{
          user_id:             userId,
          campaign_id:         internalId,
          client_id:           clientId,
          platform_account_id: platformAccountId,
          date:                row.date_start,
          region:              row.region.trim(),
          spend:               parseFloat(row.spend ?? "0"),
          leads:               extractLeads(row.actions),
          clicks:              parseInt(row.clicks ?? "0", 10),
          link_clicks:         parseInt(row.inline_link_clicks ?? "0", 10),
          impressions:         parseInt(row.impressions ?? "0", 10),
          reach:               parseInt(row.reach ?? "0", 10),
        }];
      });
      for (let index = 0; index < geoValues.length; index += 500) {
        const { error: geoErr } = await supabase
          .from("campaign_geo_metrics")
          .upsert(geoValues.slice(index, index + 500), { onConflict: "campaign_id,date,region" });
        if (geoErr) console.warn("[meta-sync] geo batch upsert error:", geoErr.message);
      }
    } catch (geoErr) {
      console.warn("[meta-sync] geo sync falhou (não-fatal):", geoErr);
      warnings.push("Dados geográficos não disponíveis para este período");
    }

    // ── Sync creative thumbnails (best-effort, non-fatal) ────────────────────
    // Picks the best thumbnail URL per campaign from the account's active ads
    // and stores it in campaigns.thumbnail_url for use in the client portal.

    try {
      const ads = await getAdsWithCreatives(adAccountId, accessToken);
      console.log(`[meta-sync] thumbnails: ${ads.length} anúncios retornados`);

      // Best image per Meta campaign_id
      const thumbMap = new Map<string, string>();
      for (const ad of ads) {
        if (thumbMap.has(ad.campaign_id)) continue;
        const url = pickBestAdImage(ad.creative);
        if (url) thumbMap.set(ad.campaign_id, url);
      }

      console.log(`[meta-sync] thumbnails: ${thumbMap.size} campanhas com imagem`);

      await Promise.all(Array.from(thumbMap).map(([metaCampaignId, thumbUrl]) => {
        const internalId = campMap.get(metaCampaignId);
        if (!internalId) return Promise.resolve();
        return supabase
          .from("campaigns")
          .update({ thumbnail_url: thumbUrl })
          .eq("id", internalId)
          .then();
      }));
    } catch (thumbErr) {
      console.warn("[meta-sync] sync de thumbnails falhou (não-fatal):", thumbErr);
    }

    // ── Mark account as synced ────────────────────────────────────────────────

    await supabase
      .from("ad_platform_accounts")
      .update({ status: "connected", last_sync_at: new Date().toISOString() })
      .eq("id", platformAccountId);

    if (log) {
      await supabase
        .from("meta_sync_logs")
        .update({
          finished_at:      new Date().toISOString(),
          status:           warnings.length > 0 && metricsSynced === 0 ? "error" : "success",
          campaigns_synced: campaignsSynced,
          metrics_synced:   metricsSynced,
          error_message:    warnings.length > 0 ? warnings.slice(0, 3).join(" | ") : null,
        })
        .eq("id", log.id);
    }

    console.log(
      `[meta-sync] CONCLUÍDO — campanhas=${campaignsSynced} métricas=${metricsSynced} ` +
      `puladas=${metricsSkipped} avisos=${warnings.length}`
    );

    return { campaignsSynced, metricsSynced, metricsSkipped, warnings };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[meta-sync] ERRO FATAL:", msg);

    if (log) {
      await supabase
        .from("meta_sync_logs")
        .update({
          finished_at:   new Date().toISOString(),
          status:        "error",
          error_message: msg,
        })
        .eq("id", log.id);
    }

    await supabase
      .from("ad_platform_accounts")
      .update({ status: "error" })
      .eq("id", platformAccountId);

    throw err;
  }
}
