"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ChevronLeft, ChevronRight, Plug, Globe,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { ModuleAccessGate } from "@/components/layout/ModuleAccessGate";
import { DashboardTrafego } from "@/components/trafego/DashboardTrafego";
import { IntegracoesTab } from "@/components/trafego/IntegracoesTab";
import { PortaisList } from "@/components/portais/PortaisList";
import { AccountSelector } from "@/components/trafego/AccountSelector";
import { useMetaIntegrations } from "@/hooks/useMetaIntegrations";
import { cn } from "@/lib/utils";

type TabId = "dashboard" | "portais" | "integracoes";

const TABS: { id: TabId; label: string; icon: React.ReactNode; shortLabel?: string }[] = [
  { id: "dashboard",   label: "Dashboard",   icon: <LayoutDashboard size={15} /> },
  { id: "portais",     label: "Portais",     icon: <Globe size={15} /> },
  { id: "integracoes", label: "Integrações", icon: <Plug size={15} />, shortLabel: "APIs" },
];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ── Inner page (reads searchParams) ───────────────────────────────────────────

function TrafegoPageInner() {
  const searchParams = useSearchParams();

  const initialTab: TabId = (() => {
    const tab = searchParams.get("tab");
    if (tab === "integracoes" || searchParams.get("meta_pending") || searchParams.get("meta_error")) return "integracoes";
    if (tab === "portais") return "portais";
    return "dashboard";
  })();

  const now = new Date();
  const [activeTab, setActiveTab]               = useState<TabId>(initialTab);
  const [year, setYear]                         = useState(now.getFullYear());
  const [month, setMonth]                       = useState(now.getMonth() + 1);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Fetch connected Meta accounts for the selector
  const { connections } = useMetaIntegrations();
  const metaAccounts = useMemo(
    () => connections.filter(c => c.platform === "meta" && c.status !== "disconnected"),
    [connections]
  );

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
    if (activeTab === "integracoes") return "Integração com plataformas de mídia";
    if (activeTab === "portais") return "Dashboards públicos para clientes";
    const tab = TABS.find(t => t.id === activeTab);
    return `${tab?.label} · ${MONTH_NAMES[month - 1]} ${year}`;
  }, [activeTab, month, year]);

  const showPeriodNav = activeTab !== "integracoes" && activeTab !== "portais";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <Header title="Tráfego Pago" subtitle={tabSubtitle} />

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
            {/* Linha de filtros */}
            {showPeriodNav && (
              <div className="flex items-center gap-2 px-3 pt-3 pb-2.5">
                <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--icon)] hover:text-[var(--text-title)] active:scale-90 transition-all">
                  <ChevronLeft size={13} />
                </button>
                <span className="text-xs font-semibold text-[var(--text-title)] whitespace-nowrap">
                  {MONTH_NAMES[month - 1].slice(0, 3)} {year}
                </span>
                {isCurrentMonth && (
                  <span className="text-[10px] text-[#4a8fd4] bg-[#4a8fd4]/10 px-1.5 py-0.5 rounded-full font-medium">atual</span>
                )}
                <button onClick={nextMonth} disabled={isCurrentMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--icon)] disabled:opacity-30 active:scale-90 transition-all">
                  <ChevronRight size={13} />
                </button>
                {metaAccounts.length >= 1 && (
                  <div className="ml-auto">
                    <AccountSelector accounts={metaAccounts} selectedAccountId={selectedAccountId} onChange={setSelectedAccountId} />
                  </div>
                )}
              </div>
            )}
            {showPeriodNav && <div className="mx-3 h-px" style={{ background: "var(--border)" }} />}
            {/* Esteira de submódulos */}
            <div className="overflow-x-auto scrollbar-none px-2 py-2">
              <div className="flex gap-0.5 min-w-max">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all active:scale-95",
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
          {showPeriodNav && (
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
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
              {metaAccounts.length >= 1 && (
                <AccountSelector accounts={metaAccounts} selectedAccountId={selectedAccountId} onChange={setSelectedAccountId} />
              )}
            </div>
          )}
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
                  style={activeTab === tab.id ? { background: "var(--segment-active-bg)", boxShadow: "var(--segment-active-shadow)" } : {}}
                >
                  {tab.icon}
                  <span>{tab.shortLabel ?? tab.label}</span>
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
          {activeTab === "dashboard"   && <DashboardTrafego year={year} month={month} platformAccountId={selectedAccountId} />}
          {activeTab === "portais"     && <PortaisList />}
          {activeTab === "integracoes" && <IntegracoesTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function TrafegoPage() {
  return (
    <ModuleAccessGate module="trafego">
      <Suspense>
        <TrafegoPageInner />
      </Suspense>
    </ModuleAccessGate>
  );
}
