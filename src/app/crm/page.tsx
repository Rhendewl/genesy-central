"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, BarChart2, Settings2, Bell, Zap } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { LeadsAnalytics } from "@/components/crm/LeadsAnalytics";
import { PipelineAdmin } from "@/components/crm/admin/PipelineAdmin";
import { CrmNotificacoesTab } from "@/components/crm/notifications/CrmNotificacoesTab";
import { AutomationsAdmin } from "@/components/crm/automations/AutomationsAdmin";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CRM Page — Kanban / Leads / Pipelines
// ─────────────────────────────────────────────────────────────────────────────

type TabId = "kanban" | "leads" | "pipelines" | "notificacoes" | "automacoes";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "kanban",        label: "Kanban",       icon: <LayoutGrid size={15} /> },
  { id: "leads",         label: "Leads",        icon: <BarChart2  size={15} /> },
  { id: "pipelines",     label: "Pipelines",    icon: <Settings2  size={15} /> },
  { id: "notificacoes",  label: "Notificações", icon: <Bell       size={15} /> },
  { id: "automacoes",    label: "Automações",   icon: <Zap        size={15} /> },
];

const SUBTITLES: Record<TabId, string> = {
  kanban:       "Funil comercial de leads",
  leads:        "Métricas e análise",
  pipelines:    "Gerenciar pipelines e etapas",
  notificacoes: "Notificações automáticas por etapa",
  automacoes:   "Gatilho → espera → condições → ação, por pipeline",
};

export default function CrmPage() {
  const [activeTab, setActiveTab] = useState<TabId>("kanban");

  return (
    <div className="mx-auto max-w-[1600px]">
      <Header title="CRM" subtitle={SUBTITLES[activeTab]} />

      {/* Tab bar */}
      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+4.5rem)] md:top-0 z-30">

        {/* ── Mobile: pílula glassmorphism ───────────────────────── */}
        <div className="md:hidden px-4 pt-2 pb-3">
          <div
            className="rounded-[20px] overflow-hidden"
            style={{
              background:           "var(--bg-tooltip)",
              backdropFilter:       "blur(24px) saturate(160%)",
              WebkitBackdropFilter: "blur(24px) saturate(160%)",
              border:               "1px solid var(--border-tooltip)",
              boxShadow:            "0 4px 24px rgba(0,0,0,0.20)",
            }}
          >
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
                      background: "var(--border-card-hover)",
                      boxShadow:  "inset 0 1px 0 var(--border-card-drag), 0 1px 8px var(--shadow-sm)",
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
        <div className="hidden md:block px-4 sm:px-6 pt-2 pb-4">
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
                  style={activeTab === tab.id ? {
                    background: "var(--border-card-hover)",
                    boxShadow:  "inset 0 1px 0 var(--border-card-drag), 0 1px 8px var(--shadow-sm)",
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
          {activeTab === "kanban"       && <KanbanBoard />}
          {activeTab === "leads"        && <LeadsAnalytics />}
          {activeTab === "pipelines"    && <PipelineAdmin />}
          {activeTab === "notificacoes" && (
            <div className="px-4 sm:px-6 pt-6">
              <CrmNotificacoesTab />
            </div>
          )}
          {activeTab === "automacoes" && <AutomationsAdmin />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
