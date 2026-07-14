"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X, Check, Kanban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrmPipelineWithStages } from "@/types/crm";

// ─────────────────────────────────────────────────────────────────────────────
// PipelineFilter
//
// Componente visual puro para seleção de uma ou mais pipelines.
// Não gerencia estado nem persistência — recebe value + onChange externamente.
// Persistência fica em usePipelineFilter().
//
// Segue o padrão visual de PeriodFilter: botão com backdrop blur,
// dropdown animado com lista de opções, close on outside click.
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineFilterProps {
  /** null = todas as pipelines; string[] = IDs selecionados */
  value:     string[] | null;
  onChange:  (ids: string[] | null) => void;
  pipelines: CrmPipelineWithStages[];
}

function buildLabel(value: string[] | null, pipelines: CrmPipelineWithStages[]): string {
  if (value === null || value.length === 0) return "Todas as pipelines";
  if (value.length === 1) {
    const p = pipelines.find(p => p.id === value[0]);
    return p?.name ?? "1 pipeline";
  }
  return `${value.length} pipelines`;
}

export function PipelineFilter({ value, onChange, pipelines }: PipelineFilterProps) {
  const [open, setOpen]     = useState(false);
  const containerRef        = useRef<HTMLDivElement>(null);

  const isActive = value !== null && value.length > 0;
  const label    = buildLabel(value, pipelines);

  // ── Close on outside click ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // ── Interaction handlers ──────────────────────────────────────────────────

  const selectAll = useCallback(() => {
    onChange(null);
    setOpen(false);
  }, [onChange]);

  const togglePipeline = useCallback((id: string) => {
    if (value === null) {
      // saindo de "todas" → seleciona só esta
      onChange([id]);
    } else if (value.includes(id)) {
      // deselecionar
      const next = value.filter(v => v !== id);
      onChange(next.length === 0 ? null : next);
    } else {
      // adicionar à seleção
      onChange([...value, id]);
    }
  }, [value, onChange]);

  const clearFilter = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  }, [onChange]);

  return (
    <div ref={containerRef} className="relative">
      {/* ── Trigger button ──────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-95 select-none",
          isActive ? "text-[var(--text-title)]" : "text-[var(--silver)] hover:text-[var(--text-title)]",
        )}
        style={{
          background:           "var(--glass-bg-soft)",
          backdropFilter:       "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          border: isActive
            ? "1px solid var(--border-card-hover)"
            : "1px solid var(--border-card)",
          transform:            "translateZ(0)",
        }}
      >
        <Kanban size={13} />
        <span className="hidden sm:inline max-w-[160px] truncate">{label}</span>
        <ChevronDown
          size={12}
          className={cn("transition-transform duration-200", open && "rotate-180")}
        />
        {isActive && (
          <span
            onClick={clearFilter}
            className="ml-0.5 rounded-full p-0.5 text-[var(--icon)] hover:text-[var(--text-title)] hover:bg-[var(--hover)] transition-colors"
          >
            <X size={10} />
          </span>
        )}
      </button>

      {/* ── Dropdown panel ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="lc-modal-panel absolute left-0 top-full mt-2 z-40 min-w-[220px] rounded-2xl overflow-hidden"
            style={{
              transformOrigin: "top left",
            }}
          >
            <div className="p-1.5">
              {/* "Todas" option */}
              <button
                onClick={selectAll}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-xl text-sm transition-all flex items-center justify-between gap-2",
                  !isActive
                    ? "text-[var(--text-title)] font-medium"
                    : "text-[var(--silver)] hover:text-[var(--text-title)] hover:bg-[var(--hover)]",
                )}
                style={!isActive ? { background: "var(--hover)" } : {}}
              >
                Todas as pipelines
                {!isActive && <span className="w-1.5 h-1.5 rounded-full bg-[var(--icon)] shrink-0" />}
              </button>

              {/* Individual pipelines */}
              {pipelines.map(p => {
                const isSelected = value !== null && value.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePipeline(p.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl text-sm transition-all flex items-center gap-2",
                      isSelected
                        ? "text-[var(--text-title)] font-medium"
                        : "text-[var(--silver)] hover:text-[var(--text-title)] hover:bg-[var(--hover)]",
                    )}
                    style={isSelected ? { background: "var(--hover)" } : {}}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: p.color }}
                    />
                    <span className="truncate flex-1">{p.name}</span>
                    {isSelected && (
                      <Check size={12} className="text-[var(--icon)] flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
