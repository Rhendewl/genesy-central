import type { BusEvent, EventConsumer } from "../../types";
import { ConsumerPriority } from "../../types";
import { FORM_DB_EVENT_MAP, type FormEventPayloads, type FormEventType } from "../types";

/**
 * Consumer de analytics — persiste eventos de formulário na tabela form_events
 * via /api/form/:slug/evento.
 *
 * Prioridade HIGH: os eventos devem chegar ao banco mas não são críticos como
 * webhooks CRM. Máximo 3 retries com backoff linear de 1s.
 *
 * getToken() é resolvido em tempo de execução para capturar o token de sessão
 * mais recente sem precisar recriar o consumer quando o token muda.
 */
export function createFormAnalyticsConsumer(
  slug:     string,
  getToken: () => string | null,
): EventConsumer {
  const trackedEvents = Object.keys(FORM_DB_EVENT_MAP) as FormEventType[];

  return {
    name:     "form-analytics",
    priority: ConsumerPriority.HIGH,
    events:   trackedEvents as string[],

    async handle(event: BusEvent): Promise<void> {
      const token = getToken();
      if (!token) return; // Sessão ainda não criada — ignora silenciosamente

      const dbEventName = FORM_DB_EVENT_MAP[event.type as FormEventType];
      if (!dbEventName) return;

      const payload = (event.payload ?? {}) as Partial<FormEventPayloads[FormEventType]>;

      const body: Record<string, unknown> = {
        session_token: token,
        event:         dbEventName,
      };

      // Campos opcionais mapeados de cada payload
      if ("stepId" in payload && payload.stepId) {
        body.step_id = payload.stepId;
      }
      if ("durationSeconds" in payload && payload.durationSeconds != null) {
        body.duration = payload.durationSeconds;
      }

      const res = await fetch(`/api/form/${slug}/evento`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
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
