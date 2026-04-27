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
      <div
        className="sticky top-0 z-30 pt-2 pb-4"
        style={{
          background: "rgba(0,0,0,0.60)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Period navigator */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="lc-card px-4 py-2 flex items-center gap-2 min-w-[160px] justify-center">
            <p className="text-white font-semibold text-sm">{MONTH_NAMES[month - 1]}</p>
            <p className="text-[#b4b4b4] text-sm">{year}</p>
            {isCurrentMonth && (
              <span className="text-xs text-[#4a8fd4] bg-[#4a8fd4]/10 px-2 py-0.5 rounded-full font-medium">atual</span>
            )}
          </div>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="overflow-x-auto scrollbar-none">
          <div
            className="flex gap-1 p-1 rounded-2xl min-w-max"
            style={{ background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                  activeTab === tab.id
                    ? "text-white"
                    : "text-white/50 hover:text-white hover:bg-white/[0.05]"
                )}
                style={activeTab === tab.id ? {
                  background: "rgba(255,255,255,0.14)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 8px rgba(0,0,0,0.30)",
                } : {}}
              >
                {tab.icon}
                {tab.label}
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
          {activeTab === "visao_geral" && <ClientesRentabilidade year={year} month={month} />}
          {activeTab === "saude"       && <SaudeOperacao year={year} month={month} />}
          {activeTab === "nps"         && <NpsModule year={year} month={month} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
