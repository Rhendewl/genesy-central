import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  SubmissionListItem, SubmissionDetail, SessionEvent,
  IntegrationDelivery, SubmissionPatch, SubmissionStatus,
} from "@/lib/respostas/types";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_PATCH_KEYS = new Set(["starred", "archived", "read_at", "status"]);
const ALLOWED_STATUSES   = new Set(["partial", "started", "completed", "spam", "abandoned"]);

// ── GET /api/respostas/:id ────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // ── Fetch submission (with ownership check) ───────────────────────────────────

  const { data: sub, error: subErr } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (subErr || !sub) {
    return NextResponse.json({ error: "Resposta não encontrada" }, { status: 404 });
  }

  // ── Fetch session, events, deliveries in parallel ─────────────────────────────

  const sessionId = sub.session_id as string | null;

  // Fetch session, form, and events in parallel — all depend only on IDs available
  // immediately from sub. Deliveries are sequential because corrId requires sess.token.
  const [sessionRes, formRes, eventsRes] = await Promise.all([
    sessionId
      ? supabase.from("form_sessions").select("*").eq("id", sessionId).single()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("forms").select("name, slug").eq("id", sub.form_id as string).single(),
    sessionId
      ? supabase
          .from("form_events")
          .select("id, step_id, event, duration, created_at, meta")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const sess = sessionRes.data;
  const form = formRes.data;
  // Use correlation_id from submission, fallback to session token
  const corrId = (sub.correlation_id as string | null) ?? (sess?.token as string | null) ?? null;

  const sessionEvents: SessionEvent[] = ((eventsRes.data ?? []) as Record<string, unknown>[]).map(e => ({
    id:         e.id as string,
    step_id:    (e.step_id as string | null) ?? null,
    event:      e.event as string,
    duration:   (e.duration as number | null) ?? null,
    created_at: e.created_at as string,
    meta:       (e.meta as Record<string, unknown> | null) ?? null,
  }));

  // ── Integration deliveries ────────────────────────────────────────────────────
  // Primary: by correlation_id (covers event-bus events)
  // Fallback: by form_id + delivered_at near submission time (if correlation_id is null)

  const { data: deliveriesRaw } = corrId
    ? await supabase
        .from("integration_deliveries")
        .select("id, adapter_name, event_id, correlation_id, event_type, attempt, ok, status_code, duration_ms, error, delivered_at")
        .eq("form_id", sub.form_id as string)
        .eq("correlation_id", corrId)
        .order("delivered_at", { ascending: true })
    : { data: [] };

  const integrationDeliveries: IntegrationDelivery[] = (deliveriesRaw ?? []).map(d => ({
    id:             d.id as string,
    adapter_name:   d.adapter_name as string,
    event_id:       d.event_id as string,
    correlation_id: d.correlation_id as string,
    event_type:     d.event_type as string,
    attempt:        d.attempt as number,
    ok:             d.ok as boolean,
    status_code:    (d.status_code as number | null) ?? null,
    duration_ms:    (d.duration_ms as number | null) ?? null,
    error:          (d.error as string | null) ?? null,
    delivered_at:   d.delivered_at as string,
  }));

  // ── Build submission item ──────────────────────────────────────────────────────

  const submission: SubmissionListItem = {
    id:              sub.id as string,
    form_id:         sub.form_id as string,
    session_id:      sessionId,
    correlation_id:  corrId,
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
    // Session
    session_token:   (sess?.token as string | null) ?? null,
    device:          (sess?.device   as string | null) ?? null,
    browser:         (sess?.browser  as string | null) ?? null,
    os:              (sess?.os       as string | null) ?? null,
    country:         (sess?.country  as string | null) ?? null,
    city:            (sess?.city     as string | null) ?? null,
    utm_source:      (sess?.utm_source   as string | null) ?? null,
    utm_medium:      (sess?.utm_medium   as string | null) ?? null,
    utm_campaign:    (sess?.utm_campaign as string | null) ?? null,
    utm_term:        (sess?.utm_term     as string | null) ?? null,
    utm_content:     (sess?.utm_content  as string | null) ?? null,
    fbclid:          (sess?.fbclid       as string | null) ?? null,
    gclid:           (sess?.gclid        as string | null) ?? null,
    referrer:        (sess?.referrer     as string | null) ?? null,
    // Form
    form_name:       (form?.name as string) ?? "",
    form_slug:       (form?.slug as string) ?? "",
  };

  const detail: SubmissionDetail = { submission, sessionEvents, integrationDeliveries };
  return NextResponse.json(detail);
}

// ── PATCH /api/respostas/:id ──────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;

  // Strip keys that are not allowed for PATCH
  const patch: Record<string, unknown> = {};
  for (const key of Array.from(ALLOWED_PATCH_KEYS)) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 400 });
  }

  // Validate status if present
  if ("status" in patch && !ALLOWED_STATUSES.has(patch.status as string)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  // Auto-set read_at when starred/archived (mark as read)
  if (patch.starred === true || patch.archived === true) {
    if (!("read_at" in patch)) {
      patch.read_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from("form_submissions")
    .update(patch as SubmissionPatch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Resposta não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ submission: data });
}
