"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { FormularioShell } from "../_components/FormularioShell";
import { useRespostas } from "@/hooks/useRespostas";
import { StatsCards } from "@/components/respostas/StatsCards";
import { SubmissionsTable } from "@/components/respostas/SubmissionsTable";
import { FilterBar, type PeriodFilter } from "@/components/respostas/FilterBar";
import { RespostaDrawer } from "@/components/respostas/RespostaDrawer";
import type { Form, FormStep } from "@/types";
import type { SubmissionListItem } from "@/lib/respostas/types";

const ANSWER_TYPES = new Set([
  "name", "short_text", "long_text", "email", "phone", "number",
  "multiple_choice", "single_choice", "rating", "nps_scale", "date", "file_upload",
]);

export default function FormularioRespostasPage() {
  const { id } = useParams<{ id: string }>();

  // ── Form steps ────────────────────────────────────────────────────────────────
  const [steps, setSteps] = useState<FormStep[]>([]);

  useEffect(() => {
    fetch(`/api/formularios/${id}`)
      .then(r => r.json())
      .then((json: { formulario?: Form }) => {
        if (json.formulario?.steps) setSteps(json.formulario.steps);
      })
      .catch(() => {});
  }, [id]);

  // ── Period filter ─────────────────────────────────────────────────────────────
  const [period, setPeriod] = useState<PeriodFilter>({});

  // ── Sort state ────────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState("created_at");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("desc");

  const handleSort = useCallback((field: string) => {
    setSortField(prev => {
      if (prev === field) setSortDir(d => d === "asc" ? "desc" : "asc");
      else { setSortDir("asc"); }
      return field;
    });
  }, []);

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const {
    submissions,
    stats,
    isLoading,
    isFetching,
    error,
    hasMore,
    loadMore,
    markRead,
    toggleStarred,
    archive,
    deleteMany,
  } = useRespostas({
    form_id:   id,
    since:     period.since,
    until:     period.until,
    sort:      sortField === "created_at" ? "created_at" : undefined,
    direction: sortField === "created_at" ? sortDir : undefined,
  });

  // ── Client-side sort for answer columns ───────────────────────────────────────
  const sortedSubmissions = useMemo((): SubmissionListItem[] => {
    if (sortField === "created_at") return submissions;
    return [...submissions].sort((a, b) => {
      const va = String((a.answers as Record<string, unknown>)[sortField] ?? "");
      const vb = String((b.answers as Record<string, unknown>)[sortField] ?? "");
      return sortDir === "asc"
        ? va.localeCompare(vb, "pt-BR")
        : vb.localeCompare(va, "pt-BR");
    });
  }, [submissions, sortField, sortDir]);

  // ── Selection ─────────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggleSelect = useCallback((subId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId);
      else next.add(subId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === submissions.length
        ? new Set()
        : new Set(submissions.map(s => s.id))
    );
  }, [submissions]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const ok  = await deleteMany(ids);
    if (ok) {
      setSelectedIds(new Set());
      toast.success(`${ids.length} resposta${ids.length !== 1 ? "s" : ""} excluída${ids.length !== 1 ? "s" : ""}`);
    } else {
      toast.error("Erro ao excluir respostas");
    }
  }, [selectedIds, deleteMany]);

  // Clear selection when submissions change (filter/sort applied)
  useEffect(() => { setSelectedIds(new Set()); }, [period]);

  // ── Detail drawer ─────────────────────────────────────────────────────────────
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [drawerOpen,  setDrawerOpen]  = useState(false);

  const selectedSubmission = submissions.find(s => s.id === selectedId) ?? null;

  const handleOpenDetail = useCallback((subId: string) => {
    setSelectedId(subId);
    setDrawerOpen(true);
    markRead(subId);
  }, [markRead]);

  const handleMarkRead = useCallback(() => {
    if (selectedId) markRead(selectedId);
  }, [selectedId, markRead]);

  const handleToggleStarred = useCallback((starred: boolean) => {
    if (selectedId) return toggleStarred(selectedId, starred);
  }, [selectedId, toggleStarred]);

  const handleArchive = useCallback(() => {
    if (selectedId) archive(selectedId);
  }, [selectedId, archive]);

  const answerSteps = steps
    .filter(s => ANSWER_TYPES.has(s.type))
    .map((step, index) => ({ step, index }))
    .sort((a, b) => {
      const contactPriority = (step: FormStep) => {
        if (step.type === "name" || /\bnome\b/i.test(step.title)) return 0;
        if (step.type === "phone" || /whats|telefone|celular|phone/i.test(step.title)) return 1;
        if (step.type === "email" || /e-?mail/i.test(step.title)) return 2;
        return 3;
      };
      return contactPriority(a.step) - contactPriority(b.step) || a.index - b.index;
    })
    .map(({ step }) => step);

  return (
    <FormularioShell id={id}>
      <div className="px-4 sm:px-6 pt-4 pb-6 flex flex-col gap-4">

        {/* Stats */}
        {isLoading && submissions.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl h-[72px] animate-pulse"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              />
            ))}
          </div>
        ) : (
          <StatsCards stats={stats} />
        )}

        {/* Period filter */}
        <FilterBar value={period} onChange={setPeriod} />

        {/* Table */}
        <SubmissionsTable
          submissions={sortedSubmissions}
          steps={answerSteps}
          isLoading={isLoading}
          isFetching={isFetching}
          error={error}
          hasMore={hasMore}
          loadMore={loadMore}
          onOpenDetail={handleOpenDetail}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onDeleteSelected={handleDeleteSelected}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </div>

      <RespostaDrawer
        submissionId={selectedId}
        selectedSubmission={selectedSubmission}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onMarkRead={handleMarkRead}
        onToggleStarred={handleToggleStarred}
        onArchive={handleArchive}
      />
    </FormularioShell>
  );
}
