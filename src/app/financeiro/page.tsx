"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, DollarSign, TrendingDown,
  Wallet, AlertTriangle, Target, Bell, ChevronLeft, ChevronRight, Plug2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { ModuleAccessGate } from "@/components/layout/ModuleAccessGate";
import { DashboardFinanceiro } from "@/components/financeiro/DashboardFinanceiro";
import { GestaoReceitas } from "@/components/financeiro/GestaoReceitas";
import { GestaoDespesas } from "@/components/financeiro/GestaoDespesas";
import { FluxoCaixa } from "@/components/financeiro/FluxoCaixa";
import { Inadimplencia } from "@/components/financeiro/Inadimplencia";
import { MetasFinanceiras } from "@/components/financeiro/MetasFinanceiras";
import { AlertasFinanceiros } from "@/components/financeiro/AlertasFinanceiros";
import { IntegracoesFinanceiras } from "@/components/financeiro/IntegracoesFinanceiras";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Financeiro Page — Dashboard / Receitas / Despesas / Fluxo / Cobranças / Metas / Alertas
// ─────────────────────────────────────────────────────────────────────────────

type TabId =
  | "dashboard"
  | "receitas"
  | "despesas"
  | "fluxo"
  | "inadimplencia"
  | "metas"
  | "alertas"
  | "integracoes";

const TABS: { id: TabId; label: string; icon: React.ReactNode; shortLabel?: string }[] = [
  { id: "dashboard",    label: "Dashboard",      icon: <LayoutDashboard size={15} /> },
  { id: "receitas",     label: "Receitas",       icon: <DollarSign size={15} /> },
  { id: "despesas",     label: "Despesas",       icon: <TrendingDown size={15} /> },
  { id: "fluxo",        label: "Fluxo de Caixa", icon: <Wallet size={15} />, shortLabel: "Fluxo" },
  { id: "inadimplencia",label: "Inadimplência",  icon: <AlertTriangle size={15} />, shortLabel: "Cobranças" },
  { id: "metas",        label: "Metas",          icon: <Target size={15} /> },
  { id: "alertas",      label: "Alertas",        icon: <Bell size={15} /> },
  { id: "integracoes",  label: "Integrações",    icon: <Plug2 size={15} /> },
];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function FinanceiroPage() {
  const now = new Date();
  const router = useRouter();
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
    if (activeTab === "integracoes") return tab?.label ?? "";
    return `${tab?.label} · ${MONTH_NAMES[month - 1]} ${year}`;
  }, [activeTab, month, year]);

  return (
    <ModuleAccessGate module="financeiro">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <Header title="Financeiro" subtitle={tabSubtitle} />

      {/* Period selector + tabs */}
      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+4.5rem)] md:top-0 z-30">

        {/* ── Mobile: pílula glassmorphism ───────────────────────── */}
        <div className="md:hidden pt-2 pb-3">
          <div
            className="rounded-[20px] overflow-hidden"
            style={{
              background:           "var(--bg-modal)",
              backdropFilter:       "blur(24px) saturate(160%)",
              WebkitBackdropFilter: "blur(24px) saturate(160%)",
              border:               "1px solid var(--border-modal)",
              boxShadow:            "0 4px 24px rgba(0,0,0,0.20)",
            }}
          >
            {activeTab !== "integracoes" && (
              <>
                <div className="flex items-center gap-2 px-3 pt-3 pb-2.5">
                  <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--icon)] hover:text-[var(--text-title)] active:scale-90 transition-all">
                    <ChevronLeft size={13} />
                  </button>
                  <span className="text-sm font-semibold text-[var(--text-title)]">
                    {MONTH_NAMES[month - 1].slice(0, 3)} {year}
                  </span>
                  {isCurrentMonth && (
                    <span className="text-[10px] text-[#4a8fd4] bg-[#4a8fd4]/10 px-1.5 py-0.5 rounded-full font-medium">atual</span>
                  )}
                  <button onClick={nextMonth} disabled={isCurrentMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--icon)] disabled:opacity-30 active:scale-90 transition-all">
                    <ChevronRight size={13} />
                  </button>
                </div>
                <div className="mx-3 h-px" style={{ background: "var(--border)" }} />
              </>
            )}
            <div className="overflow-x-auto scrollbar-none px-2 py-2">
              <div className="flex gap-0.5 min-w-max">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-all active:scale-95",
                      activeTab === tab.id ? "text-[var(--text-title)]" : "text-[var(--icon)]",
                    )}
                    style={activeTab === tab.id ? {
                      background: "var(--segment-active-bg)",
                      boxShadow:  "var(--segment-active-shadow)",
                    } : {}}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Desktop: barra full-width (sem alterações) ─────────── */}
        <div className="hidden md:block pt-2 pb-4">
          <div className={cn("flex items-center gap-2 mb-4", activeTab === "integracoes" && "hidden")}>
            <button onClick={prevMonth} className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--icon)] hover:text-[var(--text-title)] hover:bg-[var(--hover)] transition-all">
              <ChevronLeft size={16} />
            </button>
            <div className="lc-card px-4 py-2 flex items-center gap-2 min-w-[160px] justify-center">
              <p className="text-[var(--text-title)] font-semibold text-sm">{MONTH_NAMES[month - 1]}</p>
              <p className="text-[var(--icon)] text-sm">{year}</p>
              {isCurrentMonth && (
                <span className="text-xs text-[#4a8fd4] bg-[#4a8fd4]/10 px-2 py-0.5 rounded-full font-medium">atual</span>
              )}
            </div>
            <button onClick={nextMonth} disabled={isCurrentMonth} className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--icon)] hover:text-[var(--text-title)] hover:bg-[var(--hover)] transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="overflow-x-auto scrollbar-none">
            <div className="flex gap-1 p-1 rounded-2xl min-w-max" style={{ background: "var(--glass-bg-soft)", border: "1px solid var(--glass-border)" }}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                    activeTab === tab.id ? "text-[var(--text-title)]" : "text-[var(--icon)] hover:text-[var(--text-title)] hover:bg-[var(--hover)]",
                  )}
                  style={activeTab === tab.id ? {
                    background: "var(--segment-active-bg)",
                    boxShadow:  "var(--segment-active-shadow)",
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
          {activeTab === "dashboard" && <DashboardFinanceiro year={year} month={month} onNavigateToTab={(tab) => tab === "clientes" ? router.push("/clientes") : setActiveTab(tab as TabId)} />}
          {activeTab === "receitas" && <GestaoReceitas year={year} month={month} />}
          {activeTab === "despesas" && <GestaoDespesas year={year} month={month} />}
          {activeTab === "fluxo" && <FluxoCaixa year={year} month={month} />}
          {activeTab === "inadimplencia" && <Inadimplencia year={year} month={month} />}
          {activeTab === "metas" && <MetasFinanceiras year={year} month={month} />}
          {activeTab === "alertas" && <AlertasFinanceiros year={year} month={month} />}
          {activeTab === "integracoes" && <IntegracoesFinanceiras />}
        </motion.div>
      </AnimatePresence>
    </div>
    </ModuleAccessGate>
  );
}
