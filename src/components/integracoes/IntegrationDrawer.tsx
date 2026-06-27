"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings2, PlayCircle, Clock, AlertTriangle, BarChart2 } from "lucide-react";
import { ConfigPanel }  from "./panels/ConfigPanel";
import { TestPanel }    from "./panels/TestPanel";
import { HistoryPanel } from "./panels/HistoryPanel";
import { DLQPanel }     from "./panels/DLQPanel";
import { MetricsPanel } from "./panels/MetricsPanel";
import type { IntegrationDefinition } from "@/lib/integrations/catalog";
import type { FormIntegrationRow } from "@/hooks/useFormularioIntegracoes";

type Tab = "config" | "test" | "history" | "dlq" | "metrics";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "config",  label: "Configuração", icon: Settings2 },
  { id: "test",    label: "Testar",       icon: PlayCircle },
  { id: "history", label: "Histórico",    icon: Clock },
  { id: "dlq",     label: "Falhas",       icon: AlertTriangle },
  { id: "metrics", label: "Métricas",     icon: BarChart2 },
];

interface IntegrationDrawerProps {
  open:       boolean;
  onClose:    () => void;
  definition: IntegrationDefinition;
  row?:       FormIntegrationRow;
  formId:     string;
  formSlug:   string;
  onSave:     (configId: string, patch: Partial<FormIntegrationRow>) => Promise<boolean>;
  onCreate:   (adapter: string) => Promise<FormIntegrationRow | null>;
  onDelete:   (configId: string) => Promise<boolean>;
}

export function IntegrationDrawer({
  open, onClose, definition, row, formId, formSlug, onSave, onCreate, onDelete,
}: IntegrationDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("config");

  const handleSave = useCallback((patch: Partial<FormIntegrationRow>) => {
    if (!row) return Promise.resolve(false);
    return onSave(row.id, patch);
  }, [row, onSave]);

  const handleCreate = useCallback(() => {
    return onCreate(definition.adapterName);
  }, [onCreate, definition.adapterName]);

  const handleDelete = useCallback(() => {
    if (!row) return Promise.resolve(false);
    const ok = onDelete(row.id);
    ok.then(deleted => { if (deleted) onClose(); });
    return ok;
  }, [row, onDelete, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="relative z-10 w-full max-w-xl flex flex-col h-full overflow-hidden"
            style={{ background: "var(--card)", borderLeft: "1px solid var(--border)" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="min-w-0">
                <h2 className="text-base font-bold truncate" style={{ color: "var(--text-title)" }}>
                  {definition.displayName}
                </h2>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {definition.category} · v{definition.version}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors ml-3 shrink-0"
              >
                <X size={16} style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>

            {/* Tabs */}
            <div
              className="flex items-center gap-0.5 px-4 py-2 shrink-0 overflow-x-auto"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                    style={{
                      background: isActive ? "var(--primary)" : "transparent",
                      color:      isActive ? "#fff" : "var(--muted-foreground)",
                    }}
                  >
                    <tab.icon size={12} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pt-4">
              {activeTab === "config" && (
                <ConfigPanel
                  definition={definition}
                  row={row}
                  onSave={handleSave}
                  onCreate={handleCreate}
                  onDelete={handleDelete}
                />
              )}
              {activeTab === "test" && (
                <TestPanel
                  definition={definition}
                  row={row}
                  formSlug={formSlug}
                />
              )}
              {activeTab === "history" && (
                <HistoryPanel adapterName={definition.adapterName} />
              )}
              {activeTab === "dlq" && (
                <DLQPanel adapterName={definition.adapterName} />
              )}
              {activeTab === "metrics" && (
                <MetricsPanel adapterName={definition.adapterName} />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
