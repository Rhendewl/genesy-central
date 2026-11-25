"use client";

import { LeadRoulettes } from "@/components/crm/admin/LeadRoulettes";
import { useSegmentIndicator } from "@/components/ui/useSegmentIndicator";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, LayoutGrid, BarChart2, Settings2, Bell, Zap, FileBarChart, Target } from "lucide-react";
import { MetaLeadForms } from "@/components/marketing/MetaLeadForms";
import "@/components/crm/crm-mobile.css";
import { CrmMobileNavigation } from "@/components/crm/CrmMobileNavigation";
import { Header } from "@/components/layout/Header";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { LeadsAnalytics } from "@/components/crm/LeadsAnalytics";
import { PipelineAdmin } from "@/components/crm/admin/PipelineAdmin";
import { CrmNotificacoesTab } from "@/components/crm/notifications/CrmNotificacoesTab";
import { AutomationsAdmin } from "@/components/crm/automations/AutomationsAdmin";
import { CrmReports } from "@/components/crm/reports/CrmReports";
import { CrmGoals } from "@/components/crm/goals/CrmGoals";
import { cn } from "@/lib/utils";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import { isAdministrativeMember } from "@/lib/user-access";
import { FinancialPrivacyButton } from "@/components/ui/FinancialPrivacyButton";
import { useFinancialPrivacyStore } from "@/store/financial-privacy";

// ─────────────────────────────────────────────────────────────────────────────
// CRM Page — Kanban / Leads / Pipelines
// ─────────────────────────────────────────────────────────────────────────────

type TabId = "roletas" | "kanban" | "leads" | "metas" | "relatorios" | "pipelines" | "notificacoes" | "automacoes" | "formularios-meta";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "kanban",        label: "Funil",       icon: <LayoutGrid size={15} /> },
  { id: "leads",         label: "Análise do CRM",        icon: <BarChart2  size={15} /> },
  { id: "metas",         label: "Metas",        icon: <Target size={15} /> },
  { id: "relatorios",    label: "Relatórios",   icon: <FileBarChart size={15} /> },
  { id: "pipelines",     label: "Pipelines",    icon: <Settings2  size={15} /> },
  { id: "notificacoes",  label: "Notificações", icon: <Bell       size={15} /> },
  { id: "formularios-meta", label: "Formulários Meta", icon: <ClipboardList size={15} /> },
  { id: "roletas", label: "Roletas", icon: <Settings2 size={15} /> },
  { id: "automacoes",    label: "Automações",   icon: <Zap        size={15} /> },
];

const SUBTITLES: Record<TabId, string> = {
  roletas: "Distribuição equilibrada por formulário e pipeline",
  kanban:       "Funil comercial de leads",
  leads:        "Atendimento, evolução e gargalos da operação",
  metas:        "Objetivos comerciais e progresso do funil",
  relatorios:   "Atividades e desempenho comercial por período",
  pipelines:    "Gerenciar pipelines e etapas",
  notificacoes: "Notificações automáticas por etapa",
  "formularios-meta": "Captura e distribuição de leads dos formulários Meta",
  automacoes:   "Gatilho → espera → condições → ação, por pipeline",
};

export default function CrmPage() {
  const valuesHidden = useFinancialPrivacyStore((state) => state.valuesHidden);
  void valuesHidden;
  const [activeTab, setActiveTab] = useState<TabId>("kanban");
  const tabSeg = useSegmentIndicator({ background: "var(--segment-active-bg)", boxShadow: "var(--segment-active-shadow)" });
  useEffect(() => { const tab = new URLSearchParams(window.location.search).get("tab"); if (TABS.some(item => item.id === tab)) setActiveTab(tab as TabId); }, []);
  const { member, isOwner } = useCurrentMember();
  const hasFullCrmAccess = isAdministrativeMember(member, isOwner === true);
  const visibleTabs = hasFullCrmAccess
    ? TABS
    : TABS.filter(tab => tab.id === "kanban" || tab.id === "leads");
  const isKanban = activeTab === "kanban";

  return (
    <div className={cn(
      "mx-auto max-w-[1600px]",
      isKanban && "crm-kanban-page flex flex-col overflow-hidden",
    )}>
      <div className="hidden md:block"><Header title="CRM" subtitle={SUBTITLES[activeTab]} actions={<FinancialPrivacyButton />} /></div>

      {/* Tab bar */}
      <div className={cn("z-30 flex-none md:sticky md:top-0", isKanban ? "relative" : "sticky top-[calc(env(safe-area-inset-top,0px)+4.5rem)]")}>

        <CrmMobileNavigation tabs={visibleTabs} value={activeTab} onChange={value => setActiveTab(value as TabId)} />

        {/* ── Desktop: barra full-width (sem alterações) ─────────── */}
        <div className="hidden md:block px-4 sm:px-6 pt-2 pb-4">
          <div className="overflow-x-auto scrollbar-none">
            <div ref={tabSeg.trackRef} className="relative flex gap-1 p-1 rounded-2xl min-w-max" style={{ background: "var(--glass-bg-soft)", border: "1px solid var(--glass-border)" }}>
              {tabSeg.indicator}
              {visibleTabs.map(tab => (
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
                  <span>{tab.label}</span>
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
          initial={{ y: 8 }}
          animate={{ y: 0 }}
          exit={{ y: -8 }}
          transition={{ duration: 0.2 }}
          className={cn(
            isKanban ? "flex min-h-0 flex-1 flex-col" : "pb-8",
          )}
        >
          {activeTab === "kanban"       && <KanbanBoard />}
          {activeTab === "leads"        && <LeadsAnalytics />}
          {hasFullCrmAccess && activeTab === "metas" && <CrmGoals />}
          {hasFullCrmAccess && activeTab === "relatorios" && <CrmReports />}
          {hasFullCrmAccess && activeTab === "pipelines"    && <PipelineAdmin />}
          {hasFullCrmAccess && activeTab === "notificacoes" && (
            <div className="px-4 sm:px-6 pt-6">
              <CrmNotificacoesTab />
            </div>
          )}
          {hasFullCrmAccess && activeTab === "roletas" && <LeadRoulettes />}
          {hasFullCrmAccess && activeTab === "formularios-meta" && <MetaLeadForms />}
          {hasFullCrmAccess && activeTab === "automacoes" && <AutomationsAdmin />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
