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
  const now = new Date();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab") as TabId | null;
    if (requested && TABS.some((tab) => tab.id === requested)) setActiveTab(requested);
  }, []);

  const tabSubtitle = useMemo(() => {
    const tab = TABS.find(t => t.id === activeTab);
    if (activeTab === "integracoes") return tab?.label ?? "";
    return `${tab?.label} · ${MONTH_NAMES[month - 1]} ${year}`;
  }, [activeTab, month, year]);

  return (
    <ModuleAccessGate module="financeiro">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <h1 className="sr-only md:hidden">Financeiro</h1>
      <div className="hidden md:block"><Header title="Financeiro" subtitle={tabSubtitle} actions={<FinancialPrivacyButton />} /></div>

      <ManagementModuleNavigation label="Navegação de Financeiro" tabs={TABS} value={activeTab} onChange={setActiveTab} year={year} month={month} onPeriodChange={(y, m) => { setYear(y); setMonth(m); }} hidePeriod={activeTab === "integracoes"} />

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
