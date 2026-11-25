"use client";
import { ManagementModuleNavigation } from "@/components/financeiro/ManagementModuleNavigation";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, DollarSign, TrendingDown,
  Wallet, AlertTriangle, Target, Bell, Plug2,
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
import { FinancialPrivacyButton } from "@/components/ui/FinancialPrivacyButton";
import { useFinancialPrivacyStore } from "@/store/financial-privacy";
import { periodLabel, periodMonth, presetPeriod, type FinancialPeriod } from "@/lib/financeiro/period";

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
  const valuesHidden = useFinancialPrivacyStore((state) => state.valuesHidden);
  void valuesHidden;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [period, setPeriod] = useState<FinancialPeriod>(() => presetPeriod("mes"));
  const { year, month } = periodMonth(period);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab") as TabId | null;
    if (requested && TABS.some((tab) => tab.id === requested)) setActiveTab(requested);
  }, []);

  const tabSubtitle = useMemo(() => {
    const tab = TABS.find(t => t.id === activeTab);
    if (activeTab === "integracoes") return tab?.label ?? "";
    if (activeTab === "metas") return `${tab?.label} · ${MONTH_NAMES[month - 1]} ${year}`;
    if (activeTab === "inadimplencia") return tab?.label ?? "";
    return `${tab?.label} · ${periodLabel(period)}`;
  }, [activeTab, month, year, period]);

  return (
    <ModuleAccessGate module="financeiro">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <h1 className="sr-only md:hidden">Financeiro</h1>
      <div className="hidden md:block"><Header title="Financeiro" subtitle={tabSubtitle} actions={<FinancialPrivacyButton />} /></div>

      <ManagementModuleNavigation label="Navegação de Financeiro" tabs={TABS} value={activeTab} onChange={setActiveTab} period={period} onPeriodChange={setPeriod} hidePeriod={activeTab === "integracoes" || activeTab === "inadimplencia"} />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ y: 8 }}
          animate={{ y: 0 }}
          exit={{ y: -8 }}
          transition={{ duration: 0.2 }}
          className="pb-8"
        >
          {activeTab === "dashboard" && <DashboardFinanceiro period={period} onNavigateToTab={(tab) => tab === "clientes" ? router.push("/clientes") : setActiveTab(tab as TabId)} />}
          {activeTab === "receitas" && <GestaoReceitas period={period} />}
          {activeTab === "despesas" && <GestaoDespesas period={period} />}
          {activeTab === "fluxo" && <FluxoCaixa period={period} />}
          {activeTab === "inadimplencia" && <Inadimplencia year={year} month={month} />}
          {activeTab === "metas" && <MetasFinanceiras year={year} month={month} />}
          {activeTab === "alertas" && <AlertasFinanceiros period={period} />}
          {activeTab === "integracoes" && <IntegracoesFinanceiras />}
        </motion.div>
      </AnimatePresence>
    </div>
    </ModuleAccessGate>
  );
}
