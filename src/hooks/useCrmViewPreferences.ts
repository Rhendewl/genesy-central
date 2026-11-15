"use client";

import { useEffect, useState } from "react";

export type CrmView = "kanban" | "list";
export type LeadListColumn = "assignee" | "tags" | "entered_at" | "origin" | "ig" | "value";
export type LeadListSort = "name" | "stage" | "assignee" | "entered_at" | "origin" | "ig" | "value";
export interface CrmViewPreferences {
  view: CrmView;
  columns: LeadListColumn[];
  sort: LeadListSort;
  direction: "asc" | "desc";
}
const defaults: CrmViewPreferences = {
  view: "kanban", columns: ["assignee", "tags", "entered_at", "origin", "value"], sort: "stage", direction: "asc",
};
const PREFERENCES_VERSION = 2;
const columnKeys: LeadListColumn[] = ["assignee", "tags", "entered_at", "origin", "ig", "value"];
const sortKeys: LeadListSort[] = ["name", "stage", "assignee", "entered_at", "origin", "ig", "value"];

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
          value = {
            view: saved.view === "list" ? "list" : "kanban",
            columns: migrate ? columnKeys.filter(column => savedColumns.includes(column) || column === "origin" || column === "value") : savedColumns,
            sort: !migrate && sortKeys.includes(saved.sort) ? saved.sort : defaults.sort,
            direction: !migrate && (saved.direction === "asc" || saved.direction === "desc") ? saved.direction : defaults.direction,
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
