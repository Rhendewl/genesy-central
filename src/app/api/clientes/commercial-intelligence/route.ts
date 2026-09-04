import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  buildCommercialDiagnosis,
  DEFAULT_CAMPAIGN_PARSER,
  DEFAULT_COMMERCIAL_TEMPLATES,
  extractDevelopmentName,
} from "@/lib/clientes/commercial-intelligence";
import type { CommercialCollection, CommercialDevelopment, CommercialResponse } from "@/types/commercial-intelligence";
import type { FormStep } from "@/types";

export const dynamic = "force-dynamic";

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
    supabase.from("ad_platform_accounts").select("id,account_name,account_id,status,last_sync_at").eq("client_id", clientId).eq("platform", "meta").order("account_name"),
    supabase.from("commercial_templates").select("*").eq("is_active", true).order("week_number"),
    supabase.from("commercial_collections").select("*").eq("client_id", clientId).order("period_end", { ascending: false }).limit(24),
    supabase.from("client_commercial_analyses").select("id,meeting_date,analysis_snapshot").eq("client_id", clientId).order("meeting_date", { ascending: false }),
  ]);

  const schemaError = [settingsResult, brokersResult, templatesResult, collectionsResult]
    .map((result) => result.error)
    .find((error) => error?.code === "42P01");
  if (schemaError) return NextResponse.json({ error: "A migração da nova Análise Comercial ainda não foi aplicada.", migrationRequired: true }, { status: 503 });

  const brokers = brokersResult.data ?? [];
  const collections = (collectionsResult.data ?? []) as CommercialCollection[];
  const collectionIds = collections.map((item) => item.id);
  const { data: responses } = collectionIds.length
    ? await supabase.from("commercial_responses").select("*").in("collection_id", collectionIds).order("completed_at")
    : { data: [] };

  const responseRows = (responses ?? []) as CommercialResponse[];
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
      ...DEFAULT_COMMERCIAL_TEMPLATES.map((template) => ({ id: `default-${template.week}`, name: template.name, description: template.description, week_number: template.week, questions: template.questions, is_system: true })),
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

  const { error: settingsError } = await supabase.from("commercial_intelligence_settings").upsert({
    user_id: user.id,
    client_id: body.client_id,
    frequency: body.frequency,
    meta_account_ids: body.meta_account_ids ?? [],
    parser_pattern: body.parser_pattern || DEFAULT_CAMPAIGN_PARSER,
    parser_group: body.parser_group ?? 1,
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

  if (action === "create_template") {
    const name = String(body?.name ?? "").trim();
    const questions = Array.isArray(body?.questions) ? body.questions as FormStep[] : [];
    if (!name || !questions.length) return NextResponse.json({ error: "Nome e perguntas são obrigatórios" }, { status: 400 });
    const { data, error } = await supabase.from("commercial_templates").insert({ user_id: user.id, name, description: String(body?.description ?? "").trim() || null, questions, is_system: false }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ template: data }, { status: 201 });
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

    const { data: campaigns } = await supabase.from("campaigns").select("id,name,platform_account_id").eq("client_id", clientId).in("platform_account_id", accountIds);
    const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);
    const { data: metrics } = campaignIds.length
      ? await supabase.from("campaign_metrics").select("campaign_id,spend,leads,impressions,clicks,date").in("campaign_id", campaignIds).gte("date", start).lte("date", end)
      : { data: [] };
    const delivered = new Set((metrics ?? []).filter((metric) => Number(metric.impressions) > 0 || Number(metric.spend) > 0 || Number(metric.leads) > 0).map((metric) => metric.campaign_id));
    const groups = new Map<string, CommercialDevelopment>();
    (campaigns ?? []).filter((campaign) => delivered.has(campaign.id)).forEach((campaign) => {
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
    if (!developments.length) return NextResponse.json({ error: "Nenhuma campanha com entrega foi encontrada no período" }, { status: 400 });

    let templateDbId: string | null = null;
    let template;
    if (templateId.startsWith("default-")) template = DEFAULT_COMMERCIAL_TEMPLATES.find((item) => item.week === Number(templateId.split("-")[1]));
    else {
      const { data } = await supabase.from("commercial_templates").select("id,name,description,questions").eq("id", templateId).maybeSingle();
      template = data ? { ...data, week: null } : undefined; templateDbId = data?.id ?? null;
    }
    if (!template) return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });

    const slug = `analise-${end.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8)}`;
    const { data: collection, error } = await supabase.from("commercial_collections").insert({
      user_id: user.id, client_id: clientId, template_id: templateDbId,
      name: `${template.name} · ${new Date(`${end}T12:00:00`).toLocaleDateString("pt-BR")}`,
      slug, period_start: start, period_end: end, status: "published", developments,
      meta_snapshot: { accounts: accountIds, questions: template.questions, generated_at: new Date().toISOString() },
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ collection }, { status: 201 });
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
