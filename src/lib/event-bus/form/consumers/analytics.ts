import type { BusEvent, EventConsumer } from "../../types";
import { ConsumerPriority } from "../../types";
import { FORM_DB_EVENT_MAP, type FormEventPayloads, type FormEventType } from "../types";

/** Quanto tempo um evento espera a sessão ser criada antes de ser descartado. */
const TOKEN_WAIT_MS = 10_000;

async function waitForToken(getToken: () => string | null): Promise<string | null> {
  const deadline = Date.now() + TOKEN_WAIT_MS;
  let token = getToken();
  while (!token && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 250));
    token = getToken();
  }
  return token;
}

/** Contexto útil para análise, sem dados pessoais (respostas e contatos ficam fora). */
function metaOf(payload: Record<string, unknown>): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = {};
  for (const key of ["stepIndex", "stepType", "lastStepIndex", "answersCount", "totalSteps", "endingId", "restoredStepIndex", "hasWelcome", "stepCount"]) {
    const value = payload[key];
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") meta[key] = value;
  }
  return Object.keys(meta).length ? meta : undefined;
}

/**
 * Consumer de analytics — persiste eventos de formulário na tabela form_events
 * via /api/form/:slug/evento.
 *
 * Prioridade LOW: roda depois das integrações (CRM, webhooks, Pixel), para que
 * a espera pelo token da sessão nunca atrase um disparo de conversão.
 * Máximo 3 retries com backoff linear de 1s.
 *
 * getToken() é resolvido em tempo de execução. Eventos publicados antes de a
 * sessão existir (ex.: form.loaded logo na abertura) aguardam o token por até
 * 10s em vez de serem descartados. O id do evento vai como idempotency_key,
 * então retries nunca duplicam linhas.
 */
export function createFormAnalyticsConsumer(
  slug:     string,
  getToken: () => string | null,
): EventConsumer {
  const trackedEvents = Object.keys(FORM_DB_EVENT_MAP) as FormEventType[];

  return {
    name:     "form-analytics",
    priority: ConsumerPriority.LOW,
    events:   trackedEvents as string[],

    async handle(event: BusEvent): Promise<void> {
      const dbEventName = FORM_DB_EVENT_MAP[event.type as FormEventType];
      if (!dbEventName) return;

      const token = await waitForToken(getToken);
      if (!token) return; // A sessão não foi criada (ex.: offline) — ignora

      const payload = (event.payload ?? {}) as Partial<FormEventPayloads[FormEventType]> & Record<string, unknown>;

      const body: Record<string, unknown> = {
        session_token:   token,
        event:           dbEventName,
        idempotency_key: event.id,
      };

      if ("stepId" in payload && payload.stepId) {
        body.step_id = payload.stepId;
      }
      if ("durationSeconds" in payload && payload.durationSeconds != null) {
        body.duration = payload.durationSeconds;
      }
      const meta = metaOf(payload);
      if (meta) body.meta = meta;

      const res = await fetch(`/api/form/${slug}/evento`, {
        method:    "POST",
        headers:   { "Content-Type": "application/json" },
        body:      JSON.stringify(body),
        // Mantém a requisição viva quando a pessoa fecha a aba (ex.: abandono).
        keepalive: true,
      });

      if (!res.ok) {
        throw new Error(`analytics: HTTP ${res.status}`);
      }
    },

    retry: {
      maxAttempts: 3,
      backoffMs:   1000,
      persist:     false,
    },
  };
}
