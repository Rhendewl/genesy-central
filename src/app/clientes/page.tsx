"use client";
import { ManagementModuleNavigation } from "@/components/financeiro/ManagementModuleNavigation";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, HeartPulse, Star, BadgeDollarSign, ClipboardCheck } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { ClientesRentabilidade } from "@/components/financeiro/ClientesRentabilidade";
import { SaudeOperacao } from "@/components/financeiro/SaudeOperacao";
import { ContractsModule } from "@/components/clientes/ContractsModule";
import { NpsModule } from "@/components/clientes/NpsModule";
import { CommercialAnalysisModule } from "@/components/clientes/CommercialAnalysisModule";
import { MarketingVgvModule } from "@/components/marketing/MarketingVgvModule";
import { FinancialPrivacyButton } from "@/components/ui/FinancialPrivacyButton";
import { useFinancialPrivacyStore } from "@/store/financial-privacy";

// ─────────────────────────────────────────────────────────────────────────────
// Clientes Page — Hub completo da carteira
// ─────────────────────────────────────────────────────────────────────────────

type TabId = "contratos" | "visao_geral" | "vgv" | "analise_comercial" | "saude" | "nps";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "visao_geral", label: "Visão Geral", icon: <LayoutGrid size={15} /> },
  { id: "contratos", label: "Contratos", icon: <ClipboardCheck size={15} /> },
  { id: "vgv", label: "VGV", icon: <BadgeDollarSign size={15} /> },
  { id: "analise_comercial", label: "Análise Comercial", icon: <ClipboardCheck size={15} /> },
  { id: "saude",       label: "Saúde",       icon: <HeartPulse size={15} /> },
  { id: "nps",         label: "NPS",         icon: <Star size={15} /> },
];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function ClientesPage() {
  const valuesHidden = useFinancialPrivacyStore((state) => state.valuesHidden);
  void valuesHidden;
  const now = new Date();
  const [activeTab, setActiveTab] = useState<TabId>("visao_geral");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab");
    if (requestedTab === "contratos" || requestedTab === "vgv" || requestedTab === "analise_comercial" || requestedTab === "saude" || requestedTab === "nps") setActiveTab(requestedTab);
    if (requestedTab === "area_clientes") setActiveTab(params.get("area") === "analise_comercial" ? "analise_comercial" : "vgv");
  }, []);

  const subtitle = useMemo(() => {
    const tab = TABS.find(t => t.id === activeTab);
    if (activeTab === "contratos") return "Modelos, documentos e assinaturas dos seus clientes";
    if (activeTab === "vgv") return "Vendas, campanhas e retorno do investimento";
    if (activeTab === "analise_comercial") return "Feedback dos corretores e inteligência comercial";
    return `${tab?.label} · ${MONTH_NAMES[month - 1]} ${year}`;
  }, [activeTab, month, year]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <h1 className="sr-only md:hidden">Clientes</h1>
      <div className="hidden md:block"><Header title="Clientes" subtitle={subtitle} actions={<FinancialPrivacyButton />} /></div>

      <ManagementModuleNavigation label="Navegação de Clientes" tabs={TABS} value={activeTab} onChange={setActiveTab} year={year} month={month} onPeriodChange={(y, m) => { setYear(y); setMonth(m); }} hidePeriod={["contratos", "vgv", "analise_comercial"].includes(activeTab)} />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="pb-8"
        >
          {activeTab === "contratos" && <ContractsModule />}
          {activeTab === "visao_geral" && <ClientesRentabilidade year={year} month={month} />}
          {activeTab === "vgv" && <MarketingVgvModule embedded />}
          {activeTab === "analise_comercial" && <CommercialAnalysisModule />}
          {activeTab === "saude"       && <SaudeOperacao year={year} month={month} />}
          {activeTab === "nps"         && <NpsModule year={year} month={month} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
