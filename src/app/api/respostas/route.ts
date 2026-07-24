import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { encodeCursor, decodeCursor } from "@/lib/respostas/cursor";
import type {
  SubmissionListItem, SubmissionStats, SubmissionsListResponse,
  SortField, SortDirection, SubmissionStatus,
} from "@/lib/respostas/types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 100;

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

// Only the columns used when building SubmissionListItem — avoids fetching
// large unused columns (e.g. raw metadata blobs) from form_sessions.
const SESSION_COLS = [
  "id", "token", "device", "browser", "os", "country", "city",
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "referrer",
].join(", ");

// Shape returned by get_submission_stats RPC
interface StatsRow { total: number | string; completed: number | string; abandoned: number | string }

// ── GET /api/respostas ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;

  const formId    = sp.get("form_id") ?? undefined;
  const rawCursor = sp.get("cursor") ?? undefined;
  const limit     = Math.min(Number(sp.get("limit") ?? DEFAULT_LIMIT), MAX_LIMIT);
  const q         = sp.get("q")?.trim() ?? undefined;
  const status    = (sp.get("status") ?? undefined) as SubmissionStatus | undefined;
  const starred   = sp.get("starred") === "1" ? true : sp.get("starred") === "0" ? false : undefined;
  const archived  = sp.get("archived") === "1";
  const sort      = (sp.get("sort") ?? "created_at") as SortField;
  const direction = (sp.get("direction") ?? "desc") as SortDirection;
  const asc       = direction === "asc";
  const since     = sp.get("since") ?? undefined;
  const until     = sp.get("until") ?? undefined;
  const userId    = user.id;

  // ── Build data query (synchronous — no round-trip yet) ────────────────────

  let dataQuery = supabase
    .from("form_submissions")
    .select("*")
    .eq("user_id", userId)
    .eq("archived", archived);

  if (formId)                dataQuery = dataQuery.eq("form_id", formId);
  if (status)                dataQuery = dataQuery.eq("status", status);
  if (starred !== undefined) dataQuery = dataQuery.eq("starred", starred);
  if (since)                 dataQuery = dataQuery.gte("created_at", since);
  if (until)                 dataQuery = dataQuery.lte("created_at", until);

  if (q && q.length >= 3) {
    dataQuery = dataQuery.textSearch("answers_tsv", q, { type: "websearch", config: "portuguese" });
  }

  const cursor = rawCursor ? decodeCursor(rawCursor) : null;
  if (cursor) {
    dataQuery = asc
      ? dataQuery.or(`created_at.gt.${cursor.ca},and(created_at.eq.${cursor.ca},id.gt.${cursor.id})`)
      : dataQuery.or(`created_at.lt.${cursor.ca},and(created_at.eq.${cursor.ca},id.lt.${cursor.id})`);
  }

  dataQuery = dataQuery
    .order(sort, { ascending: asc })
    .order("id", { ascending: asc })
    .limit(limit + 1);

  // ── Phase 1: stats RPC + data query in parallel ───────────────────────────
  // get_submission_stats: 1 aggregate pass instead of 3 separate COUNT queries.
  // Running in parallel with the data query saves data_query_time.

  const [statsResult, dataResult] = await Promise.all([
    supabase.rpc("get_submission_stats", {
      p_user_id:  userId,
      p_archived: archived,
      p_form_id:  formId ?? null,
    }),
    dataQuery,
  ]);

  if (dataResult.error) {
    return NextResponse.json({ error: dataResult.error.message }, { status: 500 });
  }

  const statsRow   = (statsResult.data as StatsRow[] | null)?.[0];
  const total      = Number(statsRow?.total     ?? 0);
  const completed  = Number(statsRow?.completed ?? 0);
  const abandoned  = Number(statsRow?.abandoned ?? 0);

  const stats: SubmissionStats = {
    total,
    completed,
    abandoned,
    completionRate:  total > 0 ? completed / total : 0,
    avgTimeOnFormMs: 0,
  };

  const submissions = ((dataResult.data ?? []) as Row[]);
  const hasMore     = submissions.length > limit;
  const page        = hasMore ? submissions.slice(0, limit) : submissions;

  // ── Phase 2: batch-fetch sessions + forms in parallel ────────────────────
  // Both are independent of each other — run concurrently.
  // SESSION_COLS avoids fetching unused columns.

  const sessionIds = Array.from(
    new Set(page.map(s => s.session_id as string | null).filter((id): id is string => id !== null))
  );
  const formIds = Array.from(
    new Set(page.map(s => s.form_id as string | null).filter((id): id is string => id !== null))
  );

  const [sessionsResult, formsResult] = await Promise.all([
    sessionIds.length > 0
      ? supabase.from("form_sessions").select(SESSION_COLS).in("id", sessionIds)
      : { data: [] as Row[] },
    formIds.length > 0
      ? supabase.from("forms").select("id, name, slug").in("id", formIds)
      : { data: [] as Row[] },
  ]);

  const sessionMap = new Map<string, Row>(
    ((sessionsResult.data ?? []) as Row[]).map(s => [s.id as string, s])
  );
  const formMap = new Map<string, Row>(
    ((formsResult.data ?? []) as Row[]).map(f => [f.id as string, f])
  );

  // ── Merge + flatten ───────────────────────────────────────────────────────

  const items: SubmissionListItem[] = page.map((sub: Row) => {
    const sessionId = sub.session_id as string | null;
    const sess = sessionId ? sessionMap.get(sessionId) : undefined;
    const form = formMap.get(sub.form_id as string);

    return {
      id:              sub.id as string,
      form_id:         sub.form_id as string,
      session_id:      sessionId,
      correlation_id:  (sub.correlation_id as string | null) ?? null,
      status:          (sub.status as SubmissionStatus) ?? "started",
      answers:         (sub.answers as Record<string, unknown>) ?? {},
      score:           (sub.score as number | null) ?? null,
      step_timings:    (sub.step_timings as Record<string, number>) ?? {},
      drop_off_step:   (sub.drop_off_step as string | null) ?? null,
      time_on_form_ms: (sub.time_on_form_ms as number | null) ?? null,
      read_at:         (sub.read_at as string | null) ?? null,
      starred:         (sub.starred as boolean) ?? false,
      archived:        (sub.archived as boolean) ?? false,
      completed_at:    (sub.completed_at as string | null) ?? null,
      created_at:      sub.created_at as string,
      updated_at:      (sub.updated_at as string) ?? (sub.created_at as string),
      session_token:   (sess?.token as string | null) ?? null,
      device:          (sess?.device  as string | null) ?? null,
      browser:         (sess?.browser as string | null) ?? null,
      os:              (sess?.os      as string | null) ?? null,
      country:         (sess?.country as string | null) ?? null,
      city:            (sess?.city    as string | null) ?? null,
      utm_source:      (sess?.utm_source   as string | null) ?? null,
      utm_medium:      (sess?.utm_medium   as string | null) ?? null,
      utm_campaign:    (sess?.utm_campaign as string | null) ?? null,
      utm_term:        (sess?.utm_term     as string | null) ?? null,
      utm_content:     (sess?.utm_content  as string | null) ?? null,
      fbclid:          (sess?.fbclid       as string | null) ?? null,
      gclid:           (sess?.gclid        as string | null) ?? null,
      referrer:        (sess?.referrer     as string | null) ?? null,
      form_name:       (form?.name as string) ?? "",
      form_slug:       (form?.slug as string) ?? "",
    };
  });

  // ── Encode next cursor ────────────────────────────────────────────────────

  const lastItem   = page.at(-1);
  const nextCursor = hasMore && lastItem
    ? encodeCursor(lastItem.created_at as string, lastItem.id as string)
    : null;

  const response: SubmissionsListResponse = { items, nextCursor, stats };
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

// ── DELETE /api/respostas — exclusão em lote ──────────────────────────────────

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as { ids?: unknown };
  const ids = body.ids;

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(id => typeof id === "string")) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }

  const { error } = await supabase
    .from("form_submissions")
    .delete()
    .in("id", ids as string[])
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: ids.length });
}
