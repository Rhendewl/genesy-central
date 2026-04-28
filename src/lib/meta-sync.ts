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
  extractLeads,
  extractPrimaryResults,
  mapCampaignStatus,
  mapObjective,
} from "@/lib/meta-api";
import type { SupabaseClient } from "@supabase/supabase-js";

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

    for (const camp of metaCampaigns) {
      const { data: existing, error: findErr } = await supabase
        .from("campaigns")
        .select("id")
        .eq("user_id", userId)
        .eq("external_id", camp.id)
        .maybeSingle();

      if (findErr) {
        console.error(`[meta-sync] erro ao buscar campanha ${camp.id}:`, findErr.message);
        warnings.push(`Erro ao buscar campanha ${camp.name}: ${findErr.message}`);
        continue;
      }

      if (existing) {
        const { error: updErr } = await supabase
          .from("campaigns")
          .update({
            name:                camp.name,
            status:              mapCampaignStatus(camp.status),
            objective:           mapObjective(camp.objective),
            platform_account_id: platformAccountId,
          })
          .eq("id", existing.id);

        if (updErr) {
          console.error(`[meta-sync] erro ao atualizar campanha ${camp.id}:`, updErr.message);
          warnings.push(`Erro ao atualizar ${camp.name}: ${updErr.message}`);
          continue;
        }
      } else {
        const { error: insErr } = await supabase
          .from("campaigns")
          .insert({
            user_id:             userId,
            client_id:           clientId,
            platform_account_id: platformAccountId,
            name:                camp.name,
            platform:            "meta",
            objective:           mapObjective(camp.objective),
            status:              mapCampaignStatus(camp.status),
            daily_budget:        camp.daily_budget    ? parseFloat(camp.daily_budget)    / 100 : 0,
            total_budget:        camp.lifetime_budget ? parseFloat(camp.lifetime_budget) / 100 : 0,
            start_date:          camp.created_time.split("T")[0],
            external_id:         camp.id,
          });

        if (insErr) {
          console.error(`[meta-sync] erro ao inserir campanha ${camp.id}:`, insErr.message);
          warnings.push(`Erro ao inserir ${camp.name}: ${insErr.message}`);
          continue;
        }
      }

      campaignsSynced++;
    }

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

      const { error: upsertErr } = await supabase
        .from("campaign_metrics")
        .upsert(
          {
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
          },
          { onConflict: "campaign_id,date" }
        );

      if (upsertErr) {
        console.error(
          `[meta-sync] upsert falhou para camp ${row.campaign_id} em ${row.date_start}:`,
          upsertErr.message, upsertErr.details ?? ""
        );
        warnings.push(
          `Erro ao salvar métrica ${row.campaign_name} em ${row.date_start}: ${upsertErr.message}`
        );
        metricsSkipped++;
        continue;
      }

      // Accumulate monthly spend for financial integration
      const monthKey = row.date_start.slice(0, 7);
      monthlySpend.set(monthKey, (monthlySpend.get(monthKey) ?? 0) + spend);
      metricsSynced++;
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

      for (const row of geoRows) {
        if (!row.date_start || !row.region?.trim()) continue;

        const internalId = campMap.get(row.campaign_id);
        if (!internalId) continue;

        const { error: geoErr } = await supabase
          .from("campaign_geo_metrics")
          .upsert(
            {
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
            },
            { onConflict: "campaign_id,date,region" }
          );

        if (geoErr) {
          console.warn("[meta-sync] geo upsert error:", geoErr.message);
        }
      }
    } catch (geoErr) {
      console.warn("[meta-sync] geo sync falhou (não-fatal):", geoErr);
      warnings.push("Dados geográficos não disponíveis para este período");
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
