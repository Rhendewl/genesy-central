"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Megaphone,
  ChevronLeft, ChevronRight, Plug, Globe,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { ModuleAccessGate } from "@/components/layout/ModuleAccessGate";
import { DashboardTrafego } from "@/components/trafego/DashboardTrafego";
import { GestaoCampanhas } from "@/components/trafego/GestaoCampanhas";
import { IntegracoesTab } from "@/components/trafego/IntegracoesTab";
import { PortaisList } from "@/components/portais/PortaisList";
import { AccountSelector } from "@/components/trafego/AccountSelector";
import { useMetaIntegrations } from "@/hooks/useMetaIntegrations";
import { cn } from "@/lib/utils";

type TabId = "dashboard" | "campanhas" | "portais" | "integracoes";

const TABS: { id: TabId; label: string; icon: React.ReactNode; shortLabel?: string }[] = [
  { id: "dashboard",   label: "Dashboard",   icon: <LayoutDashboard size={15} /> },
  { id: "campanhas",   label: "Campanhas",   icon: <Megaphone size={15} /> },
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
    if (tab === "campanhas") return "campanhas";
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
              background:           "rgba(8,8,12,0.72)",
              backdropFilter:       "blur(24px) saturate(160%)",
              WebkitBackdropFilter: "blur(24px) saturate(160%)",
              border:               "1px solid rgba(255,255,255,0.09)",
              boxShadow:            "0 4px 24px rgba(0,0,0,0.20)",
            }}
          >
            {/* Linha de filtros */}
            {showPeriodNav && (
              <div className="flex items-center gap-2 px-3 pt-3 pb-2.5">
                <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white active:scale-90 transition-all">
                  <ChevronLeft size={13} />
                </button>
                <span className="text-xs font-semibold text-white whitespace-nowrap">
                  {MONTH_NAMES[month - 1].slice(0, 3)} {year}
                </span>
                {isCurrentMonth && (
                  <span className="text-[10px] text-[#4a8fd4] bg-[#4a8fd4]/10 px-1.5 py-0.5 rounded-full font-medium">atual</span>
                )}
                <button onClick={nextMonth} disabled={isCurrentMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 disabled:opacity-30 active:scale-90 transition-all">
                  <ChevronRight size={13} />
                </button>
                {metaAccounts.length >= 1 && (
                  <div className="ml-auto">
                    <AccountSelector accounts={metaAccounts} selectedAccountId={selectedAccountId} onChange={setSelectedAccountId} />
                  </div>
                )}
              </div>
            )}
            {showPeriodNav && <div className="mx-3 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />}
            {/* Esteira de submódulos */}
            <div className="overflow-x-auto scrollbar-none px-2 py-2">
              <div className="flex gap-0.5 min-w-max">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all active:scale-95",
                      activeTab === tab.id ? "text-white" : "text-white/50",
                    )}
                    style={activeTab === tab.id ? {
                      background: "rgba(255,255,255,0.14)",
                      boxShadow:  "inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 8px rgba(0,0,0,0.30)",
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
        <div
          className="hidden md:block pt-2 pb-4"
          style={{
            background:           "rgba(0,0,0,0.60)",
            backdropFilter:       "blur(24px) saturate(160%)",
            WebkitBackdropFilter: "blur(24px) saturate(160%)",
            borderBottom:         "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {showPeriodNav && (
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-all">
                  <ChevronLeft size={16} />
                </button>
                <div className="lc-card px-4 py-2 flex items-center gap-2 min-w-[160px] justify-center">
                  <p className="text-white font-semibold text-sm">{MONTH_NAMES[month - 1]}</p>
                  <p className="text-[#b4b4b4] text-sm">{year}</p>
                  {isCurrentMonth && (
                    <span className="text-xs text-[#4a8fd4] bg-[#4a8fd4]/10 px-2 py-0.5 rounded-full font-medium">atual</span>
                  )}
                </div>
                <button onClick={nextMonth} disabled={isCurrentMonth} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight size={16} />
                </button>
              </div>
              {metaAccounts.length >= 1 && (
                <AccountSelector accounts={metaAccounts} selectedAccountId={selectedAccountId} onChange={setSelectedAccountId} />
              )}
            </div>
          )}
          <div className="overflow-x-auto scrollbar-none">
            <div className="flex gap-1 p-1 rounded-2xl min-w-max" style={{ background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                    activeTab === tab.id ? "text-white" : "text-white/50 hover:text-white hover:bg-white/[0.05]",
                  )}
                  style={activeTab === tab.id ? { background: "rgba(255,255,255,0.14)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 8px rgba(0,0,0,0.30)" } : {}}
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
          {activeTab === "dashboard"   && <DashboardTrafego year={year} month={month} platformAccountId={selectedAccountId} onNavigateToCampanhas={() => setActiveTab("campanhas")} />}
          {activeTab === "campanhas"   && <GestaoCampanhas  year={year} month={month} platformAccountId={selectedAccountId} />}
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
