import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  buildCommercialDiagnosis,
  DEFAULT_CAMPAIGN_PARSER,
  DEFAULT_COMMERCIAL_TEMPLATES,
  extractDevelopmentName,
  filterLeadGenerationDevelopments,
} from "@/lib/clientes/commercial-intelligence";
import type { CommercialCollection, CommercialDevelopment, CommercialResponse } from "@/types/commercial-intelligence";
import type { FormStep } from "@/types";
import { buildCommercialAnalysisEmail, getResendClient } from "@/lib/resend";

export const dynamic = "force-dynamic";

function normalizeSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function authenticated() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id é obrigatório" }, { status: 400 });

  const [settingsResult, brokersResult, accountsResult, templatesResult, collectionsResult, legacyResult] = await Promise.all([
    supabase.from("commercial_intelligence_settings").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("commercial_brokers").select("*").eq("client_id", clientId).order("name"),
    supabase.from("ad_platform_accounts").select("id,account_name,account_id,status,last_sync_at").eq("client_id", clientId).eq("platform", "meta").eq("status", "connected").order("account_name"),
    supabase.from("commercial_templates").select("*").eq("is_active", true).order("week_number"),
    supabase.from("commercial_collections").select("*").eq("client_id", clientId).order("period_end", { ascending: false }).limit(24),
    supabase.from("client_commercial_analyses").select("id,meeting_date,analysis_snapshot").eq("client_id", clientId).order("meeting_date", { ascending: false }),
  ]);

  const schemaError = [settingsResult, brokersResult, templatesResult, collectionsResult]
    .map((result) => result.error)
    .find((error) => error?.code === "42P01");
  if (schemaError) return NextResponse.json({ error: "A migração da nova Análise Comercial ainda não foi aplicada.", migrationRequired: true }, { status: 503 });

  const brokers = brokersResult.data ?? [];
  const rawCollections = (collectionsResult.data ?? []) as CommercialCollection[];
  const historicalCampaignIds = Array.from(new Set(rawCollections.flatMap((collection) => collection.developments.flatMap((development) => development.campaignIds))));
  const { data: historicalCampaigns } = historicalCampaignIds.length
    ? await supabase.from("campaigns").select("id,objective").in("id", historicalCampaignIds)
    : { data: [] };
  const objectivesByCampaignId = new Map((historicalCampaigns ?? []).map((campaign) => [campaign.id, campaign.objective]));
  const collections = rawCollections.map((collection) => ({
    ...collection,
    developments: filterLeadGenerationDevelopments(collection.developments, objectivesByCampaignId),
  }));
  const collectionIds = collections.map((item) => item.id);
  const { data: responses } = collectionIds.length
    ? await supabase.from("commercial_responses").select("*").in("collection_id", collectionIds).order("completed_at")
    : { data: [] };

  const allowedDevelopments = new Map(collections.map((collection) => [collection.id, new Set(collection.developments.map((development) => development.name))]));
  const responseRows = ((responses ?? []) as CommercialResponse[]).filter((response) => allowedDevelopments.get(response.collection_id)?.has(response.development_name));
  const responseCount = new Map<string, number>();
  responseRows.forEach((row) => responseCount.set(row.collection_id, (responseCount.get(row.collection_id) ?? 0) + 1));
  const enrichedCollections = collections.map((collection) => ({
    ...collection,
    response_count: responseCount.get(collection.id) ?? 0,
    expected_responses: brokers.filter((broker) => broker.is_active).length * collection.developments.length,
  }));

  return NextResponse.json({
    settings: settingsResult.data ?? null,
    brokers,
    accounts: accountsResult.data ?? [],
    templates: [
      ...DEFAULT_COMMERCIAL_TEMPLATES.map((template) => {
        const override = (templatesResult.data ?? []).find((item) => item.is_system && item.week_number === template.week);
        return { id: `default-${template.week}`, name: override?.name ?? template.name, description: override?.description ?? template.description, week_number: template.week, questions: override?.questions ?? template.questions, is_system: true };
      }),
      ...(templatesResult.data ?? []).filter((template) => !template.is_system),
    ],
    collections: enrichedCollections,
    dashboard: buildDashboard(enrichedCollections, brokers, responseRows),
    responses: responseRows,
    legacyAnalyses: legacyResult.data ?? [],
  });
}

export async function PUT(request: NextRequest) {
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const body = await request.json().catch(() => null) as {
    client_id?: string;
    frequency?: string;
    meta_account_ids?: string[];
    parser_pattern?: string;
    parser_group?: number;
    brokers?: Array<{ id?: string; name: string; email: string; phone?: string | null }>;
  } | null;
  if (!body?.client_id) return NextResponse.json({ error: "Cliente obrigatório" }, { status: 400 });
  if (!['weekly', 'biweekly', 'monthly'].includes(body.frequency ?? "")) return NextResponse.json({ error: "Frequência inválida" }, { status: 400 });
  try { new RegExp(body.parser_pattern || DEFAULT_CAMPAIGN_PARSER); } catch { return NextResponse.json({ error: "Expressão do parser inválida" }, { status: 400 }); }

  const { data: existingSettings } = await supabase.from("commercial_intelligence_settings").select("public_slug").eq("client_id", body.client_id).maybeSingle();
  const { data: client } = await supabase.from("agency_clients").select("name").eq("id", body.client_id).maybeSingle();
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const publicSlug = existingSettings?.public_slug || `${normalizeSlug(client.name) || "cliente"}-${body.client_id.slice(0, 6)}`;

  const { error: settingsError } = await supabase.from("commercial_intelligence_settings").upsert({
    user_id: user.id,
    client_id: body.client_id,
    frequency: body.frequency,
    meta_account_ids: body.meta_account_ids ?? [],
    parser_pattern: body.parser_pattern || DEFAULT_CAMPAIGN_PARSER,
    parser_group: body.parser_group ?? 1,
    public_slug: publicSlug,
  }, { onConflict: "user_id,client_id" });
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 400 });

  const brokers = (body.brokers ?? []).filter((broker) => broker.name.trim() && broker.email.trim());
  const suppliedIds = brokers.flatMap((broker) => broker.id ? [broker.id] : []);
  if (suppliedIds.length) {
    await supabase.from("commercial_brokers").update({ is_active: false }).eq("client_id", body.client_id).not("id", "in", `(${suppliedIds.join(",")})`);
  } else {
    await supabase.from("commercial_brokers").update({ is_active: false }).eq("client_id", body.client_id);
  }
  for (const broker of brokers) {
    const payload = { user_id: user.id, client_id: body.client_id, name: broker.name.trim(), email: broker.email.trim().toLowerCase(), phone: broker.phone?.trim() || null, is_active: true };
    const query = broker.id
      ? supabase.from("commercial_brokers").update(payload).eq("id", broker.id)
      : supabase.from("commercial_brokers").upsert(payload, { onConflict: "client_id,email" });
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");

  if (action === "attach_meta_account") {
    const clientId = String(body?.client_id ?? "");
    const accountId = String(body?.account_id ?? "");
    if (!clientId || !accountId) return NextResponse.json({ error: "Cliente e conta Meta são obrigatórios" }, { status: 400 });
    const [{ data: account }, { data: settings }, { data: client }] = await Promise.all([
      supabase.from("ad_platform_accounts").select("id").eq("id", accountId).eq("client_id", clientId).eq("platform", "meta").eq("status", "connected").maybeSingle(),
      supabase.from("commercial_intelligence_settings").select("meta_account_ids").eq("client_id", clientId).maybeSingle(),
      supabase.from("agency_clients").select("name").eq("id", clientId).maybeSingle(),
    ]);
    if (!account) return NextResponse.json({ error: "A conta Meta não foi vinculada a este cliente" }, { status: 400 });
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    const accountIds = Array.from(new Set([...(settings?.meta_account_ids as string[] ?? []), accountId]));
    const { error } = settings
      ? await supabase.from("commercial_intelligence_settings").update({ meta_account_ids: accountIds }).eq("client_id", clientId)
      : await supabase.from("commercial_intelligence_settings").insert({ user_id: user.id, client_id: clientId, meta_account_ids: accountIds, public_slug: `${normalizeSlug(client.name) || "cliente"}-${clientId.slice(0, 6)}` });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, account_id: accountId });
  }

  if (action === "update_public_slug") {
    const clientId = String(body?.client_id ?? "");
    const publicSlug = normalizeSlug(String(body?.public_slug ?? ""));
    if (!clientId || publicSlug.length < 3 || publicSlug.length > 80) return NextResponse.json({ error: "Use um endereço entre 3 e 80 caracteres" }, { status: 400 });
    const { data, error } = await supabase.from("commercial_intelligence_settings").update({ public_slug: publicSlug }).eq("client_id", clientId).eq("user_id", user.id).select("public_slug").single();
    if (error?.code === "23505") return NextResponse.json({ error: "Este endereço já está sendo usado por outro cliente" }, { status: 409 });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ public_slug: data.public_slug });
  }

  if (action === "send_test_email") {
    const clientId = String(body?.client_id ?? "");
    const recipient = String(body?.recipient_email ?? "").trim().toLowerCase();
    if (!clientId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400 });
    const [{ data: settings }, { data: client }, { data: collection }] = await Promise.all([
      supabase.from("commercial_intelligence_settings").select("public_slug").eq("client_id", clientId).eq("user_id", user.id).maybeSingle(),
      supabase.from("agency_clients").select("name").eq("id", clientId).maybeSingle(),
      supabase.from("commercial_collections").select("name").eq("client_id", clientId).eq("status", "published").order("period_end", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!settings?.public_slug) return NextResponse.json({ error: "Configure o link da imobiliária antes do teste" }, { status: 400 });
    if (!collection) return NextResponse.json({ error: "Ative uma coleta antes de testar o e-mail" }, { status: 400 });
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    const analysisLink = `${request.nextUrl.origin}/analise-comercial/${settings.public_slug}`;
    const { error } = await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to: recipient,
      subject: `[Teste] Análise Comercial · ${client.name}`,
      html: buildCommercialAnalysisEmail({ clientName: client.name, collectionName: collection.name, analysisLink, isTest: true }),
    });
    if (error) return NextResponse.json({ error: `Resend: ${error.message}` }, { status: 500 });
    return NextResponse.json({ ok: true, analysis_link: analysisLink });
  }

  if (action === "create_template" || action === "save_template") {
    const name = String(body?.name ?? "").trim();
    const questions = Array.isArray(body?.questions) ? body.questions as FormStep[] : [];
    if (!name || !questions.length) return NextResponse.json({ error: "Nome e perguntas são obrigatórios" }, { status: 400 });
    const templateId = String(body?.template_id ?? "");
    const defaultWeek = templateId.startsWith("default-") ? Number(templateId.split("-")[1]) : null;
    let query;
    if (defaultWeek) {
      const { data: existing } = await supabase.from("commercial_templates").select("id").eq("user_id", user.id).eq("is_system", true).eq("week_number", defaultWeek).maybeSingle();
      query = existing
        ? supabase.from("commercial_templates").update({ name, description: String(body?.description ?? "").trim() || null, questions }).eq("id", existing.id).select().single()
        : supabase.from("commercial_templates").insert({ user_id: user.id, name, description: String(body?.description ?? "").trim() || null, questions, is_system: true, week_number: defaultWeek }).select().single();
    } else if (templateId) {
      query = supabase.from("commercial_templates").update({ name, description: String(body?.description ?? "").trim() || null, questions }).eq("id", templateId).eq("is_system", false).select().single();
    } else {
      query = supabase.from("commercial_templates").insert({ user_id: user.id, name, description: String(body?.description ?? "").trim() || null, questions, is_system: false }).select().single();
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ template: data }, { status: 201 });
  }

  if (action === "save_broker") {
    const clientId = String(body?.client_id ?? "");
    const broker = body?.broker as { id?: string; name?: string; email?: string; phone?: string } | undefined;
    if (!clientId || !broker?.name?.trim() || !broker.email?.trim()) return NextResponse.json({ error: "Nome e e-mail são obrigatórios" }, { status: 400 });
    const payload = { user_id: user.id, client_id: clientId, name: broker.name.trim(), email: broker.email.trim().toLowerCase(), phone: broker.phone?.trim() || null, is_active: true };
    const query = broker.id
      ? supabase.from("commercial_brokers").update(payload).eq("id", broker.id).select().single()
      : supabase.from("commercial_brokers").upsert(payload, { onConflict: "client_id,email" }).select().single();
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ broker: data });
  }

  if (action === "delete_broker") {
    const brokerId = String(body?.broker_id ?? "");
    const clientId = String(body?.client_id ?? "");
    if (!brokerId || !clientId) return NextResponse.json({ error: "Corretor inválido" }, { status: 400 });
    const { error } = await supabase.from("commercial_brokers").update({ is_active: false }).eq("id", brokerId).eq("client_id", clientId).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_collection") {
    const clientId = String(body?.client_id ?? "");
    const start = String(body?.period_start ?? "");
    const end = String(body?.period_end ?? "");
    const templateId = String(body?.template_id ?? "default-1");
    if (!clientId || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return NextResponse.json({ error: "Cliente e período são obrigatórios" }, { status: 400 });

    const { data: settings } = await supabase.from("commercial_intelligence_settings").select("*").eq("client_id", clientId).maybeSingle();
    if (!settings) return NextResponse.json({ error: "Configure o cliente antes de gerar a coleta" }, { status: 400 });
    const accountIds = settings.meta_account_ids as string[];
    if (!accountIds.length) return NextResponse.json({ error: "Selecione ao menos uma conta Meta" }, { status: 400 });

    const { data: campaigns } = await supabase.from("campaigns").select("id,name,status,objective,platform_account_id").in("platform_account_id", accountIds);
    const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);
    const { data: metrics } = campaignIds.length
      ? await supabase.from("campaign_metrics").select("campaign_id,spend,leads,impressions,clicks,date").in("campaign_id", campaignIds).gte("date", start).lte("date", end)
      : { data: [] };
    const leadTotals = new Map<string, number>();
    (metrics ?? []).forEach((metric) => leadTotals.set(metric.campaign_id, (leadTotals.get(metric.campaign_id) ?? 0) + Number(metric.leads)));
    const groups = new Map<string, CommercialDevelopment>();
    const campaignsWithLeads = (campaigns ?? []).filter((campaign) => (leadTotals.get(campaign.id) ?? 0) > 0);
    const eligibleObjectives = new Set(["leads", "conversoes", "vendas"]);
    const metricsUnavailable = (metrics ?? []).length === 0;
    const sourceCampaigns = campaignsWithLeads.length
      ? campaignsWithLeads
      : metricsUnavailable
        ? (campaigns ?? []).filter((campaign) => campaign.status === "ativa" && eligibleObjectives.has(campaign.objective))
        : [];
    sourceCampaigns.forEach((campaign) => {
      const name = extractDevelopmentName(campaign.name, settings.parser_pattern, settings.parser_group);
      if (!name) return;
      const current = groups.get(name) ?? { name, campaignIds: [], campaignNames: [], spend: 0, leads: 0, impressions: 0, clicks: 0 };
      current.campaignIds.push(campaign.id); current.campaignNames.push(campaign.name);
      (metrics ?? []).filter((metric) => metric.campaign_id === campaign.id).forEach((metric) => {
        current.spend += Number(metric.spend); current.leads += Number(metric.leads); current.impressions += Number(metric.impressions); current.clicks += Number(metric.clicks);
      });
      groups.set(name, current);
    });
    const developments = Array.from(groups.values()).sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name));
    if (!developments.length) return NextResponse.json({ error: "Nenhuma campanha de captação gerou leads no período selecionado" }, { status: 400 });

    let templateDbId: string | null = null;
    let template;
    if (templateId.startsWith("default-")) {
      const week = Number(templateId.split("-")[1]);
      const base = DEFAULT_COMMERCIAL_TEMPLATES.find((item) => item.week === week);
      const { data: override } = await supabase.from("commercial_templates").select("id,name,description,questions").eq("user_id", user.id).eq("is_system", true).eq("week_number", week).maybeSingle();
      template = override ? { ...override, week } : base;
      templateDbId = override?.id ?? null;
    }
    else {
      const { data } = await supabase.from("commercial_templates").select("id,name,description,questions").eq("id", templateId).maybeSingle();
      template = data ? { ...data, week: null } : undefined; templateDbId = data?.id ?? null;
    }
    if (!template) return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });

    const slug = `analise-${end.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8)}`;
    await supabase.from("commercial_collections").update({ status: "closed" }).eq("client_id", clientId).eq("status", "published");
    const { data: collection, error } = await supabase.from("commercial_collections").insert({
      user_id: user.id, client_id: clientId, template_id: templateDbId,
      name: `${template.name} · ${new Date(`${end}T12:00:00`).toLocaleDateString("pt-BR")}`,
      slug, period_start: start, period_end: end, status: "published", developments,
      meta_snapshot: { accounts: accountIds, questions: template.questions, generated_at: new Date().toISOString(), metrics_pending: metricsUnavailable, campaign_filter: "lead_generation_only" },
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ collection, metrics_pending: metricsUnavailable }, { status: 201 });
  }

  if (action === "diagnose") {
    const collectionId = String(body?.collection_id ?? "");
    const { data: collection } = await supabase.from("commercial_collections").select("*").eq("id", collectionId).maybeSingle();
    if (!collection) return NextResponse.json({ error: "Coleta não encontrada" }, { status: 404 });
    const { data: responses } = await supabase.from("commercial_responses").select("*").eq("collection_id", collectionId);
    const diagnosis = buildCommercialDiagnosis(collection.developments as CommercialDevelopment[], (responses ?? []) as CommercialResponse[]);
    const { error } = await supabase.from("commercial_collections").update({ ai_diagnosis: diagnosis }).eq("id", collectionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ diagnosis });
  }
  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}

function buildDashboard(collections: Array<CommercialCollection & { expected_responses?: number }>, brokers: Array<{ id: string; name: string; is_active: boolean }>, responses: CommercialResponse[]) {
  const expectedResponses = collections.filter((item) => item.status !== "archived").reduce((sum, item) => sum + (item.expected_responses ?? 0), 0);
  const totalResponses = responses.length;
  const average = (rows: CommercialResponse[]) => {
    const scored = rows.filter((row) => row.score !== null); return scored.length ? scored.reduce((sum, row) => sum + Number(row.score), 0) / scored.length : 0;
  };
  const developmentNames = Array.from(new Set(collections.flatMap((item) => item.developments.map((development) => development.name))));
  const objections = new Map<string, number>(); responses.forEach((row) => { if (row.objection) objections.set(row.objection, (objections.get(row.objection) ?? 0) + 1); });
  return {
    responseRate: expectedResponses ? Math.round((totalResponses / expectedResponses) * 100) : 0,
    totalResponses, expectedResponses,
    byBroker: brokers.filter((broker) => broker.is_active).map((broker) => ({ id: broker.id, name: broker.name, responses: responses.filter((row) => row.broker_id === broker.id).length, expected: collections.reduce((sum, item) => sum + item.developments.length, 0) })),
    byDevelopment: developmentNames.map((name) => {
      const rows = responses.filter((row) => row.development_name === name); const meta = collections.flatMap((item) => item.developments).filter((item) => item.name === name);
      return { name, responses: rows.length, averageScore: Number(average(rows).toFixed(1)), leads: meta.reduce((sum, item) => sum + item.leads, 0), spend: meta.reduce((sum, item) => sum + item.spend, 0) };
    }).sort((a, b) => b.averageScore - a.averageScore || b.responses - a.responses),
    weeklyEvolution: collections.slice().reverse().map((item) => { const rows = responses.filter((row) => row.collection_id === item.id); return { label: new Date(`${item.period_end}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), responses: rows.length, averageScore: Number(average(rows).toFixed(1)) }; }),
    objections: Array.from(objections.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8),
  };
}
