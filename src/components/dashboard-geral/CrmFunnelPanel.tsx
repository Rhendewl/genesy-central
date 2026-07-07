"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Users } from "lucide-react";

interface FunnelStageData {
  label:     string;
  value:     number;
  rateLabel?: string;
  rate?:      number | null;
}

interface CrmFunnelPanelProps {
  totalLeads: number;
  agendadas:  number;
  realizadas: number;
  noShow:     number;
  vendas:     number;
  height:     number;
  delay?:     number;
}

const BAR_GRADIENT = "linear-gradient(90deg, #26292e 0%, #b0b8c1 100%)";

export function CrmFunnelPanel({ totalLeads, agendadas, realizadas, vendas, height, delay = 0 }: CrmFunnelPanelProps) {
  const rate = (num: number, den: number): number | null => (den > 0 ? (num / den) * 100 : null);

  const stages: FunnelStageData[] = [
    { label: "Total de leads",       value: totalLeads },
    { label: "Reuniões agendadas",   value: agendadas,  rateLabel: "Taxa de agendamento",    rate: rate(agendadas, totalLeads) },
    { label: "Reuniões realizadas",  value: realizadas, rateLabel: "Taxa de comparecimento", rate: rate(realizadas, agendadas) },
    { label: "Vendas",               value: vendas,     rateLabel: "Taxa de conversão",       rate: rate(vendas, realizadas) },
  ];

  const base = totalLeads > 0 ? totalLeads : 1;

  return (
    <motion.a
      href="/crm"
      className="lc-card group flex flex-col cursor-pointer overflow-hidden p-6"
      style={{ background: "var(--glass-bg-soft)", height }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <div className="mb-5 flex flex-shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl">
            <Users size={17} style={{ color: "var(--text-title)" }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--silver)" }}>Funil CRM</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">Mês atual</p>
          </div>
        </div>
        <ArrowUpRight
          size={15}
          className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          style={{ color: "#27a3ff" }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="flex flex-col gap-3">
          {stages.map((stage, i) => {
            const pct = Math.min(100, (stage.value / base) * 100);

            return (
              <motion.div
                key={stage.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: delay + 0.1 + i * 0.07, ease: "easeOut" }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--text-body)" }}>{stage.label}</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-title)" }}>{stage.value}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: BAR_GRADIENT }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.65, delay: delay + 0.18 + i * 0.08, ease: "easeOut" }}
                  />
                </div>
                {stage.rateLabel && (
                  <p className="mt-1.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                    {stage.rateLabel}: <span style={{ color: "var(--text-title)", fontWeight: 600 }}>
                      {stage.rate == null ? "—" : `${stage.rate.toFixed(0)}%`}
                    </span>
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.a>
  );
}
