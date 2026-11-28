"use client";

import { useEffect, useState } from "react";

export type CrmView = "kanban" | "list";
export type LeadListColumn = "perfil" | "assignee" | "tags" | "entered_at" | "origin" | "ig" | "value";
export type LeadListSort = "name" | "stage" | "perfil" | "assignee" | "entered_at" | "origin" | "ig" | "value";
export interface CrmViewPreferences {
  view: CrmView;
  columns: LeadListColumn[];
  sort: LeadListSort;
  direction: "asc" | "desc";
}
const defaults: CrmViewPreferences = {
  view: "kanban", columns: ["perfil", "assignee", "tags", "entered_at", "origin", "value"], sort: "stage", direction: "asc",
};
const PREFERENCES_VERSION = 3;
const columnKeys: LeadListColumn[] = ["perfil", "assignee", "tags", "entered_at", "origin", "ig", "value"];
const sortKeys: LeadListSort[] = ["name", "stage", "perfil", "assignee", "entered_at", "origin", "ig", "value"];

export function useCrmViewPreferences(memberId?: string) {
  const key = memberId ? `crm-view:${memberId}` : null;
  const [stored, setStored] = useState<{ key: string | null; value: CrmViewPreferences }>({ key: null, value: defaults });
  const preferences = stored.key === key ? stored.value : defaults;

  useEffect(() => {
    let value = defaults;
    if (key) {
      try {
        const saved = JSON.parse(localStorage.getItem(key) ?? "null");
        if (saved && typeof saved === "object") {
          const savedColumns = Array.isArray(saved.columns) ? columnKeys.filter(column => saved.columns.includes(column)) : defaults.columns;
          const migrate = saved.version !== PREFERENCES_VERSION;
          // v2 → v3 só acrescenta a coluna Perfil; a ordenação escolhida continua.
          const keepSort = !migrate || saved.version === 2;
          value = {
            view: saved.view === "list" ? "list" : "kanban",
            columns: migrate ? columnKeys.filter(column => savedColumns.includes(column) || column === "perfil" || (saved.version !== 2 && (column === "origin" || column === "value"))) : savedColumns,
            sort: keepSort && sortKeys.includes(saved.sort) ? saved.sort : defaults.sort,
            direction: keepSort && (saved.direction === "asc" || saved.direction === "desc") ? saved.direction : defaults.direction,
          };
          if (migrate) localStorage.setItem(key, JSON.stringify({ ...value, version: PREFERENCES_VERSION }));
        }
      } catch { /* Storage may be unavailable; the CRM remains usable. */ }
    }
    setStored({ key, value });
  }, [key]);

  function updatePreferences(patch: Partial<CrmViewPreferences>) {
    const value = { ...preferences, ...patch };
    setStored({ key, value });
    if (key) {
      try { localStorage.setItem(key, JSON.stringify({ ...value, version: PREFERENCES_VERSION })); } catch { /* Keep the session preference. */ }
    }
  }
  return { preferences, updatePreferences };
}
