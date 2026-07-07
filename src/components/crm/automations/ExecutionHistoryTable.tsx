"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { WorkflowHistoryRow } from "@/hooks/useWorkflowDashboard";

const STATUS_COLORS: Record<string, string> = {
  executada: "#22c55e",
  cancelada: "#7c878e",
  falhou:    "#ef4444",
};

interface ExecutionHistoryTableProps {
  history:      WorkflowHistoryRow[];
  total:        number;
  page:         number;
  onPageChange: (page: number) => void;
  statusFilter: "executada" | "cancelada" | "falhou" | "";
  onStatusFilterChange: (status: "executada" | "cancelada" | "falhou" | "") => void;
}

const PAGE_SIZE = 20;

export function ExecutionHistoryTable({ history, total, page, onPageChange, statusFilter, onStatusFilterChange }: ExecutionHistoryTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>HISTÓRICO</p>
        <select
          value={statusFilter}
          onChange={e => onStatusFilterChange(e.target.value as typeof statusFilter)}
          className="rounded-lg px-2 py-1 text-xs outline-none"
          style={{ background: "var(--hover)", border: "1px solid var(--border)", color: "var(--text-title)" }}
        >
          <option value="">Todos os status</option>
          <option value="executada">Executada</option>
          <option value="cancelada">Cancelada</option>
          <option value="falhou">Falhou</option>
        </select>
      </div>

      {history.length === 0 ? (
        <p className="text-xs py-6 text-center" style={{ color: "var(--muted-foreground)" }}>Nenhuma execução ainda.</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {history.map((row, i) => (
            <div
              key={row.id}
              className="flex items-center gap-3 px-3.5 py-2.5"
              style={{ borderBottom: i < history.length - 1 ? "1px solid var(--border-card)" : undefined }}
            >
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: `${STATUS_COLORS[row.status]}18`, color: STATUS_COLORS[row.status] }}
              >
                {row.status}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs truncate" style={{ color: "var(--text-title)" }}>
                  {row.workflow_automations?.name ?? "—"} · {row.leads?.name ?? "—"}
                </p>
                {row.reason && (
                  <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--muted-foreground)" }}>{row.reason}</p>
                )}
              </div>
              <p className="text-[10px] flex-shrink-0" style={{ color: "var(--text-placeholder)" }}>
                {new Date(row.executed_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}
            className="p-1 rounded-lg hover:bg-[var(--hover)] transition-colors disabled:opacity-30"
            style={{ color: "var(--muted-foreground)" }}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{page} / {totalPages}</span>
          <button
            type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
            className="p-1 rounded-lg hover:bg-[var(--hover)] transition-colors disabled:opacity-30"
            style={{ color: "var(--muted-foreground)" }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
