"use client";

import { useMemo } from "react";
import { CheckCircle2, XCircle, Clock, Hash } from "lucide-react";
import { getIntegrationRuntime } from "@/lib/integrations/runtime";
import type { DeliveryHistoryEntry } from "@/lib/integrations/runtime";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function HistoryRow({ entry }: { entry: DeliveryHistoryEntry }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs"
      style={{ border: "1px solid var(--border)", background: "var(--background)" }}
    >
      {entry.ok
        ? <CheckCircle2 size={14} color="#22c55e" className="shrink-0" />
        : <XCircle size={14} color="#ef4444" className="shrink-0" />
      }
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono" style={{ color: "var(--text-title)" }}>{entry.eventType}</span>
          {entry.statusCode && (
            <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--border)", color: "var(--muted-foreground)" }}>
              {entry.statusCode}
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--border)", color: "var(--muted-foreground)" }}>
            tentativa {entry.attempt}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {entry.durationMs}ms
          </span>
          <span className="flex items-center gap-1 truncate">
            <Hash size={10} />
            <span className="truncate">{entry.correlationId}</span>
          </span>
        </div>
        {entry.error && (
          <p className="text-xs mt-0.5 truncate" style={{ color: "#f87171" }}>{entry.error}</p>
        )}
      </div>
      <span className="shrink-0 text-xs" style={{ color: "var(--muted-foreground)" }}>
        {formatTime(entry.timestamp)}
      </span>
    </div>
  );
}

interface HistoryPanelProps {
  adapterName: string;
}

export function HistoryPanel({ adapterName }: HistoryPanelProps) {
  const history = useMemo(() => {
    try {
      const runtime = getIntegrationRuntime();
      return runtime.observer.getHistory(adapterName);
    } catch {
      return [] as DeliveryHistoryEntry[];
    }
  }, [adapterName]);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock size={32} className="mb-3 opacity-20" />
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Nenhuma execução registrada ainda.
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
          O histórico aparece aqui conforme os eventos são processados.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-6">
      <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
        Últimas {history.length} execução{history.length !== 1 ? "ões" : ""} (em memória)
      </p>
      {history.map(entry => (
        <HistoryRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
