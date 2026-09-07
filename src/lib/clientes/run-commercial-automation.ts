import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/crypto";
import { syncMetaAccount } from "@/lib/meta-sync";
import { buildPublicUrl } from "@/lib/public-url";
import { buildCommercialAnalysisEmail, getResendClient } from "@/lib/resend";
import { DEFAULT_COMMERCIAL_TEMPLATES, extractDevelopmentName } from "@/lib/clientes/commercial-intelligence";
import {
  commercialAutomationWindow,
  commercialCollectionDue,
  evaluateCommercialSample,
  inferCommercialAutomationSlot,
  nextCommercialAutomationSlot,
  type CommercialAutomationSlot,
} from "@/lib/clientes/commercial-automation";
import type { CommercialDevelopment, CommercialFrequency } from "@/types/commercial-intelligence";

type AutomationSettings = {
  id: string;
  user_id: string;
  client_id: string;
  frequency: CommercialFrequency;
  meta_account_ids: string[];
  parser_pattern: string;
  parser_group: number;
  public_slug: string | null;
  minimum_leads: number;
  minimum_active_days: number;
};

type AutomationResult = {
  clientId: string;
  status: "waiting" | "deferred" | "sent" | "partial" | "error";
  reason: string;
  collectionId?: string;
};

const ELIGIBLE_OBJECTIVES = new Set(["leads", "conversoes", "vendas"]);

async function recordStatus(db: SupabaseClient, settingsId: string, status: AutomationResult["status"], reason: string, sent = false) {
  await db.from("commercial_intelligence_settings").update({
    last_automation_check_at: new Date().toISOString(),
    last_automation_status: status,
    last_automation_reason: reason,
    ...(sent ? { last_automatic_collection_at: new Date().toISOString() } : {}),
  }).eq("id", settingsId);
}

async function sendPendingDeliveries(params: {
  db: SupabaseClient;
  collection: { id: string; name: string };
  clientName: string;
  publicSlug: string;
}) {
  const { data: deliveries, error } = await params.db
    .from("commercial_collection_deliveries")
    .select("id,broker_id,recipient_email,status,attempts")
    .eq("collection_id", params.collection.id)
    .neq("status", "sent");
  if (error) throw new Error(error.message);
  if (!deliveries?.length) return { attempted: 0, sent: 0, failed: 0 };

  const analysisLink = buildPublicUrl(`/analise-comercial/${params.publicSlug}`);
  let sent = 0;
  let failed = 0;
  for (const delivery of deliveries) {
    const { error: sendError } = await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to: delivery.recipient_email,
      subject: `Análise Comercial · ${params.clientName}`,
      html: buildCommercialAnalysisEmail({ clientName: params.clientName, collectionName: params.collection.name, analysisLink }),
    }, { idempotencyKey: `commercial-${params.collection.id}-${delivery.broker_id ?? delivery.id}` });
    if (sendError) {
      failed++;
      await params.db.from("commercial_collection_deliveries").update({ status: "failed", attempts: Number(delivery.attempts) + 1, last_error: sendError.message }).eq("id", delivery.id);
    } else {
      sent++;
      await params.db.from("commercial_collection_deliveries").update({ status: "sent", attempts: Number(delivery.attempts) + 1, last_error: null, sent_at: new Date().toISOString() }).eq("id", delivery.id);
    }
  }
  return { attempted: deliveries.length, sent, failed };
}

async function resolveTemplate(db: SupabaseClient, userId: string, slot: CommercialAutomationSlot) {
  const week = slot === "A" ? 1 : 2;
  const fallback = DEFAULT_COMMERCIAL_TEMPLATES.find((template) => template.week === week);
  if (!fallback) return null;
  const { data: override } = await db
    .from("commercial_templates")
    .select("id,name,description,questions,is_active")
    .eq("user_id", userId)
    .eq("is_system", true)
    .eq("week_number", week)
    .maybeSingle();
  if (override?.is_active === false) return null;
  return {
    id: override?.id ?? null,
    name: override?.name ?? fallback.name,
    description: override?.description ?? fallback.description,
    questions: override?.questions ?? fallback.questions,
    week,
  };
}

async function processClient(db: SupabaseClient, settings: AutomationSettings, today: string): Promise<AutomationResult> {
  const [{ data: client }, { data: brokers }, { data: lastCollection }] = await Promise.all([
    db.from("agency_clients").select("name").eq("id", settings.client_id).maybeSingle(),
    db.from("commercial_brokers").select("id,email").eq("client_id", settings.client_id).eq("is_active", true),
    db.from("commercial_collections").select("id,name,period_end,meta_snapshot").eq("client_id", settings.client_id).order("period_end", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!client) throw new Error("Cliente não encontrado");
  if (!settings.public_slug) return defer("Configure o link público antes de ativar a automação.");
  if (!brokers?.length) return defer("Cadastre ao menos um corretor ativo com e-mail.");

  if (lastCollection) {
    const snapshot = lastCollection.meta_snapshot as Record<string, unknown> | null;
    const recipients = Array.isArray(snapshot?.email_recipients)
      ? snapshot.email_recipients.filter((recipient): recipient is { broker_id: string; email: string } => Boolean(
        recipient && typeof recipient === "object" && "broker_id" in recipient && typeof recipient.broker_id === "string" && "email" in recipient && typeof recipient.email === "string",
      ))
      : [];
    if (snapshot?.automation === true && recipients.length) {
      await db.from("commercial_collection_deliveries").upsert(recipients.map((recipient) => ({
        user_id: settings.user_id,
        collection_id: lastCollection.id,
        broker_id: recipient.broker_id,
        recipient_email: recipient.email,
      })), { onConflict: "collection_id,broker_id", ignoreDuplicates: true });
    }
    const retry = await sendPendingDeliveries({ db, collection: lastCollection, clientName: client.name, publicSlug: settings.public_slug });
    if (retry.attempted) {
      const reason = retry.failed
        ? `Envio parcial — ${retry.sent} e-mail(s) enviado(s) e ${retry.failed} pendente(s) para nova tentativa.`
        : `Envio concluído — ${retry.sent} e-mail(s) entregue(s) à fila.`;
      const status = retry.failed ? "partial" : "sent";
      await recordStatus(db, settings.id, status, reason);
      return { clientId: settings.client_id, status, reason, collectionId: lastCollection.id };
    }
  }

  const due = commercialCollectionDue(lastCollection?.period_end ?? null, today, settings.frequency);
  if (!due.due) {
    const reason = `Próxima coleta em ${due.daysRemaining} dia(s), se houver amostra suficiente.`;
    await recordStatus(db, settings.id, "waiting", reason);
    return { clientId: settings.client_id, status: "waiting", reason };
  }

  const window = commercialAutomationWindow(today, settings.frequency);
  const accountIds = settings.meta_account_ids ?? [];
  if (!accountIds.length) return defer("Selecione ao menos uma conta Meta para a automação.");

  const { data: accounts } = await db
    .from("ad_platform_accounts")
    .select("id,account_id,client_id,status,include_in_expenses")
    .in("id", accountIds)
    .eq("user_id", settings.user_id);
  if (!accounts || accounts.length !== accountIds.length || accounts.some((account) => account.status !== "connected")) {
    return defer("Uma ou mais contas Meta precisam ser reconectadas.");
  }

  const { data: tokens } = await db
    .from("meta_tokens")
    .select("platform_account_id,encrypted_token,token_expires_at")
    .in("platform_account_id", accountIds)
    .eq("user_id", settings.user_id);
  const tokenByAccount = new Map((tokens ?? []).map((token) => [token.platform_account_id as string, token]));
  const syncErrors: string[] = [];
  for (const account of accounts) {
    const token = tokenByAccount.get(account.id);
    if (!token?.encrypted_token || (token.token_expires_at && new Date(token.token_expires_at) <= new Date())) {
      syncErrors.push(account.id);
      continue;
    }
    try {
      await syncMetaAccount({
        supabase: db,
        userId: settings.user_id,
        platformAccountId: account.id,
        adAccountId: account.account_id,
        clientId: account.client_id,
        includeInExpenses: account.include_in_expenses,
        accessToken: decryptToken(token.encrypted_token),
        since: window.start,
        until: window.end,
      });
    } catch {
      syncErrors.push(account.id);
    }
  }
  if (syncErrors.length) return defer(`${syncErrors.length} conta(s) Meta não puderam ser atualizadas. A coleta foi adiada para evitar dados incompletos.`);

  const { data: campaigns } = await db
    .from("campaigns")
    .select("id,name,objective,platform_account_id")
    .in("platform_account_id", accountIds);
  const eligibleCampaigns = (campaigns ?? []).filter((campaign) => ELIGIBLE_OBJECTIVES.has(campaign.objective));
  const campaignIds = eligibleCampaigns.map((campaign) => campaign.id);
  const { data: metrics } = campaignIds.length
    ? await db.from("campaign_metrics").select("campaign_id,spend,leads,impressions,clicks,date").in("campaign_id", campaignIds).gte("date", window.start).lte("date", window.end)
    : { data: [] };
  const totalLeads = (metrics ?? []).reduce((sum, metric) => sum + Number(metric.leads), 0);
  const activeDays = new Set((metrics ?? []).filter((metric) => Number(metric.spend) > 0 || Number(metric.impressions) > 0 || Number(metric.leads) > 0).map((metric) => metric.date)).size;
  const sample = evaluateCommercialSample({ leads: totalLeads, activeDays, minimumLeads: settings.minimum_leads, minimumActiveDays: settings.minimum_active_days });
  if (!sample.eligible) return defer(sample.reason);

  const leadTotals = new Map<string, number>();
  (metrics ?? []).forEach((metric) => leadTotals.set(metric.campaign_id, (leadTotals.get(metric.campaign_id) ?? 0) + Number(metric.leads)));
  const groups = new Map<string, CommercialDevelopment>();
  eligibleCampaigns.filter((campaign) => (leadTotals.get(campaign.id) ?? 0) > 0).forEach((campaign) => {
    const name = extractDevelopmentName(campaign.name, settings.parser_pattern, settings.parser_group);
    if (!name) return;
    const current = groups.get(name) ?? { name, campaignIds: [], campaignNames: [], spend: 0, leads: 0, impressions: 0, clicks: 0 };
    current.campaignIds.push(campaign.id);
    current.campaignNames.push(campaign.name);
    (metrics ?? []).filter((metric) => metric.campaign_id === campaign.id).forEach((metric) => {
      current.spend += Number(metric.spend);
      current.leads += Number(metric.leads);
      current.impressions += Number(metric.impressions);
      current.clicks += Number(metric.clicks);
    });
    groups.set(name, current);
  });
  const developments = Array.from(groups.values()).sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name));
  if (!developments.length) return defer("Nenhum empreendimento com leads foi identificado pelo padrão configurado.");

  const lastSlot = lastCollection ? inferCommercialAutomationSlot(lastCollection.name, lastCollection.meta_snapshot as Record<string, unknown>) : null;
  const slot = nextCommercialAutomationSlot(lastSlot);
  const template = await resolveTemplate(db, settings.user_id, slot);
  if (!template) return defer(`O template ${slot === "A" ? "Semanas 1 e 3" : "Semanas 2 e 4"} não está disponível.`);

  const collectionName = `${template.name} · ${format(new Date(`${today}T12:00:00`), "dd/MM/yyyy")}`;
  const automationKey = `commercial:${settings.client_id}:${today}`;
  const { data: createdCollection, error: collectionError } = await db.from("commercial_collections").insert({
    user_id: settings.user_id,
    client_id: settings.client_id,
    template_id: template.id,
    name: collectionName,
    slug: `analise-${today.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8)}`,
    period_start: window.start,
    period_end: window.end,
    status: "published",
    automation_key: automationKey,
    developments,
    meta_snapshot: { accounts: accountIds, questions: template.questions, generated_at: new Date().toISOString(), campaign_filter: "lead_generation_only", automation: true, automation_template_slot: slot, active_days: activeDays, minimum_active_days: settings.minimum_active_days, minimum_leads: settings.minimum_leads, email_recipients: brokers.map((broker) => ({ broker_id: broker.id, email: broker.email })) },
  }).select("id,name").single();
  const { data: existingCollection } = collectionError?.code === "23505"
    ? await db.from("commercial_collections").select("id,name").eq("automation_key", automationKey).maybeSingle()
    : { data: null };
  const collection = createdCollection ?? existingCollection;
  if (!collection) throw new Error(collectionError?.message ?? "Não foi possível criar a coleta");

  await db.from("commercial_collections").update({ status: "closed" }).eq("client_id", settings.client_id).eq("status", "published").neq("id", collection.id);

  const { error: deliveryError } = await db.from("commercial_collection_deliveries").upsert(brokers.map((broker) => ({
    user_id: settings.user_id,
    collection_id: collection.id,
    broker_id: broker.id,
    recipient_email: broker.email,
  })), { onConflict: "collection_id,broker_id", ignoreDuplicates: true });
  if (deliveryError) throw new Error(deliveryError.message);
  const delivery = await sendPendingDeliveries({ db, collection, clientName: client.name, publicSlug: settings.public_slug });
  const status = delivery.failed ? "partial" : "sent";
  const reason = delivery.failed
    ? `Coleta criada; ${delivery.sent} e-mail(s) enviado(s) e ${delivery.failed} pendente(s).`
    : `Coleta criada automaticamente e enviada para ${delivery.sent} corretor(es).`;
  await recordStatus(db, settings.id, status, reason, true);
  return { clientId: settings.client_id, status, reason, collectionId: collection.id };

  async function defer(reason: string): Promise<AutomationResult> {
    await recordStatus(db, settings.id, "deferred", reason);
    return { clientId: settings.client_id, status: "deferred", reason };
  }
}

export async function runCommercialCollectionAutomation(db: SupabaseClient, today = format(new Date(), "yyyy-MM-dd")) {
  const { data: rows, error } = await db.from("commercial_intelligence_settings").select("*").eq("is_active", true).eq("automation_enabled", true);
  if (error) throw new Error(error.message);
  const results: AutomationResult[] = [];
  for (const settings of (rows ?? []) as AutomationSettings[]) {
    const { data: check, error: checkError } = await db.from("commercial_automation_checks").insert({
      user_id: settings.user_id,
      settings_id: settings.id,
      client_id: settings.client_id,
      check_date: today,
      status: "running",
    }).select("id").single();
    if (checkError?.code === "23505") continue;
    if (checkError || !check) {
      results.push({ clientId: settings.client_id, status: "error", reason: checkError?.message ?? "Não foi possível iniciar a verificação" });
      continue;
    }
    try {
      const result = await processClient(db, settings, today);
      await db.from("commercial_automation_checks").update({ status: "completed", result }).eq("id", check.id);
      results.push(result);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Falha desconhecida";
      await recordStatus(db, settings.id, "error", reason);
      const result = { clientId: settings.client_id, status: "error" as const, reason };
      await db.from("commercial_automation_checks").update({ status: "error", result }).eq("id", check.id);
      results.push(result);
    }
  }
  return { processed: results.length, results };
}
