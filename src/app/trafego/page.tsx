"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Megaphone,
  ChevronLeft, ChevronRight, Plug, ChevronDown,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { DashboardTrafego } from "@/components/trafego/DashboardTrafego";
import { GestaoCampanhas } from "@/components/trafego/GestaoCampanhas";
import { IntegracoesTab } from "@/components/trafego/IntegracoesTab";
import { useMetaIntegrations } from "@/hooks/useMetaIntegrations";
import { cn } from "@/lib/utils";
import type { AdPlatformAccount } from "@/types";

type TabId = "dashboard" | "campanhas" | "integracoes";

const TABS: { id: TabId; label: string; icon: React.ReactNode; shortLabel?: string }[] = [
  { id: "dashboard",   label: "Dashboard",   icon: <LayoutDashboard size={15} /> },
  { id: "campanhas",   label: "Campanhas",   icon: <Megaphone size={15} /> },
  { id: "integracoes", label: "Integrações", icon: <Plug size={15} />, shortLabel: "APIs" },
];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ── Account selector ───────────────────────────────────────────────────────────

interface AccountSelectorProps {
  accounts:          AdPlatformAccount[];
  selectedAccountId: string | null;
  onChange:          (id: string | null) => void;
}

function AccountSelector({ accounts, selectedAccountId, onChange }: AccountSelectorProps) {
  const [open, setOpen] = useState(false);

  if (accounts.length === 0) return null;

  const selected = accounts.find(a => a.id === selectedAccountId);
  const label = selected ? selected.account_name : "Todas as contas";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "lc-card flex items-center gap-2 px-3.5 py-2 text-sm transition-all",
          open && "ring-1 ring-[#4a8fd4]/30"
        )}
      >
        {/* Status dot */}
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: selectedAccountId ? "#4a8fd4" : "#22c55e" }}
        />
        <span className="text-white font-medium max-w-[140px] truncate">{label}</span>
        {accounts.length > 1 && (
          <span className="text-[10px] text-[#5a5a5a] bg-white/5 px-1.5 py-0.5 rounded-full">
            {accounts.length}
          </span>
        )}
        <ChevronDown
          size={13}
          className={cn("text-[#b4b4b4] transition-transform shrink-0", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 top-full mt-1.5 z-50 min-w-[220px] rounded-xl overflow-hidden shadow-2xl"
              style={{
                background: "rgba(16,20,28,0.95)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              {/* "All accounts" option */}
              <button
                onClick={() => { onChange(null); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors text-left",
                  !selectedAccountId
                    ? "bg-[#4a8fd4]/10 text-white"
                    : "text-[#b4b4b4] hover:bg-white/5 hover:text-white"
                )}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="font-medium">Todas as contas</span>
                {!selectedAccountId && (
                  <span className="ml-auto text-[#4a8fd4] text-xs">✓</span>
                )}
              </button>

              {/* Divider */}
              <div className="mx-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }} />

              {/* Individual accounts */}
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => { onChange(acc.id); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors text-left",
                    selectedAccountId === acc.id
                      ? "bg-[#4a8fd4]/10 text-white"
                      : "text-[#b4b4b4] hover:bg-white/5 hover:text-white"
                  )}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: acc.status === "connected" ? "#4a8fd4"
                        : acc.status === "error" ? "#ef4444"
                        : "#5a5a5a",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate leading-tight">{acc.account_name}</p>
                    {acc.client && (
                      <p className="text-[10px] text-[#5a5a5a] truncate">{acc.client.name}</p>
                    )}
                  </div>
                  {selectedAccountId === acc.id && (
                    <span className="ml-auto text-[#4a8fd4] text-xs shrink-0">✓</span>
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Inner page (reads searchParams) ───────────────────────────────────────────

function TrafegoPageInner() {
  const searchParams = useSearchParams();

  const initialTab: TabId = (
    searchParams.get("tab") === "integracoes" ||
    searchParams.get("meta_pending") ||
    searchParams.get("meta_error")
  ) ? "integracoes" : "dashboard";

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
    const tab = TABS.find(t => t.id === activeTab);
    if (activeTab === "integracoes") return "Integração com plataformas de mídia";
    return `${tab?.label} · ${MONTH_NAMES[month - 1]} ${year}`;
  }, [activeTab, month, year]);

  const showPeriodNav = activeTab !== "integracoes";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <Header title="Tráfego Pago" subtitle={tabSubtitle} />

      <div
        className="sticky top-0 z-30 pt-2 pb-4"
        style={{ background: "linear-gradient(to bottom, var(--background) 85%, transparent)" }}
      >
        {/* Period navigator + account selector */}
        {showPeriodNav && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {/* Month navigation */}
            <div className="flex items-center gap-2">
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
                  <span className="text-xs text-[#4a8fd4] bg-[#4a8fd4]/10 px-2 py-0.5 rounded-full font-medium">
                    atual
                  </span>
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

            {/* Account selector — only when ≥1 Meta account exists */}
            {metaAccounts.length >= 1 && (
              <AccountSelector
                accounts={metaAccounts}
                selectedAccountId={selectedAccountId}
                onChange={setSelectedAccountId}
              />
            )}
          </div>
        )}

        {/* Tab bar */}
        <div className="overflow-x-auto scrollbar-none">
          <div
            className="flex gap-1 p-1 rounded-2xl min-w-max"
            style={{
              background: "linear-gradient(to right, rgba(255,255,255,0.15), rgba(255,255,255,0.03))",
              border: "none",
              backdropFilter: "blur(12px)",
            }}
          >
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
                style={
                  activeTab === tab.id
                    ? { background: "rgba(255,255,255,0.12)", border: "none", boxShadow: "none" }
                    : {}
                }
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
          {activeTab === "dashboard"   && <DashboardTrafego year={year} month={month} platformAccountId={selectedAccountId} onNavigateToCampanhas={() => setActiveTab("campanhas")} />}
          {activeTab === "campanhas"   && <GestaoCampanhas  year={year} month={month} platformAccountId={selectedAccountId} />}
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
