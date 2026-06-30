import { CheckCircle2, XCircle, Clock, Hash, Zap } from "lucide-react";
import type { IntegrationDelivery } from "@/lib/respostas/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

interface TabIntegracoesProps {
  deliveries: IntegrationDelivery[];
}

export function TabIntegracoes({ deliveries }: TabIntegracoesProps) {
  if (deliveries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Zap size={32} className="mb-3 opacity-20" style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Nenhuma entrega registrada.
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
          Integrações ativas aparecem aqui após o envio.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-2">
      {deliveries.map(d => (
        <div
          key={d.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs"
          style={{ border: "1px solid var(--border)", background: "var(--background)" }}
        >
          {d.ok
            ? <CheckCircle2 size={14} color="#22c55e" className="shrink-0" />
            : <XCircle     size={14} color="#ef4444" className="shrink-0" />
          }

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="font-medium" style={{ color: "var(--text-title)" }}>
                {d.adapter_name}
              </span>
              <span className="font-mono" style={{ color: "var(--muted-foreground)" }}>
                {d.event_type}
              </span>
              {d.status_code !== null && (
                <span
                  className="px-1.5 py-0.5 rounded"
                  style={{ background: "var(--border)", color: "var(--muted-foreground)" }}
                >
                  {d.status_code}
                </span>
              )}
              <span
                className="px-1.5 py-0.5 rounded"
                style={{ background: "var(--border)", color: "var(--muted-foreground)" }}
              >
                tentativa {d.attempt}
              </span>
            </div>

            <div className="flex items-center gap-3" style={{ color: "var(--muted-foreground)" }}>
              {d.duration_ms !== null && (
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {d.duration_ms}ms
                </span>
              )}
              <span className="flex items-center gap-1 min-w-0">
                <Hash size={10} className="shrink-0" />
                <span className="truncate">{d.correlation_id}</span>
              </span>
            </div>

            {d.error && (
              <p className="mt-0.5 truncate" style={{ color: "#f87171" }}>{d.error}</p>
            )}
          </div>

          <span className="shrink-0 tabular-nums" style={{ color: "var(--muted-foreground)" }}>
            {formatTime(d.delivered_at)}
          </span>
        </div>
      ))}
    </div>
  );
}
