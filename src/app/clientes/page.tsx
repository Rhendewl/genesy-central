"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, HeartPulse, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { ClientesRentabilidade } from "@/components/financeiro/ClientesRentabilidade";
import { SaudeOperacao } from "@/components/financeiro/SaudeOperacao";
import { NpsModule } from "@/components/clientes/NpsModule";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Clientes Page — Hub completo da carteira
// ─────────────────────────────────────────────────────────────────────────────

type TabId = "visao_geral" | "saude" | "nps";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "visao_geral", label: "Visão Geral", icon: <LayoutGrid size={15} /> },
  { id: "saude",       label: "Saúde",       icon: <HeartPulse size={15} /> },
  { id: "nps",         label: "NPS",         icon: <Star size={15} /> },
];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function ClientesPage() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<TabId>("visao_geral");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
    if (isCurrent) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const subtitle = useMemo(() => {
    const tab = TABS.find(t => t.id === activeTab);
    return `${tab?.label} · ${MONTH_NAMES[month - 1]} ${year}`;
  }, [activeTab, month, year]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <Header title="Clientes" subtitle={subtitle} />

      {/* Sticky nav */}
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
            <div className="flex items-center gap-2 px-3 pt-3 pb-2.5">
              <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-[color-mix(in_srgb,var(--text-title)_50%,transparent)] hover:text-[var(--text-title)] active:scale-90 transition-all">
                <ChevronLeft size={13} />
              </button>
              <span className="text-sm font-semibold text-[var(--text-title)]">
                {MONTH_NAMES[month - 1].slice(0, 3)} {year}
              </span>
              {isCurrentMonth && (
                <span className="text-[10px] text-[#4a8fd4] bg-[#4a8fd4]/10 px-1.5 py-0.5 rounded-full font-medium">atual</span>
              )}
              <button onClick={nextMonth} disabled={isCurrentMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-[color-mix(in_srgb,var(--text-title)_50%,transparent)] disabled:opacity-30 active:scale-90 transition-all">
                <ChevronRight size={13} />
              </button>
            </div>
            <div className="mx-3 h-px" style={{ background: "var(--border)" }} />
            <div className="overflow-x-auto scrollbar-none px-2 py-2">
              <div className="flex gap-0.5 min-w-max">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-all active:scale-95",
                      activeTab === tab.id ? "text-[var(--text-title)]" : "text-[color-mix(in_srgb,var(--text-title)_50%,transparent)]",
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
          <div className="flex items-center gap-2 mb-4">
            <button onClick={prevMonth} className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--silver)] hover:text-[var(--text-title)] hover:bg-[var(--hover)] transition-all">
              <ChevronLeft size={16} />
            </button>
            <div className="lc-card px-4 py-2 flex items-center gap-2 min-w-[160px] justify-center">
              <p className="text-[var(--text-title)] font-semibold text-sm">{MONTH_NAMES[month - 1]}</p>
              <p className="text-[var(--silver)] text-sm">{year}</p>
              {isCurrentMonth && (
                <span className="text-xs text-[#4a8fd4] bg-[#4a8fd4]/10 px-2 py-0.5 rounded-full font-medium">atual</span>
              )}
            </div>
            <button onClick={nextMonth} disabled={isCurrentMonth} className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--silver)] hover:text-[var(--text-title)] hover:bg-[var(--hover)] transition-all disabled:opacity-30 disabled:cursor-not-allowed">
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
                    "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                    activeTab === tab.id ? "text-[var(--text-title)]" : "text-[color-mix(in_srgb,var(--text-title)_50%,transparent)] hover:text-[var(--text-title)] hover:bg-[var(--hover)]",
                  )}
                  style={activeTab === tab.id ? {
                    background: "var(--segment-active-bg)",
                    boxShadow:  "var(--segment-active-shadow)",
                  } : {}}
                >
                  {tab.icon}
                  {tab.label}
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
          {activeTab === "visao_geral" && <ClientesRentabilidade year={year} month={month} />}
          {activeTab === "saude"       && <SaudeOperacao year={year} month={month} />}
          {activeTab === "nps"         && <NpsModule year={year} month={month} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
