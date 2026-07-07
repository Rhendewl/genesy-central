"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Wallet } from "lucide-react";
import { useFinanceiroDashboard } from "@/hooks/useFinanceiroDashboard";
import { MetricSubcard } from "./MetricSubcard";

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

interface FinanceiroSummaryCardProps {
  year:   number;
  month:  number;
  height: number;
  delay?: number;
}

export function FinanceiroSummaryCard({ year, month, height, delay = 0 }: FinanceiroSummaryCardProps) {
  const { data: finData, isLoading } = useFinanceiroDashboard(year, month);

  const tiles = [
    { label: "Receita", value: fmtBRL(finData?.faturamento ?? 0) },
    { label: "Despesa",  value: fmtBRL(finData?.total_despesas ?? 0) },
    { label: "Lucro",    value: fmtBRL(finData?.lucro_liquido ?? 0) },
    { label: "MRR",      value: fmtBRL(finData?.mrr ?? 0) },
    { label: "Saldo",    value: fmtBRL(finData?.caixa_disponivel ?? 0) },
  ];

  return (
    <motion.a
      href="/financeiro"
      className="lc-card group flex flex-col cursor-pointer overflow-hidden p-6"
      style={{ background: "var(--glass-bg-soft)", height }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <div className="mb-4 flex flex-shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl">
            <Wallet size={17} style={{ color: "var(--text-title)" }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--silver)" }}>Financeiro</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">Visão do mês</p>
          </div>
        </div>
        <ArrowUpRight
          size={15}
          className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          style={{ color: "var(--text-title)" }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-[44px] animate-pulse rounded-xl" style={{ background: "var(--shimmer-base)" }} />)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[4, 5].map((i) => <div key={i} className="h-[44px] animate-pulse rounded-xl" style={{ background: "var(--shimmer-base)" }} />)}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              {tiles.slice(0, 3).map((tile) => (
                <MetricSubcard key={tile.label} label={tile.label} value={tile.value} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tiles.slice(3).map((tile) => (
                <MetricSubcard key={tile.label} label={tile.label} value={tile.value} />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.a>
  );
}
