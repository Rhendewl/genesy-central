"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, DollarSign, TrendingDown, Users,
  Wallet, AlertTriangle, Target, Bell, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { DashboardFinanceiro } from "@/components/financeiro/DashboardFinanceiro";
import { GestaoReceitas } from "@/components/financeiro/GestaoReceitas";
import { GestaoDespesas } from "@/components/financeiro/GestaoDespesas";
import { ClientesRentabilidade } from "@/components/financeiro/ClientesRentabilidade";
import { FluxoCaixa } from "@/components/financeiro/FluxoCaixa";
import { Inadimplencia } from "@/components/financeiro/Inadimplencia";
import { MetasFinanceiras } from "@/components/financeiro/MetasFinanceiras";
import { AlertasFinanceiros } from "@/components/financeiro/AlertasFinanceiros";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Financeiro Page — Módulo Financeiro Completo
// ─────────────────────────────────────────────────────────────────────────────

type TabId =
  | "dashboard"
  | "receitas"
  | "despesas"
  | "clientes"
  | "fluxo"
  | "inadimplencia"
  | "metas"
  | "alertas";

const TABS: { id: TabId; label: string; icon: React.ReactNode; shortLabel?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={15} />, shortLabel: "Dashboard" },
  { id: "receitas", label: "Receitas", icon: <DollarSign size={15} /> },
  { id: "despesas", label: "Despesas", icon: <TrendingDown size={15} /> },
  { id: "clientes", label: "Clientes", icon: <Users size={15} /> },
  { id: "fluxo", label: "Fluxo de Caixa", icon: <Wallet size={15} />, shortLabel: "Fluxo" },
  { id: "inadimplencia", label: "Inadimplência", icon: <AlertTriangle size={15} />, shortLabel: "Cobranças" },
  { id: "metas", label: "Metas", icon: <Target size={15} /> },
  { id: "alertas", label: "Alertas", icon: <Bell size={15} /> },
];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function FinanceiroPage() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    if (isCurrentMonth) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const tabSubtitle = useMemo(() => {
    const tab = TABS.find(t => t.id === activeTab);
    return `${tab?.label} · ${MONTH_NAMES[month - 1]} ${year}`;
  }, [activeTab, month, year]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <Header title="Financeiro" subtitle={tabSubtitle} />

      {/* Period selector + tabs */}
      <div className="sticky top-0 z-30 pt-2 pb-4"
        style={{ background: "linear-gradient(to bottom, var(--background) 85%, transparent)" }}>

        {/* Period navigator */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={prevMonth}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-all"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <ChevronLeft size={16} />
          </button>
          <div className="lc-card px-4 py-2 flex items-center gap-2 min-w-[160px] justify-center">
            <p className="text-white font-semibold text-sm">{MONTH_NAMES[month - 1]}</p>
            <p className="text-[#b4b4b4] text-sm">{year}</p>
            {isCurrentMonth && (
              <span className="text-xs text-[#4a8fd4] bg-[#4a8fd4]/10 px-2 py-0.5 rounded-full font-medium">atual</span>
            )}
          </div>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex gap-1 p-1 rounded-2xl min-w-max"
            style={{ background: "linear-gradient(to right, rgba(255,255,255,0.15), rgba(255,255,255,0.03))", border: "none", backdropFilter: "blur(12px)" }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                  activeTab === tab.id
                    ? "text-white"
                    : "text-white/50 hover:text-white hover:bg-white/[0.05]"
                )}
                style={activeTab === tab.id ? {
                  background: "rgba(255,255,255,0.12)",
                  border: "none",
                  boxShadow: "none",
                } : {}}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.shortLabel ?? tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel?.charAt(0) ?? tab.label.charAt(0)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="pb-8"
        >
          {activeTab === "dashboard" && <DashboardFinanceiro year={year} month={month} onNavigateToTab={(tab) => setActiveTab(tab as TabId)} />}
          {activeTab === "receitas" && <GestaoReceitas year={year} month={month} />}
          {activeTab === "despesas" && <GestaoDespesas year={year} month={month} />}
          {activeTab === "clientes" && <ClientesRentabilidade year={year} month={month} />}
          {activeTab === "fluxo" && <FluxoCaixa year={year} month={month} />}
          {activeTab === "inadimplencia" && <Inadimplencia year={year} month={month} />}
          {activeTab === "metas" && <MetasFinanceiras year={year} month={month} />}
          {activeTab === "alertas" && <AlertasFinanceiros year={year} month={month} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
