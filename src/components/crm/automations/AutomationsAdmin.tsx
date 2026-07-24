"use client";

import { useEffect, useState } from "react";
import { Zap, Loader2, AlertCircle } from "lucide-react";
import { usePipelines } from "@/hooks/usePipelines";
import { useCrmAutomations } from "@/hooks/useCrmAutomations";
import { useWorkflowDashboard } from "@/hooks/useWorkflowDashboard";
import type { AutomationWithDetails, CreateAutomationInput } from "@/lib/workflow-engine/workflow-service";
import { AutomationList } from "./AutomationList";
import { AutomationFormModal } from "./AutomationFormModal";
import { WorkflowDashboardCards } from "./WorkflowDashboardCards";
import { ExecutionHistoryTable } from "./ExecutionHistoryTable";
import { AutomationSelect } from "./AutomationSelect";
import { Button } from "@/components/ui/button";

export function AutomationsAdmin() {
  const { pipelines, isLoading: pipelinesLoading } = usePipelines();
  const activePipelines = pipelines.filter(p => p.is_active);

  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPipelineId && activePipelines.length > 0) {
      setSelectedPipelineId(activePipelines[0].id);
    }
  }, [activePipelines, selectedPipelineId]);

  const {
    automations, isLoading: automationsLoading, error,
    createAutomation, updateAutomation, setAutomationStatus,
    replaceConditions, replaceActions, deleteAutomation,
  } = useCrmAutomations(selectedPipelineId);

  const {
    stats, history, historyTotal, statusFilter, setStatusFilter, page, setPage, refetch: refetchDashboard, clearHistory,
  } = useWorkflowDashboard(selectedPipelineId);

  const [isModalOpen,      setIsModalOpen]      = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<AutomationWithDetails | null>(null);

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId) ?? null;

  function openCreate() {
    setEditingAutomation(null);
    setIsModalOpen(true);
  }

  function openEdit(a: AutomationWithDetails) {
    setEditingAutomation(a);
    setIsModalOpen(true);
  }

  async function handleSave(data: CreateAutomationInput): Promise<boolean> {
    let ok: boolean;
    if (editingAutomation) {
      ok = await updateAutomation(editingAutomation.id, {
        name: data.name, triggerType: data.triggerType, triggerConfig: data.triggerConfig,
        delayType: data.delayType, delayConfig: data.delayConfig,
      });
      if (ok) ok = await replaceConditions(editingAutomation.id, data.conditions);
      if (ok) ok = await replaceActions(editingAutomation.id, data.actions);
    } else {
      ok = await createAutomation(data);
    }
    if (ok) await refetchDashboard();
    return ok;
  }

  async function handleToggle(id: string, status: "ativa" | "pausada"): Promise<boolean> {
    const ok = await setAutomationStatus(id, status);
    if (ok) await refetchDashboard();
    return ok;
  }

  async function handleDelete(id: string): Promise<boolean> {
    const ok = await deleteAutomation(id);
    if (ok) await refetchDashboard();
    return ok;
  }

  if (pipelinesLoading) {
    return (
      <div className="flex items-center gap-2 py-12 px-6" style={{ color: "var(--muted-foreground)" }}>
        <Loader2 size={15} className="animate-spin" />
        <span className="text-sm">Carregando…</span>
      </div>
    );
  }

  if (activePipelines.length === 0) {
    return (
      <div className="flex items-center gap-2 py-12 px-6" style={{ color: "var(--muted-foreground)" }}>
        <AlertCircle size={15} />
        <span className="text-sm">Crie um pipeline em “Pipelines” antes de configurar automações.</span>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 pt-5 pb-10 flex flex-col gap-4 max-w-2xl">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <AutomationSelect
          value={selectedPipelineId ?? ""}
          onChange={setSelectedPipelineId}
          className="min-w-[180px]"
          options={activePipelines.map(p => ({ value: p.id, label: p.name }))}
        />
        <Button
          type="button" onClick={openCreate}
          icon={<Zap size={12} />}
          signature
          size="small"
        >
          Nova Automação
        </Button>
      </div>

      <WorkflowDashboardCards stats={stats} />

      {error ? (
        <div className="flex items-center gap-2 py-6" style={{ color: "#ef4444" }}>
          <AlertCircle size={15} />
          <span className="text-sm">{error}</span>
        </div>
      ) : automationsLoading ? (
        <div className="flex items-center gap-2 py-6" style={{ color: "var(--muted-foreground)" }}>
          <Loader2 size={15} className="animate-spin" />
          <span className="text-sm">Carregando automações…</span>
        </div>
      ) : (
        <AutomationList
          automations={automations}
          onEdit={openEdit}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onCreate={openCreate}
        />
      )}

      <ExecutionHistoryTable
        history={history}
        total={historyTotal}
        page={page}
        onPageChange={setPage}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onClearHistory={clearHistory}
      />

      <AutomationFormModal
        open={isModalOpen}
        pipeline={selectedPipeline}
        automation={editingAutomation}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
