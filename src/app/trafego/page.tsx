"use client";

import { useState, useMemo, Suspense } from "react";
import { useSegmentIndicator } from "@/components/ui/useSegmentIndicator";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ChevronLeft, ChevronRight, Plug, Globe, RefreshCw,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { DashboardTrafego } from "@/components/trafego/DashboardTrafego";
import { IntegracoesTab } from "@/components/trafego/IntegracoesTab";
import { PortaisList } from "@/components/portais/PortaisList";
import { AccountSelector } from "@/components/trafego/AccountSelector";
import { TrafficReportGenerator } from "@/components/trafego/TrafficReportGenerator";
import { useMetaIntegrations } from "@/hooks/useMetaIntegrations";
import { cn } from "@/lib/utils";
import { FinancialPrivacyButton } from "@/components/ui/FinancialPrivacyButton";
import { useFinancialPrivacyStore } from "@/store/financial-privacy";

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
  const valuesHidden = useFinancialPrivacyStore((state) => state.valuesHidden);
  void valuesHidden;
  const searchParams = useSearchParams();

  const initialTab: TabId = (() => {
    const tab = searchParams.get("tab");
    if (tab === "integracoes" || searchParams.get("meta_pending") || searchParams.get("meta_error")) return "integracoes";
    if (tab === "portais") return "portais";
    return "dashboard";
  })();

  const now = new Date();
  const [activeTab, setActiveTab]               = useState<TabId>(initialTab);
  const mobileTabSeg = useSegmentIndicator({ background: "var(--segment-active-bg)", boxShadow: "var(--segment-active-shadow)" });
  const tabSeg = useSegmentIndicator({ background: "var(--segment-active-bg)", boxShadow: "var(--segment-active-shadow)" });
  const [year, setYear]                         = useState(now.getFullYear());
  const [month, setMonth]                       = useState(now.getMonth() + 1);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [dashboardRevision, setDashboardRevision] = useState(0);

  // Fetch connected Meta accounts for the selector
  const { connections, syncAccount, syncing } = useMetaIntegrations();
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
  const relevantAccounts = selectedAccountId
    ? metaAccounts.filter(account => account.id === selectedAccountId)
    : metaAccounts.filter(account => account.status === "connected");
  const isSyncing = relevantAccounts.some(account => syncing[account.id]);

  const handleSync = async () => {
    if (!relevantAccounts.length || isSyncing) return;
    const monthDate = new Date(year, month - 1, 1);
    const since = format(startOfMonth(monthDate), "yyyy-MM-dd");
    const until = format(isCurrentMonth ? new Date() : endOfMonth(monthDate), "yyyy-MM-dd");
    const results = await Promise.all(
      relevantAccounts.map(account => syncAccount(account.id, since, until)),
    );
    const failures = results.filter(result => result.error);
    if (failures.length === results.length) {
      toast.error(failures[0]?.error ?? "Não foi possível sincronizar");
      return;
    }
    setDashboardRevision(revision => revision + 1);
    failures.length
      ? toast.warning("Dados atualizados, mas uma conta apresentou erro")
      : toast.success("Dados da Meta atualizados");
  };

  const tabSubtitle = useMemo(() => {
    if (activeTab === "integracoes") return "Integração com plataformas de mídia";
    if (activeTab === "portais") return "Dashboards públicos para clientes";
    const tab = TABS.find(t => t.id === activeTab);
    return `${tab?.label} · ${MONTH_NAMES[month - 1]} ${year}`;
  }, [activeTab, month, year]);

  const showPeriodNav = activeTab !== "integracoes" && activeTab !== "portais";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <Header title="Tráfego Pago" subtitle={tabSubtitle} actions={<FinancialPrivacyButton compact />} />

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
              <div className="flex flex-wrap items-center gap-2 px-3 pt-3 pb-2.5">
                <div className="flex items-center gap-1">
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
                </div>
                {metaAccounts.length >= 1 && (
                  <div>
                    <AccountSelector accounts={metaAccounts} selectedAccountId={selectedAccountId} onChange={setSelectedAccountId} compact />
                  </div>
                )}
                <button
                  onClick={() => void handleSync()}
                  disabled={!relevantAccounts.length || isSyncing}
                  title={isSyncing ? "Sincronizando dados da Meta…" : "Sincronizar dados da Meta"}
                  aria-label="Sincronizar dados da Meta"
                  aria-busy={isSyncing}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#4a8fd4] transition-colors hover:bg-[#4a8fd4]/10 disabled:opacity-40"
                >
                  <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
                </button>
                <div className="ml-auto"><TrafficReportGenerator accounts={metaAccounts} selectedAccountId={selectedAccountId} year={year} month={month} /></div>
              </div>
            )}
            {showPeriodNav && <div className="mx-3 h-px" style={{ background: "var(--border)" }} />}
            {/* Esteira de submódulos */}
            <div className="overflow-x-auto scrollbar-none px-2 py-2">
              <div ref={mobileTabSeg.trackRef} className="relative flex gap-0.5 min-w-max">
                {mobileTabSeg.indicator}
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    data-active={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "relative z-[1] flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors active:scale-95",
                      activeTab === tab.id ? "text-[var(--text-title)]" : "text-[var(--icon)]",
                    )}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Desktop: ações e filtros ─────────────────────────── */}
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
              <button
                onClick={() => void handleSync()}
                disabled={!relevantAccounts.length || isSyncing}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#4a8fd4] transition-colors hover:bg-[#4a8fd4]/10 disabled:opacity-40"
                title={isSyncing ? "Sincronizando dados da Meta…" : "Sincronizar dados da Meta"}
                aria-label="Sincronizar dados da Meta"
                aria-busy={isSyncing}
              >
                <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
              </button>
              <div className="ml-auto"><TrafficReportGenerator accounts={metaAccounts} selectedAccountId={selectedAccountId} year={year} month={month} /></div>
            </div>
          )}
          <div className="overflow-x-auto scrollbar-none">
            <div ref={tabSeg.trackRef} className="relative flex gap-1 p-1 rounded-2xl min-w-max" style={{ background: "var(--glass-bg-soft)", border: "1px solid var(--glass-border)" }}>
              {tabSeg.indicator}
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  data-active={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative z-[1] flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap",
                    activeTab === tab.id ? "text-[var(--text-title)]" : "text-[var(--icon)] hover:text-[var(--text-title)] hover:bg-[var(--hover)]",
                  )}
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
          {activeTab === "dashboard"   && <DashboardTrafego key={dashboardRevision} year={year} month={month} platformAccountId={selectedAccountId} />}
          {activeTab === "portais"     && <PortaisList />}
          {activeTab === "integracoes" && <IntegracoesTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function TrafegoPage() {
  return (
    <Suspense>
      <TrafegoPageInner />
    </Suspense>
  );
}
