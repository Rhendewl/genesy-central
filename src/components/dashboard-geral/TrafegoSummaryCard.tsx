"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { useTrafegoMetrics } from "@/hooks/useTrafegoMetrics";
import { useMetaIntegrations } from "@/hooks/useMetaIntegrations";
import { AccountSelector } from "@/components/trafego/AccountSelector";
import { MetricSubcard } from "./MetricSubcard";

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

interface TrafegoSummaryCardProps {
  year:   number;
  month:  number;
  height: number;
  delay?: number;
}

export function TrafegoSummaryCard({ year, month, height, delay = 0 }: TrafegoSummaryCardProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const { connections } = useMetaIntegrations();
  const metaAccounts = useMemo(
    () => connections.filter((c) => c.platform === "meta" && c.status !== "disconnected"),
    [connections]
  );

  const { dashboard, isLoading } = useTrafegoMetrics(year, month, selectedAccountId);

  const tiles = [
    { label: "Investimento", value: fmtBRL(dashboard?.investimento_total ?? 0) },
    { label: "Leads",        value: String(dashboard?.leads_total ?? 0) },
    { label: "CTR",          value: `${(dashboard?.ctr_medio ?? 0).toFixed(2)}%` },
    { label: "CPM",          value: fmtBRL(dashboard?.cpm_medio ?? 0) },
    { label: "CPL",          value: fmtBRL(dashboard?.cpl_medio ?? 0) },
  ];

  return (
    <motion.a
      href="/trafego"
      className="lc-card group flex flex-col cursor-pointer overflow-hidden p-6"
      style={{ background: "rgba(0,0,0,0.31)", height }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <div className="mb-4 flex flex-shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl">
            <TrendingUp size={17} style={{ color: "#ffffff" }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight" style={{ color: "#b4b4b4" }}>Tráfego Pago</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">Mês atual</p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <AccountSelector accounts={metaAccounts} selectedAccountId={selectedAccountId} onChange={setSelectedAccountId} compact />
          <ArrowUpRight
            size={15}
            className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            style={{ color: "#ffffff" }}
          />
        </div>
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
