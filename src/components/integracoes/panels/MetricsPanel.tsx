"use client";

import { useMemo } from "react";
import { TrendingUp, CheckCircle2, XCircle, RefreshCw, AlertTriangle, Gauge, Layers } from "lucide-react";
import { getIntegrationRuntime } from "@/lib/integrations/runtime";
import type { IntegrationMetrics } from "@/lib/integrations/types";

function MetricKPI({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon:  React.ElementType;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--background)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color }} />
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: "var(--text-title)" }}>{value}</p>
    </div>
  );
}

function successRate(m: IntegrationMetrics): string {
  if (m.deliveries === 0) return "—";
  return `${Math.round((m.successes / m.deliveries) * 100)}%`;
}

interface MetricsPanelProps {
  adapterName: string;
}

export function MetricsPanel({ adapterName }: MetricsPanelProps) {
  const metrics: IntegrationMetrics = useMemo(() => {
    try {
      const { observer } = getIntegrationRuntime();
      return observer.snapshot(adapterName);
    } catch {
      return {
        adapterName, deliveries: 0, successes: 0, failures: 0, retries: 0,
        deadLettered: 0, circuitBreaks: 0, avgLatencyMs: 0, p95LatencyMs: 0,
        queueDepth: 0, rateLimited: 0,
      };
    }
  }, [adapterName]);

  const cbState = useMemo(() => {
    try {
      const { circuitBreakers } = getIntegrationRuntime();
      return circuitBreakers.get(adapterName).getState();
    } catch {
      return "CLOSED" as const;
    }
  }, [adapterName]);

  const CB_COLOR: Record<string, string> = {
    CLOSED:    "#22c55e",
    OPEN:      "#ef4444",
    HALF_OPEN: "#f59e0b",
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-3">
        <MetricKPI label="Entregas"    value={metrics.deliveries}  icon={TrendingUp}    color="var(--primary)" />
        <MetricKPI label="Sucesso"     value={metrics.successes}   icon={CheckCircle2}  color="#22c55e" />
        <MetricKPI label="Falhas"      value={metrics.failures}    icon={XCircle}       color="#ef4444" />
        <MetricKPI label="Taxa"        value={successRate(metrics)} icon={Gauge}        color="var(--primary)" />
      </div>

      {/* Latência */}
      <div
        className="rounded-xl p-4 grid grid-cols-2 gap-4"
        style={{ background: "var(--background)", border: "1px solid var(--border)" }}
      >
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Latência média</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-title)" }}>
            {metrics.avgLatencyMs > 0 ? `${metrics.avgLatencyMs}ms` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>P95</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-title)" }}>
            {metrics.p95LatencyMs > 0 ? `${metrics.p95LatencyMs}ms` : "—"}
          </p>
        </div>
      </div>

      {/* Circuit Breaker */}
      <div
        className="rounded-xl p-4 flex items-center justify-between"
        style={{ background: "var(--background)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} style={{ color: CB_COLOR[cbState] }} />
          <p className="text-sm" style={{ color: "var(--text-title)" }}>Circuit Breaker</p>
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: `${CB_COLOR[cbState]}18`, color: CB_COLOR[cbState] }}
        >
          {cbState}
        </span>
      </div>

      {/* Métricas secundárias */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Retries",     value: metrics.retries,       icon: RefreshCw },
          { label: "DLQ",         value: metrics.deadLettered,  icon: AlertTriangle },
          { label: "Rate Limit",  value: metrics.rateLimited,   icon: Layers },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl p-3 text-center"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <Icon size={14} className="mx-auto mb-1.5 opacity-50" />
            <p className="text-lg font-bold" style={{ color: "var(--text-title)" }}>{value}</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Queue depth */}
      <div
        className="rounded-xl p-4 flex items-center justify-between"
        style={{ background: "var(--background)", border: "1px solid var(--border)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-title)" }}>Queue depth</p>
        <span
          className="text-lg font-bold"
          style={{ color: metrics.queueDepth > 0 ? "#f59e0b" : "#22c55e" }}
        >
          {metrics.queueDepth}
        </span>
      </div>

      {metrics.deliveries === 0 && (
        <p className="text-xs text-center pt-4" style={{ color: "var(--muted-foreground)" }}>
          Métricas acumuladas desde o carregamento desta sessão.
          Reiniciam ao recarregar a página.
        </p>
      )}
    </div>
  );
}
