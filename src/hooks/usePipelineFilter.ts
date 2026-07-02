"use client";

import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// usePipelineFilter
//
// Gerencia a seleção de pipelines para a aba Analytics:
//   null        → todas as pipelines (padrão)
//   string[]    → IDs específicos selecionados (um ou mais)
//
// Persistência: sessionStorage com chave crm_analytics_pipeline_ids.
// O componente visual (PipelineFilter) recebe apenas value + onChange —
// toda a lógica de persistência fica aqui.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "crm_analytics_pipeline_ids";

function load(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as string[];
  } catch {}
  return null;
}

function save(value: string[] | null): void {
  try {
    if (value === null) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {}
}

export interface PipelineFilterHook {
  value:    string[] | null;
  onChange: (ids: string[] | null) => void;
}

export function usePipelineFilter(): PipelineFilterHook {
  const [selectedIds, setSelectedIds] = useState<string[] | null>(() => load());

  const onChange = (ids: string[] | null) => {
    const normalized = ids !== null && ids.length === 0 ? null : ids;
    setSelectedIds(normalized);
    save(normalized);
  };

  return { value: selectedIds, onChange };
}
