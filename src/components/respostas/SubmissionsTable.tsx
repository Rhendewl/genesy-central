"use client";

import { useState } from "react";
import { Inbox, Loader2, Trash2, ArrowUp, ArrowDown, ArrowUpDown, ChevronRight } from "lucide-react";
import type { SubmissionListItem } from "@/lib/respostas/types";
import type { FormStep } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ANSWER_TYPES = new Set([
  "name", "short_text", "long_text", "email", "phone", "number",
  "multiple_choice", "single_choice", "rating", "nps_scale", "date", "file_upload",
]);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });
}

function formatAnswer(value: unknown, step: FormStep): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) {
    return value.map(v => {
      const choice = step.choices?.find(c => c.value === v || c.id === v);
      return choice?.label ?? String(v);
    }).filter(Boolean).join(", ") || "—";
  }
  if (typeof value === "object") return JSON.stringify(value);
  if ((step.type === "single_choice" || step.type === "multiple_choice") && step.choices) {
    const choice = step.choices.find(c => c.value === value || c.id === value);
    if (choice) return choice.label;
  }
  if (step.type === "rating" && step.maxRating) return `${value}/${step.maxRating}`;
  if (step.type === "nps_scale") return `${value}/10`;
  if (step.type === "date") {
    try { return new Date(String(value)).toLocaleDateString("pt-BR"); } catch { /* fall through */ }
  }
  const s = String(value);
  return s.length > 80 ? s.slice(0, 78) + "…" : s;
}

function contactKind(step: FormStep): "name" | "phone" | "email" | null {
  if (step.type === "name" || /\bnome\b/i.test(step.title)) return "name";
  if (step.type === "phone" || /whats|telefone|celular|phone/i.test(step.title)) return "phone";
  if (step.type === "email" || /e-?mail/i.test(step.title)) return "email";
  return null;
}

function columnLabel(step: FormStep): string {
  const kind = contactKind(step);
  if (kind === "name") return "Nome";
  if (kind === "phone") return "Telefone";
  if (kind === "email") return "E-mail";
  return step.title;
}

// ── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ field, sortField, sortDir }: {
  field: string; sortField: string; sortDir: "asc" | "desc";
}) {
  if (sortField !== field) return <ArrowUpDown size={11} className="opacity-30" />;
  return sortDir === "asc"
    ? <ArrowUp size={11} style={{ color: "var(--primary)" }} />
    : <ArrowDown size={11} style={{ color: "var(--primary)" }} />;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SubmissionsTableProps {
  submissions:        SubmissionListItem[];
  steps:              FormStep[];
  isLoading:          boolean;
  isFetching:         boolean;
  error:              string | null;
  hasMore:            boolean;
  loadMore:           () => void;
  onOpenDetail:       (id: string) => void;
  selectedIds:        Set<string>;
  onToggleSelect:     (id: string) => void;
  onSelectAll:        () => void;
  onClearSelection:   () => void;
  onDeleteSelected:   () => Promise<void>;
  sortField:          string;
  sortDir:            "asc" | "desc";
  onSort:             (field: string) => void;
}

// ── Empty / Error states ──────────────────────────────────────────────────────

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Inbox size={32} className="mb-3 opacity-20" style={{ color: "var(--muted-foreground)" }} />
      <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>
        Nenhuma resposta encontrada
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
        Publique o formulário e compartilhe o link para receber respostas.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-xl animate-pulse"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        />
      ))}
    </div>
  );
}

// ── Bulk action bar ───────────────────────────────────────────────────────────

function BulkActionBar({ count, onDelete, onClear }: {
  count: number;
  onDelete: () => Promise<void>;
  onClear: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    setConfirm(false);
  };

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl mb-3"
      style={{
        background: "var(--hover)",
        border: "1px solid var(--border)",
      }}
    >
      <span className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
        {count} selecionada{count !== 1 ? "s" : ""}
      </span>

      <div className="flex items-center gap-2">
        <button
          onClick={onClear}
          className="px-2.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-[var(--hover)]"
          style={{ color: "var(--muted-foreground)" }}
        >
          Cancelar
        </button>

        {confirm ? (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#ef4444" }}>
              Excluir {count} resposta{count !== 1 ? "s" : ""}?
            </span>
            <button
              onClick={() => setConfirm(false)}
              disabled={deleting}
              className="px-2.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-[var(--hover)]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Não
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "#ef4444", color: "#fff" }}
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : null}
              Sim, excluir
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
            style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.20)" }}
          >
            <Trash2 size={12} />
            Excluir selecionadas
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SubmissionsTable({
  submissions,
  steps,
  isLoading,
  isFetching,
  error,
  hasMore,
  loadMore,
  onOpenDetail,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  sortField,
  sortDir,
  onSort,
}: SubmissionsTableProps) {
  const answerSteps = steps.filter(s => ANSWER_TYPES.has(s.type));
  const contactSteps = answerSteps.filter(step => contactKind(step));
  const otherSteps = answerSteps.filter(step => !contactKind(step));
  const allSelected = submissions.length > 0 && selectedIds.size === submissions.length;
  const someSelected = selectedIds.size > 0;

  if (isLoading && submissions.length === 0) return <LoadingSkeleton />;
  if (error && submissions.length === 0) {
    return <p className="text-sm py-8" style={{ color: "#ef4444" }}>{error}</p>;
  }
  if (submissions.length === 0) return <Empty />;

  const TH = ({
    field,
    children,
    className = "",
  }: { field: string; children: React.ReactNode; className?: string }) => (
    <th
      onClick={() => onSort(field)}
      className={`text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap ${className}`}
      style={{
        color: sortField === field ? "var(--text-title)" : "var(--muted-foreground)",
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span className="flex items-center gap-1.5">
        {children}
        <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="flex flex-col gap-0">
      {/* Bulk action bar */}
      {someSelected && (
        <BulkActionBar
          count={selectedIds.size}
          onDelete={onDeleteSelected}
          onClear={onClearSelection}
        />
      )}

      {/* ── Desktop table ── */}
      <div
        className="hidden sm:block rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: `${280 + answerSteps.length * 180}px` }}>
            <colgroup>
              <col style={{ width: 44 }} />
              {contactSteps.map(s => (
                <col key={s.id} style={{ width: 180 }} />
              ))}
              <col style={{ width: 148 }} />
              {otherSteps.map(s => (
                <col key={s.id} style={{ width: 180 }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {/* Checkbox header */}
                <th
                  className="px-3 py-2.5"
                  style={{
                    background: "var(--card)",
                    borderBottom: "1px solid var(--border)",
                    width: 44,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                    className="w-3.5 h-3.5 rounded cursor-pointer accent-[var(--primary)]"
                  />
                </th>

                {contactSteps.map(step => (
                  <TH key={step.id} field={step.id}>
                    <span className="truncate max-w-[140px] block">{columnLabel(step)}</span>
                  </TH>
                ))}

                <TH field="created_at">Data</TH>

                {otherSteps.map(step => (
                  <TH key={step.id} field={step.id}>
                    <span className="truncate max-w-[140px] block">{columnLabel(step)}</span>
                  </TH>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, i) => {
                const isLast     = i === submissions.length - 1;
                const isChecked  = selectedIds.has(s.id);

                return (
                  <tr
                    key={s.id}
                    style={{
                      background:   isChecked ? "var(--hover)" : "var(--card)",
                      borderBottom: isLast ? "none" : "1px solid var(--border)",
                      transition:   "background 0.12s",
                    }}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleSelect(s.id)}
                        aria-label={`Selecionar resposta de ${formatDateShort(s.created_at)}`}
                        className="w-3.5 h-3.5 rounded cursor-pointer accent-[var(--primary)]"
                      />
                    </td>

                    {/* Contact columns */}
                    {contactSteps.map(step => {
                      const val = (s.answers as Record<string, unknown>)[step.id];
                      const text = formatAnswer(val, step);
                      return (
                        <td
                          key={step.id}
                          className="px-3 py-3 text-xs cursor-pointer"
                          style={{ color: text === "—" ? "var(--muted-foreground)" : "var(--text-title)", opacity: text === "—" ? 0.4 : 1 }}
                          onClick={() => onOpenDetail(s.id)}
                        >
                          <span className="block truncate max-w-[160px]">{text}</span>
                        </td>
                      );
                    })}

                    {/* Date */}
                    <td
                      className="px-3 py-3 text-xs whitespace-nowrap cursor-pointer hover:underline"
                      style={{ color: "var(--muted-foreground)" }}
                      onClick={() => onOpenDetail(s.id)}
                    >
                      {formatDate(s.created_at)}
                    </td>

                    {/* Remaining answer columns */}
                    {otherSteps.map(step => {
                      const val = (s.answers as Record<string, unknown>)[step.id];
                      const text = formatAnswer(val, step);
                      return (
                        <td
                          key={step.id}
                          className="px-3 py-3 text-xs cursor-pointer"
                          style={{ color: text === "—" ? "var(--muted-foreground)" : "var(--text-title)", opacity: text === "—" ? 0.4 : 1 }}
                          onClick={() => onOpenDetail(s.id)}
                        >
                          <span className="block truncate max-w-[160px]">{text}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile cards ── */}
      <div className="flex flex-col gap-2 sm:hidden">
        {submissions.map(s => {
          const isChecked = selectedIds.has(s.id);
          return (
            <div
              key={s.id}
              className="rounded-xl p-3"
              style={{
                background: isChecked ? "var(--hover)" : "var(--card)",
                border: "1px solid var(--border)",
                transition: "background 0.12s",
              }}
            >
              {/* Top row: checkbox + date + chevron */}
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggleSelect(s.id)}
                  aria-label={`Selecionar resposta de ${formatDateShort(s.created_at)}`}
                  className="w-3.5 h-3.5 rounded flex-shrink-0 accent-[var(--primary)]"
                />
                <span className="flex-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {formatDateShort(s.created_at)}
                </span>
                <button
                  onClick={() => onOpenDetail(s.id)}
                  className="p-1 rounded hover:bg-[var(--hover)] transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Answer rows */}
              {answerSteps.slice(0, 3).map(step => {
                const val  = (s.answers as Record<string, unknown>)[step.id];
                const text = formatAnswer(val, step);
                if (text === "—") return null;
                return (
                  <div key={step.id} className="flex items-start gap-2 mt-1">
                    <span
                      className="text-[10px] min-w-0 truncate flex-shrink-0"
                      style={{ color: "var(--muted-foreground)", maxWidth: "40%" }}
                    >
                      {columnLabel(step)}
                    </span>
                    <span
                      className="text-[11px] truncate flex-1"
                      style={{ color: "var(--text-title)" }}
                    >
                      {text}
                    </span>
                  </div>
                );
              })}
              {answerSteps.length > 3 && (
                <button
                  onClick={() => onOpenDetail(s.id)}
                  className="mt-1.5 text-[10px] hover:underline"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Ver mais {answerSteps.length - 3} campo(s)…
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-3">
          {error ? (
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
              <button
                onClick={loadMore}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <button
              onClick={loadMore}
              disabled={isFetching}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--muted-foreground)",
                opacity: isFetching ? 0.6 : 1,
              }}
            >
              {isFetching ? <Loader2 size={14} className="animate-spin" /> : null}
              {isFetching ? "Carregando…" : "Carregar mais"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
