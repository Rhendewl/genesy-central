// Push Notification Consumer — subscribed to nps.response_received.
//
// Mesmo molde do consumer de push de Agendamentos
// (src/lib/event-bus/appointments/consumers/push-notification.ts): sem
// template configurável por enquanto — só o texto fixo com nome do cliente,
// nota e classificação (promotor/neutro/detrator).

import type { SupabaseClient }              from "@supabase/supabase-js";
import type { BusEvent }                    from "@/lib/event-bus/types";
import type { NpsResponseReceivedPayload }  from "@/lib/event-bus/domain-events";
import { ConsumerPriority }                 from "@/lib/event-bus/types";
import type { EventConsumer }               from "@/lib/event-bus/types";
import { dispatchPushToUser }               from "@/lib/notifications/push-dispatcher";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

// Mesmos limiares de src/hooks/useNps.ts (classifyNps) — não importado
// diretamente porque aquele arquivo é "use client".
function classifyNps(score: number): "promotor" | "neutro" | "detrator" {
  if (score >= 9) return "promotor";
  if (score >= 7) return "neutro";
  return "detrator";
}

const CLASSIFICATION_LABELS: Record<ReturnType<typeof classifyNps>, string> = {
  promotor: "Promotor",
  neutro:   "Neutro",
  detrator: "Detrator",
};

export function createNpsResponseNotificationConsumer(db: Db): EventConsumer {
  return {
    name:     "clientes.nps-notification",
    priority: ConsumerPriority.NORMAL,
    events:   ["nps.response_received"],

    async handle(event: BusEvent): Promise<void> {
      const payload = event.payload as NpsResponseReceivedPayload;
      if (!payload?.userId || !payload?.clientId) return;

      const classification = classifyNps(payload.score);
      const title = `Nova resposta de NPS — ${payload.clientName || "Cliente"}`;
      const body  = `Nota ${payload.score} · ${CLASSIFICATION_LABELS[classification]}${payload.comment ? ` — "${payload.comment}"` : ""}`;

      await dispatchPushToUser(db, payload.userId, title, body);
    },
  };
}
