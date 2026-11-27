"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

export type InsightTone = "good" | "attention" | "critical" | "info";
export interface InsightCardItem { id: string; tone: InsightTone; title: string; detail: string; value?: string }

const TONES: Record<InsightTone, { color: string; icon: ReactNode; label: string }> = {
  critical:  { color: "#f43f5e", icon: <XCircle size={15} />,       label: "Prioridade" },
  attention: { color: "#f59e0b", icon: <AlertTriangle size={15} />, label: "Atenção" },
  good:      { color: "#10b981", icon: <CheckCircle2 size={15} />,  label: "Destaque" },
  info:      { color: "#38bdf8", icon: <Info size={15} />,          label: "Leitura" },
};

/** Cards de leitura rápida: o número em destaque, o que ele significa e o que fazer. */
export function InsightCards({ items, empty = "Nenhum ponto de atenção no período." }: { items: InsightCardItem[]; empty?: string }) {
  if (!items.length) return <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-xs text-[var(--muted-foreground)]">{empty}</p>;
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {items.map(item => {
      const tone = TONES[item.tone];
      return <article key={item.id} className="relative flex flex-col overflow-hidden rounded-2xl border p-4" style={{ borderColor: `${tone.color}40`, background: `linear-gradient(160deg, ${tone.color}14, transparent 60%)` }}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: tone.color }}>{tone.icon}{tone.label}</div>
        {item.value && <strong className="mt-2 block text-2xl font-semibold tabular-nums tracking-tight text-[var(--text-title)]">{item.value}</strong>}
        <h4 className={`${item.value ? "mt-0.5" : "mt-2"} text-sm font-semibold leading-snug text-[var(--text-title)]`}>{item.title}</h4>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted-foreground)]">{item.detail}</p>
      </article>;
    })}
  </div>;
}
