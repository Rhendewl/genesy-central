"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useWorkspaceObjectives } from "@/hooks/useWorkspaceObjectives";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { ObjectivesGrid } from "@/components/workspace/objectives/ObjectivesGrid";
import { ObjectiveDetailPanel } from "@/components/workspace/objectives/ObjectiveDetailPanel";

export default function WorkspaceObjetivosPage() {
  const { viewingMember } = useWorkspaceViewing();
  const objectivesHook = useWorkspaceObjectives(viewingMember?.auth_user_id ?? undefined);
  const [openObjectiveId, setOpenObjectiveId] = useState<string | null>(null);
  const [isPanelOpen,     setIsPanelOpen]     = useState(false);

  function openObjective(id: string) {
    setOpenObjectiveId(id);
    setIsPanelOpen(true);
  }

  function openCreate() {
    setOpenObjectiveId(null);
    setIsPanelOpen(true);
  }

  function closePanel() {
    setIsPanelOpen(false);
    setOpenObjectiveId(null);
  }

  return (
    <div className="flex flex-col pb-24">
      <Header title="Workspace" subtitle="Suas metas e o progresso de cada uma" />

      <div className="flex flex-wrap items-center justify-end gap-3 px-4 pb-4 sm:px-6">
        <motion.button
          onClick={openCreate}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="lc-btn flex items-center gap-2 px-4 py-2 text-sm"
        >
          <Plus size={16} strokeWidth={2.5} />
          Novo Objetivo
        </motion.button>
      </div>

      <div className="flex-1 px-4 sm:px-6">
        {objectivesHook.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
          </div>
        ) : objectivesHook.error ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-red-400">{objectivesHook.error}</p>
          </div>
        ) : (
          <ObjectivesGrid
            objectives={objectivesHook.objectives}
            isLoading={false}
            onOpen={openObjective}
            onToggleStep={objectivesHook.toggleObjectiveStep}
          />
        )}
      </div>

      <AnimatePresence>
        {isPanelOpen && (
          <ObjectiveDetailPanel objectiveId={openObjectiveId} objectivesHook={objectivesHook} onClose={closePanel} />
        )}
      </AnimatePresence>
    </div>
  );
}
