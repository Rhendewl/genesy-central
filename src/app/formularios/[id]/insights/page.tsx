"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { Eye, Play, Send, TrendingUp, Clock, AlertTriangle, Info, Loader2 } from "lucide-react";
import { FormularioShell } from "../_components/FormularioShell";
import { useFormularioInsights } from "@/hooks/useFormularioInsights";
import { InsightsFilterBar, type InsightsPeriod, type DeviceFilter } from "@/components/insights/InsightsFilterBar";
import type { InsightsDomain, FunnelStep } from "@/lib/analytics/types";
import type { Granularity } from "@/lib/analytics/metrics";
import type { Form } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function fmtAxisLabel(key: string, g: Granularity): string {
  if (g === "hour") {
    const h = key.slice(11, 13);
    return `${h}h`;
  }
  if (g === "day") {
    const [, m, d] = key.split("-");
    return `${d}/${m}`;
  }
  if (g === "week") {
    const w = key.split("-W")[1];
    return `Sem ${parseInt(w)}`;
  }
  // month
  const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const mi = parseInt(key.split("-")[1]) - 1;
  return MONTHS[mi] ?? key;
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────

const KPI_DEFS = [
  { key: "views",          label: "Visualizações",    icon: Eye,        fmt: (v: number) => String(v) },
  { key: "starts",         label: "Iniciaram",        icon: Play,       fmt: (v: number) => String(v) },
  { key: "conversions",    label: "Envios",            icon: Send,       fmt: (v: number) => String(v) },
  { key: "conversionRate", label: "Taxa de conclusão", icon: TrendingUp, fmt: (v: number) => `${v}%`   },
  { key: "avgTotalTimeSecs", label: "Tempo médio",    icon: Clock,      fmt: (v: number) => fmtDuration(v) },
] as const;

function KpiCards({ d }: { d: InsightsDomain }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {KPI_DEFS.map(({ key, label, icon: Icon, fmt }) => {
        const raw   = d[key as keyof InsightsDomain] as number;
        const value = fmt(raw);
        return (
          <div
            key={key}
            className="rounded-xl p-4"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Icon size={12} style={{ color: "var(--muted-foreground)" }} />
              <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                {label}
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "var(--text-title)" }}>{value}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Submissions Chart ─────────────────────────────────────────────────────────

function SubmissionsChart({ d, granularity }: { d: InsightsDomain; granularity: Granularity }) {
  const raw   = d.series.conversions;
  const data  = raw.map(p => ({ label: fmtAxisLabel(p.date, granularity), value: p.value }));
  const max   = Math.max(...data.map(p => p.value), 1);
  const total = raw.reduce((s, p) => s + p.value, 0);

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            Submissões ao longo do tempo
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {total} envio{total !== 1 ? "s" : ""} no período
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-36 text-xs" style={{ color: "var(--muted-foreground)" }}>
          Sem dados para o período selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              domain={[0, max + 1]}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--text-title)" }}
              itemStyle={{ color: "var(--primary)" }}
              formatter={(v) => { const n = Number(v ?? 0); return [`${n} envio${n !== 1 ? "s" : ""}`, ""] as [string, string]; }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={data.length <= 30 ? { r: 3, fill: "var(--primary)", strokeWidth: 0 } : false}
              activeDot={{ r: 4, fill: "var(--primary)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Optimization Tips ─────────────────────────────────────────────────────────

interface Tip {
  id:          string;
  severity:    "warning" | "info";
  title:       string;
  description: string;
}

function generateTips(d: InsightsDomain, form: Form | null): Tip[] {
  const tips: Tip[] = [];
  const hasData = d.starts > 5;

  if (hasData && d.conversionRate < 30) {
    tips.push({
      id: "low-completion",
      severity: "warning",
      title: "Taxa de conclusão baixa",
      description: `Apenas ${d.conversionRate}% dos usuários que iniciam chegam ao fim. Considere reduzir o número de perguntas ou simplificar o fluxo.`,
    });
  }

  if (hasData && d.abandonmentRate > 60) {
    tips.push({
      id: "high-abandonment",
      severity: "warning",
      title: "Alta taxa de abandono",
      description: `${d.abandonmentRate}% dos visitantes abandonam antes de concluir. Tente tornar as primeiras perguntas mais simples e diretas.`,
    });
  }

  const highDropStep = d.funnel.find(s => s.dropRate > 70 && s.views > 3);
  if (highDropStep) {
    tips.push({
      id: `drop-${highDropStep.stepId}`,
      severity: "warning",
      title: "Pergunta com alto abandono",
      description: `"${highDropStep.stepTitle}" tem ${highDropStep.dropRate}% de abandono. Considere reformulá-la ou torná-la opcional.`,
    });
  }

  if (form && form.steps.length > 10) {
    tips.push({
      id: "many-questions",
      severity: "info",
      title: "Formulário extenso",
      description: `${form.steps.length} perguntas podem causar fadiga. Formulários com até 7 perguntas têm taxas de conclusão significativamente maiores.`,
    });
  }

  if (form && !form.welcome_screen?.enabled) {
    tips.push({
      id: "no-welcome",
      severity: "info",
      title: "Sem tela de boas-vindas",
      description: "Uma tela de boas-vindas contextualiza o formulário e aumenta a taxa de início. Ative em Configurações → Tela de boas-vindas.",
    });
  }

  if (form) {
    const longStep = form.steps.find(s => (s.title?.length ?? 0) > 100);
    if (longStep) {
      tips.push({
        id: "long-title",
        severity: "info",
        title: "Perguntas com texto longo",
        description: "Perguntas com mais de 100 caracteres podem confundir o usuário. Prefira enunciados curtos e diretos.",
      });
    }
  }

  return tips;
}

function OptimizationTips({ tips }: { tips: Tip[] }) {
  if (tips.length === 0) {
    return (
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <TrendingUp size={16} style={{ color: "#22c55e" }} />
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Nenhuma sugestão de melhoria no momento. Continue assim!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted-foreground)" }}>
        Dicas de otimização
      </p>
      {tips.map(tip => (
        <div
          key={tip.id}
          className="rounded-xl p-4 flex items-start gap-3"
          style={{
            background: tip.severity === "warning"
              ? "rgba(245,158,11,0.06)"
              : "rgba(255,255,255,0.03)",
            border: `1px solid ${tip.severity === "warning" ? "rgba(245,158,11,0.18)" : "var(--border)"}`,
          }}
        >
          {tip.severity === "warning"
            ? <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#f59e0b" }} />
            : <Info          size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
          }
          <div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-title)" }}>{tip.title}</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{tip.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Question Table ────────────────────────────────────────────────────────────

function DropBadge({ rate }: { rate: number }) {
  const color = rate >= 70 ? "#ef4444" : rate >= 40 ? "#f59e0b" : "#22c55e";
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: `${color}18`, color }}
    >
      {rate}%
    </span>
  );
}

function QuestionTable({ funnel }: { funnel: FunnelStep[] }) {
  const rows = [...funnel].sort((a, b) => a.stepIndex - b.stepIndex);

  if (rows.length === 0) {
    return (
      <div
        className="rounded-xl p-4 text-center"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Nenhuma pergunta com dados ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {["#", "Pergunta", "Views", "Drop-off"].map(h => (
                <th
                  key={h}
                  className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
                  style={{
                    background: "var(--card)",
                    borderBottom: "1px solid var(--border)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((step, i) => (
              <tr
                key={step.stepId}
                style={{
                  background: "var(--card)",
                  borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)", width: 44 }}>
                  {step.stepIndex + 1}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs" style={{ color: "var(--text-title)" }}>
                    {step.stepTitle || `Pergunta ${step.stepIndex + 1}`}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)", width: 80 }}>
                  {step.views}
                </td>
                <td className="px-4 py-3" style={{ width: 100 }}>
                  <DropBadge rate={step.dropRate} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton({ h = "h-32" }: { h?: string }) {
  return (
    <div
      className={`rounded-xl animate-pulse ${h}`}
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FormularioInsightsPage() {
  const { id } = useParams<{ id: string }>();

  const [period, setPeriod] = useState<InsightsPeriod>({});
  const [device, setDevice] = useState<DeviceFilter>("todos");

  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => {
    fetch(`/api/formularios/${id}`)
      .then(r => r.json())
      .then((j: { formulario?: Form }) => { if (j.formulario) setForm(j.formulario); })
      .catch(() => {});
  }, [id]);

  const { insights, granularity, isLoading, error } = useFormularioInsights(id, {
    since:  period.since,
    until:  period.until,
    device: device !== "todos" ? device : undefined,
  });

  const tips = insights ? generateTips(insights, form) : [];

  return (
    <FormularioShell id={id}>
      <div className="px-4 sm:px-6 pt-4 pb-8 flex flex-col gap-5">

        {/* Filter bar */}
        <InsightsFilterBar
          period={period}
          device={device}
          onPeriod={setPeriod}
          onDevice={setDevice}
        />

        {/* Error */}
        {error && (
          <p className="text-sm py-4" style={{ color: "#ef4444" }}>{error}</p>
        )}

        {/* Loading */}
        {isLoading && !insights && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h="h-20" />)}
            </div>
            <Skeleton h="h-52" />
            <Skeleton h="h-24" />
            <Skeleton h="h-40" />
          </>
        )}

        {/* Content */}
        {insights && (
          <>
            {/* KPI cards */}
            <KpiCards d={insights} />

            {/* Chart */}
            <SubmissionsChart d={insights} granularity={granularity} />

            {/* Tips */}
            <OptimizationTips tips={tips} />

            {/* Pergunta por pergunta */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Pergunta por pergunta
              </p>
              <QuestionTable funnel={insights.funnel} />
            </div>
          </>
        )}

        {/* Refetching overlay */}
        {isLoading && insights && (
          <div className="fixed bottom-6 right-6 flex items-center gap-2 px-3 py-2 rounded-lg text-xs shadow-lg"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
            <Loader2 size={12} className="animate-spin" />
            Atualizando…
          </div>
        )}

      </div>
    </FormularioShell>
  );
}
