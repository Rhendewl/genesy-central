"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useWorkspaceObjectives } from "@/hooks/useWorkspaceObjectives";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { ObjectivesGrid } from "@/components/workspace/objectives/ObjectivesGrid";
import { ObjectiveDetailPanel } from "@/components/workspace/objectives/ObjectiveDetailPanel";

import {
  ObjectivesDashboard,
  objectiveStatuses,
} from "@/components/workspace/objectives/ObjectivesDashboard";
import { useTags } from "@/hooks/useTags";
import { useUsers } from "@/hooks/useUsers";

export default function WorkspaceObjetivosPage() {
  const { viewingMember } = useWorkspaceViewing();
  const objectivesHook = useWorkspaceObjectives(
    viewingMember?.auth_user_id ?? undefined,
  );
  const [openObjectiveId, setOpenObjectiveId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const { tags } = useTags("workspace");
  const { profiles } = useUsers();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [horizon, setHorizon] = useState(""),
    [assignee, setAssignee] = useState(""),
    [priority, setPriority] = useState(""),
    [due, setDue] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const filtered = useMemo(
    () =>
      objectivesHook.objectives.filter(
        (o) =>
          (!search ||
            o.title
              .toLocaleLowerCase("pt-BR")
              .includes(search.toLocaleLowerCase("pt-BR"))) &&
          (!status || o.status === status) &&
          (!horizon || o.horizon === horizon) &&
          (!assignee || o.assignee_ids?.includes(assignee)) &&
          (!priority || o.priority === priority) &&
          (!due || (o.due_date && o.due_date <= due)) &&
          tagIds.every((t) => o.tags.includes(t)),
      ),
    [
      objectivesHook.objectives,
      search,
      status,
      horizon,
      assignee,
      priority,
      due,
      tagIds,
    ],
  );
  function openObjective(id: string) {
    setOpenObjectiveId(id);
    setIsPanelOpen(true);
  }

  function openCreate() {
    setOpenObjectiveId(null);
    setIsPanelOpen(true);
  }

  function closePanel() {
    void objectivesHook.refetch();
    setIsPanelOpen(false);
    setOpenObjectiveId(null);
  }

  return (
    <div className="flex flex-col pb-24">
      <Header
        title="Workspace"
        subtitle="Suas metas e o progresso de cada uma"
      />

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
        <div className="mb-4 flex flex-wrap gap-2 [&_select]:rounded-lg [&_select]:border [&_select]:bg-[var(--background)] [&_select]:p-2 [&_select]:text-xs">
          <input
            aria-label="Buscar objetivos"
            placeholder="Buscar objetivos"
            className="rounded-lg border bg-transparent p-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Filtrar status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            {Object.entries(objectiveStatuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar horizonte"
            value={horizon}
            onChange={(e) => setHorizon(e.target.value)}
          >
            <option value="">Todos os horizontes</option>
            <option value="curto">Curto prazo</option>
            <option value="medio">Médio prazo</option>
            <option value="longo">Longo prazo</option>
          </select>
          <select
            aria-label="Filtrar responsável"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">Todos os responsáveis</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar prioridade"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">Todas as prioridades</option>
            {["baixa", "media", "alta", "urgente"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <label className="text-xs">
            Prazo até{" "}
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="rounded-lg border bg-transparent p-2"
            />
          </label>
          <button
            className="text-xs"
            onClick={() => {
              setSearch("");
              setStatus("");
              setHorizon("");
              setAssignee("");
              setPriority("");
              setDue("");
              setTagIds([]);
            }}
          >
            Limpar filtros
          </button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {tags.map((t) => (
            <button
              key={t.id}
              aria-pressed={tagIds.includes(t.id)}
              className="rounded-full border px-3 py-1 text-xs"
              style={{
                borderColor: t.color,
                background: tagIds.includes(t.id) ? t.color + "30" : undefined,
              }}
              onClick={() =>
                setTagIds((ids) =>
                  ids.includes(t.id)
                    ? ids.filter((id) => id !== t.id)
                    : [...ids, t.id],
                )
              }
            >
              {t.name}
            </button>
          ))}
        </div>
        {!objectivesHook.isLoading && !objectivesHook.error && (
          <ObjectivesDashboard objectives={filtered} onOpen={openObjective} />
        )}

        {objectivesHook.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2
              size={24}
              className="animate-spin"
              style={{ color: "var(--muted-foreground)" }}
            />
          </div>
        ) : objectivesHook.error ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-red-400">{objectivesHook.error}</p>
          </div>
        ) : (
          <ObjectivesGrid
            objectives={filtered}
            isLoading={false}
            onOpen={openObjective}
            onToggleStep={objectivesHook.toggleObjectiveStep}
          />
        )}
      </div>

      <AnimatePresence>
        {isPanelOpen && (
          <ObjectiveDetailPanel
            key={openObjectiveId ?? "new"}
            onOpenObjective={openObjective}
            objectiveId={openObjectiveId}
            objectivesHook={objectivesHook}
            onClose={closePanel}
            presentation={openObjectiveId === null ? "modal" : "drawer"}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
