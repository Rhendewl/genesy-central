import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { buildInsightsDomain } from "@/lib/analytics/domain";
import type { RawInsightsData, RawStepDefinition, RawSessionRow, RawEventRow, RawSubmissionRow } from "@/lib/analytics/types";
import type { Granularity } from "@/lib/analytics/metrics";

type Params = { params: Promise<{ id: string }> };

function autoGranularity(since?: string, until?: string): Granularity {
  if (!since) return "month";
  const from = new Date(since).getTime();
  const to   = until ? new Date(until).getTime() : Date.now();
  const days = (to - from) / 86_400_000;
  if (days <= 2)   return "hour";
  if (days <= 90)  return "day";
  if (days <= 365) return "week";
  return "month";
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
  const granularity: Granularity =
    (sp.get("granularity") as Granularity | null) ?? autoGranularity(since, until);

  const SESSION_COLS = [
    "id", "device", "browser", "os", "language", "country", "city",
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "referrer", "steps_completed", "is_partial", "started_at", "finished_at", "abandoned_at",
  ].join(", ");

  // ── Step 1: Fetch sessions (with device + time filter) ─────────────────────

  let sessQ = supabase
    .from("form_sessions")
    .select(SESSION_COLS)
    .eq("form_id", id)
    .order("started_at", { ascending: true });

  if (device) sessQ = sessQ.ilike("device", `%${device}%`);
  if (since)  sessQ = sessQ.gte("started_at", since);
  if (until)  sessQ = sessQ.lte("started_at", until);

  const sessionsRes = await sessQ;
  const sessionsData = (sessionsRes.data ?? []) as unknown as RawSessionRow[];
  const sessionIds   = (sessionsRes.data ?? []).map((s) => (s as unknown as { id: string }).id);

  // ── Prepare step definitions ───────────────────────────────────────────────

  const rawSteps = (form.steps as Array<{ id: string; title: string; type?: string }>) ?? [];
  const steps: RawStepDefinition[] = rawSteps.map(s => ({
    id:    s.id,
    title: s.title ?? "",
    type:  s.type,
  }));

  // ── Early return when device filter yields no sessions ─────────────────────

  if (device && sessionIds.length === 0) {
    const insights = buildInsightsDomain(
      { events: [], sessions: [], submissions: [], steps },
      0,
      granularity,
    );
    return NextResponse.json({ insights, granularity });
  }

  // ── Step 2: events + submissions in parallel ───────────────────────────────

  let evtQ = supabase
    .from("form_events")
    .select("event, step_id, duration, meta, created_at")
    .eq("form_id", id)
    .order("created_at", { ascending: true });

  if (since) evtQ = evtQ.gte("created_at", since);
  if (until) evtQ = evtQ.lte("created_at", until);
  if (device && sessionIds.length > 0) evtQ = evtQ.in("session_id", sessionIds);

  let subQ = supabase
    .from("form_submissions")
    .select("status, score, created_at")
    .eq("form_id", id)
    .order("created_at", { ascending: true });

  if (since) subQ = subQ.gte("created_at", since);
  if (until) subQ = subQ.lte("created_at", until);

  const [eventsRes, submissionsRes] = await Promise.all([evtQ, subQ]);

  // ── Build domain ───────────────────────────────────────────────────────────

  const periodDays = since
    ? Math.max(1, Math.ceil(
        (new Date(until ?? new Date().toISOString()).getTime() - new Date(since).getTime())
        / 86_400_000,
      ))
    : 9999;

  const rawData: RawInsightsData = {
    events:      (eventsRes.data      ?? []) as RawEventRow[],
    submissions: (submissionsRes.data ?? []) as RawSubmissionRow[],
    sessions:    sessionsData,
    steps,
  };

  const insights = buildInsightsDomain(rawData, periodDays, granularity);
  return NextResponse.json({ insights, granularity });
}
