import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  buildFormReport,
  buildRecommendations,
  type ReportEvent,
  type ReportGranularity,
  type ReportSession,
  type ReportStep,
  type ReportSubmission,
} from "@/lib/analytics/report";

type Params = { params: Promise<{ id: string }> };
type Db = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const PAGE = 1000;
const MAX_ROWS = 50_000;

function autoGranularity(since?: string, until?: string): ReportGranularity {
  if (!since) return "month";
  const from = new Date(since).getTime();
  const to   = until ? new Date(until).getTime() : Date.now();
  const days = (to - from) / 86_400_000;
  if (days <= 2)   return "hour";
  if (days <= 92)  return "day";
  if (days <= 366) return "week";
  return "month";
}

/** Lê todas as linhas em páginas de 1.000 (limite padrão do PostgREST). */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

const SESSION_COLS = [
  "id", "device", "browser", "os",
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "referrer", "fbclid", "gclid", "started_at", "finished_at",
].join(", ");

async function loadWindow(db: Db, formId: string, since: string | undefined, until: string | undefined, device: string | undefined) {
  let sessions = await fetchAll<ReportSession>((from, to) => {
    let q = db.from("form_sessions").select(SESSION_COLS).eq("form_id", formId).order("started_at", { ascending: true }).range(from, to);
    if (since) q = q.gte("started_at", since);
    if (until) q = q.lte("started_at", until);
    return q;
  });
  if (device) sessions = sessions.filter(s => (s.device ?? "").toLowerCase().includes(device));
  const ids = new Set(sessions.map(s => s.id));

  // Respostas e eventos podem acontecer um pouco depois do acesso: a janela
  // termina um dia depois do período e o vínculo é feito pela sessão.
  const tail = until ? new Date(Date.parse(until) + 86_400_000).toISOString() : undefined;
  const [submissions, events] = await Promise.all([
    fetchAll<ReportSubmission>((from, to) => {
      let q = db.from("form_submissions").select("session_id, status, score, created_at, answers").eq("form_id", formId).order("created_at", { ascending: true }).range(from, to);
      if (since) q = q.gte("created_at", since);
      if (tail)  q = q.lte("created_at", tail);
      return q;
    }),
    fetchAll<ReportEvent>((from, to) => {
      let q = db.from("form_events").select("session_id, event, step_id, duration, created_at").eq("form_id", formId).order("created_at", { ascending: true }).range(from, to);
      if (since) q = q.gte("created_at", since);
      if (tail)  q = q.lte("created_at", tail);
      return q;
    }),
  ]);

  return {
    sessions,
    submissions: submissions.filter(s => s.session_id && ids.has(s.session_id)),
    events: events.filter(e => e.session_id && ids.has(e.session_id)),
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: form } = await supabase
    .from("forms")
    .select("id, steps")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!form) return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });

  const sp          = req.nextUrl.searchParams;
  const since       = sp.get("since")  ?? undefined;
  const until       = sp.get("until")  ?? undefined;
  const deviceParam = sp.get("device") ?? undefined;
  const device      = deviceParam && deviceParam !== "todos" ? deviceParam.toLowerCase() : undefined;
  const granularity = (sp.get("granularity") as ReportGranularity | null) ?? autoGranularity(since, until);

  const steps: ReportStep[] = ((form.steps as Array<{ id: string; title: string; type?: string }>) ?? [])
    .map(s => ({ id: s.id, title: s.title ?? "", type: s.type }));

  try {
    const current = await loadWindow(supabase, id, since, until, device);
    const report = buildFormReport({ steps, granularity, since, until, ...current });

    // Comparação com o período imediatamente anterior, de mesmo tamanho.
    let previous = null;
    if (since) {
      const end = until ? Date.parse(until) : Date.now();
      const length = end - Date.parse(since);
      if (length > 0) {
        const prevSince = new Date(Date.parse(since) - length).toISOString();
        const prevUntil = new Date(Date.parse(since) - 1).toISOString();
        const prev = await loadWindow(supabase, id, prevSince, prevUntil, device);
        previous = buildFormReport({ steps, granularity, since: prevSince, until: prevUntil, ...prev }).summary;
      }
    }

    return NextResponse.json({
      report,
      previous,
      recommendations: buildRecommendations(report, { totalSteps: steps.length }),
      granularity,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível montar os insights" }, { status: 500 });
  }
}
