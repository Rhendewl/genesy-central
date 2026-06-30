import {
  CheckCircle2, Circle, Clock, PlayCircle, Send, XCircle,
} from "lucide-react";
import type { SessionEvent } from "@/lib/respostas/types";

const EVENT_ICONS: Record<string, React.ElementType> = {
  session_started:  PlayCircle,
  step_started:     Circle,
  step_completed:   CheckCircle2,
  form_submitted:   Send,
  form_abandoned:   XCircle,
};

function getIcon(event: string): React.ElementType {
  return EVENT_ICONS[event] ?? Clock;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface TabTimelineProps {
  events: SessionEvent[];
}

export function TabTimeline({ events }: TabTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock size={32} className="mb-3 opacity-20" style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Nenhum evento registrado.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-2">
      {events.map(ev => {
        const Icon = getIcon(ev.event);
        const dur  = formatDuration(ev.duration);
        return (
          <div
            key={ev.id}
            className="flex items-start gap-3 px-3 py-2.5 rounded-lg text-xs"
            style={{ border: "1px solid var(--border)", background: "var(--background)" }}
          >
            <Icon size={14} className="shrink-0 mt-0.5" style={{ color: "var(--muted-foreground)" }} />
            <div className="flex-1 min-w-0">
              <p className="font-mono font-medium" style={{ color: "var(--text-title)" }}>
                {ev.event}
              </p>
              {dur && (
                <p className="mt-0.5" style={{ color: "var(--muted-foreground)" }}>{dur}</p>
              )}
            </div>
            <span className="shrink-0 tabular-nums" style={{ color: "var(--muted-foreground)" }}>
              {formatTime(ev.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
