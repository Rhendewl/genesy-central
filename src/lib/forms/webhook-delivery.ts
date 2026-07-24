import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormStep } from "@/types";
import { decryptToken } from "@/lib/crypto";
import { signPayload } from "@/lib/integrations/security/hmac";
import { computeDelay, DEFAULT_RETRY_POLICY, isRetryable, mergeRetryPolicy } from "@/lib/integrations/retry";
import type { RetryPolicy } from "@/lib/integrations/types";

type AdminClient = SupabaseClient;

interface WebhookJob {
  id: string;
  integration_id: string;
  form_id: string;
  submission_id: string;
  event_id: string;
  correlation_id: string;
  event_type: string;
  status: "pending" | "processing" | "retry" | "delivered" | "dead_letter";
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
}

interface WebhookIntegration {
  id: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  secrets: Record<string, string>;
  retry_policy: Partial<RetryPolicy> | null;
}

export interface WebhookRunResult {
  processed: number;
  delivered: number;
  retried: number;
  deadLettered: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function resolveSecrets(secrets: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(secrets).map(([key, value]) => [
    key,
    value.startsWith("enc:") ? decryptToken(value.slice(4)) : value,
  ]));
}

function isPrivateIp(address: string): boolean {
  if (address === "::1" || address === "::" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) return true;
  if (address.startsWith("::ffff:")) return isPrivateIp(address.slice(7));
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
    a >= 224;
}

/** Bloqueia destinos locais/privados para impedir SSRF pelo webhook configurável. */
export async function validateWebhookUrl(rawUrl: unknown): Promise<URL> {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) throw new Error("URL do webhook não configurada");
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("URL do webhook inválida"); }
  if (url.protocol !== "https:") throw new Error("O webhook deve usar HTTPS");
  if (url.username || url.password) throw new Error("Credenciais não são permitidas na URL do webhook");
  if (url.port && url.port !== "443") throw new Error("O webhook deve usar a porta HTTPS padrão");

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Destino local não permitido");
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(item => isPrivateIp(item.address))) {
    throw new Error("Destino privado ou reservado não permitido");
  }
  return url;
}

function readableAnswer(step: FormStep, rawValue: unknown): unknown {
  if (!step.choices?.length) return rawValue;

  const resolveChoice = (value: unknown) => {
    if (typeof value !== "string") return value;
    const choice = step.choices?.find(item =>
      item.id === value || item.value === value || item.label === value,
    );
    return choice?.label ?? value;
  };

  return Array.isArray(rawValue) ? rawValue.map(resolveChoice) : resolveChoice(rawValue);
}

export function buildWebhookAnswerViews(steps: FormStep[], answers: Record<string, unknown>) {
  const usedLabels = new Map<string, number>();
  const answersByQuestion: Record<string, unknown> = {};
  const fields = steps
    .filter(step => Object.prototype.hasOwnProperty.call(answers, step.id))
    .map((step, index) => {
      const baseLabel = step.title.trim() || `Pergunta ${index + 1}`;
      const occurrence = (usedLabels.get(baseLabel) ?? 0) + 1;
      usedLabels.set(baseLabel, occurrence);
      const question = occurrence === 1 ? baseLabel : `${baseLabel} (${occurrence})`;
      const rawValue = answers[step.id];
      const answer = readableAnswer(step, rawValue);
      answersByQuestion[question] = answer;

      return {
        id: step.id,
        question,
        label: baseLabel,
        type: step.type,
        answer,
        value: rawValue,
        raw_value: rawValue,
      };
    });

  return { answersByQuestion, fields };
}

function sampleAnswer(step: FormStep): unknown {
  if (step.choices?.length) {
    const first = step.choices[0];
    const value = first.value || first.id || first.label;
    return step.type === "multiple_choice" ? [value] : value;
  }

  switch (step.type) {
    case "name": return "Pessoa de teste";
    case "email": return "teste@exemplo.com";
    case "phone": return "+55 11 99999-9999";
    case "number": return 10;
    case "rating": return Math.min(step.maxRating ?? 5, 5);
    case "nps_scale": return 10;
    case "date": return new Date().toISOString().slice(0, 10);
    case "file_upload": return "https://exemplo.com/arquivo-teste.pdf";
    case "calendar": return new Date().toISOString();
    case "statement":
    case "redirect": return undefined;
    default: return `Resposta de teste: ${step.title}`;
  }
}

function sampleAnswers(steps: FormStep[]): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (const step of steps) {
    const answer = sampleAnswer(step);
    if (answer !== undefined) answers[step.id] = answer;
  }
  return answers;
}

async function buildWebhookPayload(db: AdminClient, job: WebhookJob) {
  const { data: submission, error: submissionError } = await db
    .from("form_submissions")
    .select("id, session_id, status, answers, score, completed_at, created_at, updated_at")
    .eq("id", job.submission_id)
    .single();
  if (submissionError || !submission) throw new Error("Submissão do webhook não encontrada");

  const [{ data: form }, { data: session }] = await Promise.all([
    db.from("forms").select("id, name, slug, steps").eq("id", job.form_id).single(),
    submission.session_id
      ? db.from("form_sessions")
          .select("id, device, browser, os, language, country, city, utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid, referrer, started_at, finished_at")
          .eq("id", submission.session_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!form) throw new Error("Formulário do webhook não encontrado");

  const answers = asRecord(submission.answers);
  const steps = (form.steps ?? []) as FormStep[];
  const { answersByQuestion, fields } = buildWebhookAnswerViews(steps, answers);
  return {
    id: job.event_id,
    event_type: job.event_type,
    correlation_id: job.correlation_id,
    timestamp: submission.completed_at ?? submission.updated_at ?? new Date().toISOString(),
    version: 2,
    form: { id: form.id, name: form.name, slug: form.slug },
    submission: {
      id: submission.id,
      status: submission.status,
      score: submission.score,
      answers,
      answers_by_question: answersByQuestion,
      fields,
      created_at: submission.created_at,
      completed_at: submission.completed_at,
    },
    session: session ? {
      id: session.id,
      device: session.device,
      browser: session.browser,
      os: session.os,
      language: session.language,
      country: session.country,
      city: session.city,
      utm: {
        source: session.utm_source,
        medium: session.utm_medium,
        campaign: session.utm_campaign,
        term: session.utm_term,
        content: session.utm_content,
      },
      fbclid: session.fbclid,
      gclid: session.gclid,
      referrer: session.referrer,
      started_at: session.started_at,
      finished_at: session.finished_at,
    } : null,
  };
}

/** Garante jobs também para submissões concluídas antes da instalação do trigger. */
export async function ensureWebhookJobs(db: AdminClient, submissionId: string): Promise<string[]> {
  const { data: submission } = await db
    .from("form_submissions")
    .select("id, form_id, session_id, correlation_id, status")
    .eq("id", submissionId)
    .single();
  if (!submission || submission.status !== "completed") return [];

  const [{ data: integrations }, { data: session }] = await Promise.all([
    db.from("form_integrations")
      .select("id, retry_policy, event_filter")
      .eq("form_id", submission.form_id)
      .eq("adapter", "webhook")
      .eq("enabled", true),
    submission.session_id
      ? db.from("form_sessions").select("token").eq("id", submission.session_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const eligible = (integrations ?? []).filter(row => {
    const filter = row.event_filter as string[] | null;
    return !filter?.length || filter.includes("*") || filter.includes("form.submission.completed") ||
      filter.includes("form.submission.succeeded") || filter.includes("form.completed");
  });
  if (!eligible.length) return [];

  const eventId = `submission:${submission.id}:completed`;
  const correlationId = submission.correlation_id ?? session?.token ?? submission.id;
  await db.from("webhook_delivery_jobs").upsert(
    eligible.map(row => {
      const configured = Number(asRecord(row.retry_policy).maxAttempts ?? 5);
      return {
        integration_id: row.id,
        form_id: submission.form_id,
        submission_id: submission.id,
        event_id: eventId,
        correlation_id: correlationId,
        max_attempts: Math.min(10, Math.max(1, Number.isFinite(configured) ? configured : 5)),
      };
    }),
    { onConflict: "integration_id,event_id", ignoreDuplicates: true },
  );

  const { data: jobs } = await db
    .from("webhook_delivery_jobs")
    .select("id")
    .eq("submission_id", submission.id)
    .in("status", ["pending", "retry"]);
  return (jobs ?? []).map(row => row.id as string);
}

async function recordAttempt(
  db: AdminClient,
  job: WebhookJob,
  payload: unknown,
  result: { ok: boolean; status?: number; durationMs: number; error?: string },
) {
  await db.from("integration_deliveries").insert({
    integration_id: job.integration_id,
    form_id: job.form_id,
    adapter_name: "webhook",
    event_id: job.event_id,
    correlation_id: job.correlation_id,
    event_type: job.event_type,
    attempt: job.attempts,
    ok: result.ok,
    status_code: result.status ?? null,
    duration_ms: result.durationMs,
    error: result.error?.slice(0, 1000) ?? null,
    payload,
  });
}

export async function processWebhookJob(
  db: AdminClient,
  jobId: string,
  timeoutCapMs = 15_000,
): Promise<"delivered" | "retry" | "dead_letter" | "skipped"> {
  const now = new Date().toISOString();
  const { data: current } = await db.from("webhook_delivery_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!current || !["pending", "retry"].includes(current.status) || current.next_attempt_at > now) return "skipped";

  const { data: claimed } = await db
    .from("webhook_delivery_jobs")
    .update({ status: "processing", locked_at: now, attempts: current.attempts + 1, updated_at: now })
    .eq("id", jobId)
    .in("status", ["pending", "retry"])
    .lte("next_attempt_at", now)
    .select("*")
    .maybeSingle();
  if (!claimed) return "skipped";
  const job = claimed as WebhookJob;

  const { data: integration } = await db
    .from("form_integrations")
    .select("id, enabled, settings, secrets, retry_policy")
    .eq("id", job.integration_id)
    .eq("adapter", "webhook")
    .maybeSingle();

  let payload: unknown = null;
  let status: number | undefined;
  let error: string | undefined;
  let ok = false;
  let permanentFailure = false;
  let retryAfterMs: number | undefined;
  const startedAt = Date.now();
  const config = integration as WebhookIntegration | null;
  const retryPolicy = mergeRetryPolicy(DEFAULT_RETRY_POLICY, config?.retry_policy ?? undefined);

  try {
    if (!config?.enabled) {
      permanentFailure = true;
      throw new Error("Integração webhook ausente ou desativada");
    }
    let url: URL;
    try {
      url = await validateWebhookUrl(config.settings.url);
    } catch (validationError) {
      permanentFailure = true;
      throw validationError;
    }
    payload = await buildWebhookPayload(db, job);
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Genesy-Webhooks/1.0",
    "X-Genesy-Event-Id": job.event_id,
    "X-Genesy-Correlation-Id": job.correlation_id,
    "X-Genesy-Timestamp": new Date().toISOString(),
    "X-Lancaster-Event-Id": job.event_id,
    "X-Lancaster-Correlation-Id": job.correlation_id,
    };
    const secrets = resolveSecrets(config.secrets);
    if (secrets.hmac_secret) {
      headers["X-Genesy-Signature"] = await signPayload(body, secrets.hmac_secret);
      // Compatibilidade com consumidores que já usam o nome antigo.
      headers["X-Lancaster-Signature"] = headers["X-Genesy-Signature"];
    }

    const controller = new AbortController();
    const timeoutMs = Math.min(timeoutCapMs, Math.max(1_000, retryPolicy.timeoutMs));
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { method: "POST", headers, body, signal: controller.signal, redirect: "error" });
      status = response.status;
      ok = response.ok;
      if (!ok) error = `HTTP ${response.status}`;
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds)) retryAfterMs = Math.max(0, seconds * 1000);
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Falha desconhecida no webhook";
  }

  const durationMs = Date.now() - startedAt;
  await recordAttempt(db, job, payload, { ok, status, durationMs, error });

  if (ok) {
    await db.from("webhook_delivery_jobs").update({
      status: "delivered", delivered_at: new Date().toISOString(), locked_at: null,
      last_status_code: status ?? null, last_error: null, updated_at: new Date().toISOString(),
    }).eq("id", job.id).eq("status", "processing");
    return "delivered";
  }

  const mayRetry = !permanentFailure && job.attempts < job.max_attempts && isRetryable(status, retryPolicy);
  if (mayRetry) {
    const delay = retryAfterMs ?? computeDelay(retryPolicy, job.attempts);
    await db.from("webhook_delivery_jobs").update({
      status: "retry", next_attempt_at: new Date(Date.now() + delay).toISOString(), locked_at: null,
      last_status_code: status ?? null, last_error: error?.slice(0, 1000) ?? "Erro no webhook",
      updated_at: new Date().toISOString(),
    }).eq("id", job.id).eq("status", "processing");
    return "retry";
  }

  await db.from("webhook_delivery_jobs").update({
    status: "dead_letter", locked_at: null, last_status_code: status ?? null,
    last_error: error?.slice(0, 1000) ?? "Erro no webhook", updated_at: new Date().toISOString(),
  }).eq("id", job.id).eq("status", "processing");
  return "dead_letter";
}

export async function processSubmissionWebhooks(db: AdminClient, submissionId: string): Promise<WebhookRunResult> {
  const jobIds = await ensureWebhookJobs(db, submissionId);
  // A primeira tentativa não deve prender a confirmação do formulário por mais
  // de 5s. O worker posterior usa a janela completa configurada.
  const outcomes = await Promise.all(jobIds.map(id => processWebhookJob(db, id, 5_000)));
  return {
    processed: outcomes.filter(x => x !== "skipped").length,
    delivered: outcomes.filter(x => x === "delivered").length,
    retried: outcomes.filter(x => x === "retry").length,
    deadLettered: outcomes.filter(x => x === "dead_letter").length,
  };
}

export async function runDueWebhookJobs(db: AdminClient, limit = 20): Promise<WebhookRunResult> {
  const staleAt = new Date(Date.now() - 5 * 60_000).toISOString();
  await db.from("webhook_delivery_jobs").update({
    status: "retry", locked_at: null, next_attempt_at: new Date().toISOString(),
    last_error: "Lock expirado; entrega reagendada", updated_at: new Date().toISOString(),
  }).eq("status", "processing").lt("locked_at", staleAt);

  const { data: due } = await db.from("webhook_delivery_jobs")
    .select("id")
    .in("status", ["pending", "retry"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(Math.min(100, Math.max(1, limit)));

  const outcomes = await Promise.all((due ?? []).map(row => processWebhookJob(db, row.id as string)));
  return {
    processed: outcomes.filter(x => x !== "skipped").length,
    delivered: outcomes.filter(x => x === "delivered").length,
    retried: outcomes.filter(x => x === "retry").length,
    deadLettered: outcomes.filter(x => x === "dead_letter").length,
  };
}

export async function testWebhookIntegration(db: AdminClient, formId: string, integrationId: string) {
  const [{ data: integration }, { data: form }] = await Promise.all([
    db.from("form_integrations")
      .select("id, enabled, adapter, settings, secrets, retry_policy")
      .eq("id", integrationId).eq("form_id", formId).eq("adapter", "webhook").single(),
    db.from("forms").select("id, name, slug, steps").eq("id", formId).single(),
  ]);
  if (!integration || !form) throw new Error("Integração webhook não encontrada");
  const config = integration as WebhookIntegration & { adapter: string };
  const url = await validateWebhookUrl(config.settings.url);
  const eventId = `test:${crypto.randomUUID()}`;
  const steps = (form.steps ?? []) as FormStep[];
  const answers = sampleAnswers(steps);
  const { answersByQuestion, fields } = buildWebhookAnswerViews(steps, answers);
  const payload = {
    id: eventId,
    event_type: "form.webhook.test",
    correlation_id: eventId,
    timestamp: new Date().toISOString(),
    version: 2,
    test: true,
    form: { id: form.id, name: form.name, slug: form.slug },
    submission: {
      id: "test-submission",
      status: "completed",
      answers,
      answers_by_question: answersByQuestion,
      fields,
    },
    session: null,
  };
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Genesy-Webhooks/1.0",
    "X-Genesy-Event-Id": eventId,
    "X-Genesy-Correlation-Id": eventId,
    "X-Genesy-Timestamp": new Date().toISOString(),
    "X-Lancaster-Event-Id": eventId,
    "X-Lancaster-Correlation-Id": eventId,
  };
  const secrets = resolveSecrets(config.secrets);
  if (secrets.hmac_secret) {
    headers["X-Genesy-Signature"] = await signPayload(body, secrets.hmac_secret);
    headers["X-Lancaster-Signature"] = headers["X-Genesy-Signature"];
  }
  const policy = mergeRetryPolicy(DEFAULT_RETRY_POLICY, config.retry_policy ?? undefined);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(15_000, Math.max(1_000, policy.timeoutMs)));
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { method: "POST", headers, body, signal: controller.signal, redirect: "error" });
    return {
      ok: response.ok,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      error: response.ok ? undefined : `HTTP ${response.status}`,
      payloadSent: JSON.stringify(payload, null, 2),
      correlationId: eventId,
    };
  } finally {
    clearTimeout(timer);
  }
}
