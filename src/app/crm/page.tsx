"use client";

import { Suspense, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, BarChart2, Plug, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { LeadsAnalytics } from "@/components/crm/LeadsAnalytics";
import { CrmIntegracoes } from "@/components/crm/CrmIntegracoes";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CRM Page — Kanban / Leads / Integrações
// ─────────────────────────────────────────────────────────────────────────────

type TabId = "kanban" | "leads" | "integracoes";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "kanban",      label: "Kanban",       icon: <LayoutGrid size={15} /> },
  { id: "leads",       label: "Leads",        icon: <BarChart2  size={15} /> },
  { id: "integracoes", label: "Integrações",  icon: <Plug       size={15} /> },
];

const SUBTITLES: Record<TabId, string> = {
  kanban:      "Funil comercial de leads",
  leads:       "Métricas e análise",
  integracoes: "Integrações do CRM",
};

export default function CrmPage() {
  const [activeTab, setActiveTab] = useState<TabId>("kanban");

  return (
    <div className="mx-auto max-w-[1600px]">
      <Header title="CRM" subtitle={SUBTITLES[activeTab]} />

      {/* Tab bar */}
      <div
        className="sticky top-0 z-30 px-4 sm:px-6 pt-2 pb-4"
        style={{
          background: "rgba(0,0,0,0.60)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
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
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                  activeTab === tab.id
                    ? "text-white"
                    : "text-white/50 hover:text-white hover:bg-white/[0.05]",
                )}
                style={activeTab === tab.id ? {
                  background: "rgba(255,255,255,0.14)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 8px rgba(0,0,0,0.30)",
                } : {}}
              >
                {tab.icon}
                <span>{tab.label}</span>
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
          {activeTab === "kanban"      && <KanbanBoard />}
          {activeTab === "leads"       && <LeadsAnalytics />}
          {activeTab === "integracoes" && (
            <Suspense fallback={
              <div className="flex items-center justify-center py-24">
                <Loader2 size={28} className="animate-spin text-[#4a8fd4]" />
              </div>
            }>
              <CrmIntegracoes />
            </Suspense>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
