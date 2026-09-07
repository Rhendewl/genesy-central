import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { calculateCommercialScore, filterLeadGenerationDevelopments } from "@/lib/clientes/commercial-intelligence";
import type { CommercialDevelopment } from "@/types/commercial-intelligence";
import type { FormStep } from "@/types";

type Context = { params: Promise<{ slug: string }> };

async function resolveCollection(supabase: ReturnType<typeof createAdminSupabaseClient>, slug: string) {
  const fields = "id,user_id,client_id,name,slug,period_start,period_end,status,developments,meta_snapshot,agency_clients(name)";
  const { data: direct } = await supabase.from("commercial_collections").select(fields).eq("slug", slug).eq("status", "published").maybeSingle();
  if (direct) return direct;
  const { data: settings } = await supabase.from("commercial_intelligence_settings").select("client_id").eq("public_slug", slug).eq("is_active", true).maybeSingle();
  if (!settings) return null;
  const { data } = await supabase.from("commercial_collections").select(fields).eq("client_id", settings.client_id).eq("status", "published").order("period_end", { ascending: false }).limit(1).maybeSingle();
  return data;
}

async function getEligibleDevelopments(supabase: ReturnType<typeof createAdminSupabaseClient>, collection: { developments: unknown }) {
  const developments = collection.developments as CommercialDevelopment[];
  const campaignIds = Array.from(new Set(developments.flatMap((development) => development.campaignIds)));
  const { data: campaigns } = campaignIds.length
    ? await supabase.from("campaigns").select("id,objective").in("id", campaignIds)
    : { data: [] };
  return filterLeadGenerationDevelopments(developments, new Map((campaigns ?? []).map((campaign) => [campaign.id, campaign.objective])));
}

export async function GET(_request: NextRequest, context: Context) {
  const { slug } = await context.params;
  const supabase = createAdminSupabaseClient();
  const collection = await resolveCollection(supabase, slug);
  if (!collection) return NextResponse.json({ error: "Coleta não encontrada ou encerrada" }, { status: 404 });
  const developments = await getEligibleDevelopments(supabase, collection);
  if (!developments.length) return NextResponse.json({ error: "Nenhuma campanha de captação com leads está disponível nesta coleta" }, { status: 404 });
  const { data: brokers } = await supabase.from("commercial_brokers").select("id,name").eq("client_id", collection.client_id).eq("is_active", true).order("name");
  return NextResponse.json({
    collection: {
      id: collection.id, name: collection.name, period_start: collection.period_start, period_end: collection.period_end,
      developments, questions: (collection.meta_snapshot as { questions?: FormStep[] })?.questions ?? [],
      clientName: Array.isArray(collection.agency_clients) ? collection.agency_clients[0]?.name : (collection.agency_clients as { name?: string } | null)?.name,
    },
    brokers: brokers ?? [],
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest, context: Context) {
  const { slug } = await context.params;
  const supabase = createAdminSupabaseClient();
  const body = await request.json().catch(() => null) as { broker_id?: string; development_name?: string; answers?: Record<string, unknown>; respondent_key?: string } | null;
  if (!body?.broker_id || !body.development_name || !body.answers) return NextResponse.json({ error: "Resposta incompleta" }, { status: 400 });

  const collection = await resolveCollection(supabase, slug);
  if (!collection || collection.status !== "published") return NextResponse.json({ error: "Coleta encerrada" }, { status: 410 });
  const developments = await getEligibleDevelopments(supabase, collection);
  if (!developments.some((item) => item.name === body.development_name)) return NextResponse.json({ error: "Empreendimento inválido" }, { status: 400 });
  const { data: broker } = await supabase.from("commercial_brokers").select("id").eq("id", body.broker_id).eq("client_id", collection.client_id).eq("is_active", true).maybeSingle();
  if (!broker) return NextResponse.json({ error: "Corretor inválido" }, { status: 400 });

  const questions = ((collection.meta_snapshot as { questions?: FormStep[] })?.questions ?? []);
  const missing = questions.find((question) => {
    const answer = body.answers?.[question.id];
    return question.required && (answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0));
  });
  if (missing) return NextResponse.json({ error: `Responda: ${missing.title}` }, { status: 400 });
  const score = calculateCommercialScore(questions, body.answers);
  const objectionQuestion = questions.find((question) => /obje[cç][aã]o|barreira|dificuldade|sinal/i.test(`${question.id} ${question.title}`));
  const objectionValue = objectionQuestion ? body.answers[objectionQuestion.id] : null;
  const objection = typeof objectionValue === "string" && objectionValue.trim() ? objectionValue.trim().slice(0, 300) : null;

  const { data, error } = await supabase.from("commercial_responses").upsert({
    user_id: collection.user_id, collection_id: collection.id, broker_id: broker.id,
    development_name: body.development_name, answers: body.answers, score, objection,
    respondent_key: body.respondent_key?.slice(0, 100) || null, completed_at: new Date().toISOString(),
  }, { onConflict: "collection_id,broker_id,development_name" }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ response_id: data.id });
}
