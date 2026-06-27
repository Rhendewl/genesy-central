"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getIntegrationRuntime } from "@/lib/integrations/runtime";
import type { DeadLetterEntry } from "@/lib/integrations/types";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function DLQRow({
  entry,
  onReprocess,
  isReprocessing,
}: {
  entry:          DeadLetterEntry;
  onReprocess:    () => void;
  isReprocessing: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "var(--background)", border: "1px solid #ef444430" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} color="#f59e0b" className="shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>
              {entry.event.type}
            </p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {formatDate(entry.failedAt)}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onReprocess} disabled={isReprocessing}>
          <RefreshCw size={12} className={isReprocessing ? "animate-spin" : ""} />
          {isReprocessing ? "…" : "Reprocessar"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span style={{ color: "var(--muted-foreground)" }}>Tentativas</span>
          <p className="font-medium mt-0.5" style={{ color: "var(--text-title)" }}>{entry.attempts}</p>
        </div>
        <div>
          <span style={{ color: "var(--muted-foreground)" }}>Adapter</span>
          <p className="font-medium mt-0.5 font-mono" style={{ color: "var(--text-title)" }}>{entry.config.adapterName}</p>
        </div>
      </div>

      <div className="rounded-lg px-3 py-2" style={{ background: "#ef444410" }}>
        <p className="text-xs font-medium mb-0.5 text-red-400">Motivo da falha</p>
        <p className="text-xs font-mono break-all" style={{ color: "#f87171" }}>{entry.lastError}</p>
      </div>

      <p className="text-xs font-mono truncate" style={{ color: "var(--muted-foreground)" }}>
        Correlation: {entry.correlationId}
      </p>
    </div>
  );
}

interface DLQPanelProps {
  adapterName: string;
}

export function DLQPanel({ adapterName }: DLQPanelProps) {
  const [reprocessingIds, setReprocessingIds] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  const entries = useMemo(() => {
    try {
      const { dlq } = getIntegrationRuntime();
      return dlq.all().filter(e => e.config.adapterName === adapterName);
    } catch {
      return [] as DeadLetterEntry[];
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapterName, tick]);

  const handleReprocess = async (entry: DeadLetterEntry) => {
    const key = entry.deliveryId;
    setReprocessingIds(s => new Set(s).add(key));
    try {
      const { queue } = getIntegrationRuntime();
      queue.enqueue({
        deliveryId:    entry.deliveryId,
        correlationId: entry.correlationId,
        event:         entry.event,
        config:        entry.config,
        attempt:       1,
        scheduledAt:   Date.now(),
      });
      await new Promise<void>(r => setTimeout(r, 500));
      setTick(t => t + 1);
    } finally {
      setReprocessingIds(s => { const n = new Set(s); n.delete(key); return n; });
    }
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox size={32} className="mb-3 opacity-20" />
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Sem falhas permanentes registradas.
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
          Entregas que esgotaram todas as tentativas aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-6">
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
        {entries.length} entrega{entries.length !== 1 ? "s" : ""} na fila de falhas
      </p>
      {entries.map(entry => (
        <DLQRow
          key={entry.deliveryId}
          entry={entry}
          onReprocess={() => handleReprocess(entry)}
          isReprocessing={reprocessingIds.has(entry.deliveryId)}
        />
      ))}
    </div>
  );
}
