import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import type { FormStep } from "@/types";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { slug } = await context.params;
  const supabase = createAdminSupabaseClient();
  const { data: collection } = await supabase.from("commercial_collections")
    .select("id,client_id,name,slug,period_start,period_end,status,developments,meta_snapshot,agency_clients(name)")
    .eq("slug", slug).eq("status", "published").maybeSingle();
  if (!collection) return NextResponse.json({ error: "Coleta não encontrada ou encerrada" }, { status: 404 });
  const { data: brokers } = await supabase.from("commercial_brokers").select("id,name").eq("client_id", collection.client_id).eq("is_active", true).order("name");
  return NextResponse.json({
    collection: {
      id: collection.id, name: collection.name, period_start: collection.period_start, period_end: collection.period_end,
      developments: collection.developments, questions: (collection.meta_snapshot as { questions?: FormStep[] })?.questions ?? [],
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

  const { data: collection } = await supabase.from("commercial_collections").select("id,user_id,client_id,status,developments,meta_snapshot").eq("slug", slug).maybeSingle();
  if (!collection || collection.status !== "published") return NextResponse.json({ error: "Coleta encerrada" }, { status: 410 });
  const developments = collection.developments as Array<{ name: string }>;
  if (!developments.some((item) => item.name === body.development_name)) return NextResponse.json({ error: "Empreendimento inválido" }, { status: 400 });
  const { data: broker } = await supabase.from("commercial_brokers").select("id").eq("id", body.broker_id).eq("client_id", collection.client_id).eq("is_active", true).maybeSingle();
  if (!broker) return NextResponse.json({ error: "Corretor inválido" }, { status: 400 });

  const questions = ((collection.meta_snapshot as { questions?: FormStep[] })?.questions ?? []);
  const missing = questions.find((question) => question.required && (body.answers?.[question.id] === undefined || body.answers?.[question.id] === ""));
  if (missing) return NextResponse.json({ error: `Responda: ${missing.title}` }, { status: 400 });
  const ratingValues = questions.filter((question) => question.type === "rating").map((question) => Number(body.answers?.[question.id])).filter(Number.isFinite);
  const score = ratingValues.length ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length : null;
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
