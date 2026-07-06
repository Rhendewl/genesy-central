import type { NormalizedCalendarEvent } from "@/types/google-calendar";

// Células esticam para preencher 100% da largura e altura disponíveis no
// card (grid `1fr`/`1fr`) — não são mais quadrados de tamanho fixo.
export const AGENDA_BAR_COLOR   = "#5d676d";

export type EventsByDay = Map<string, NormalizedCalendarEvent[]>;

// Groups events by their local start date ("yyyy-MM-dd").
// Multi-day all-day events are anchored to their start date only (known limitation).
export function groupEventsByDay(events: NormalizedCalendarEvent[]): EventsByDay {
  const map: EventsByDay = new Map();
  for (const event of events) {
    const key = event.start.slice(0, 10);
    const list = map.get(key);
    if (list) list.push(event);
    else map.set(key, [event]);
  }
  return map;
}
