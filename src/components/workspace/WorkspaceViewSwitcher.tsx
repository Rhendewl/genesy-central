"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceView = "kanban" | "lista";

interface WorkspaceViewSwitcherProps {
  view:     WorkspaceView;
  onChange: (view: WorkspaceView) => void;
}

const OPTIONS: { id: WorkspaceView; label: string; icon: typeof LayoutGrid }[] = [
  { id: "kanban", label: "Kanban", icon: LayoutGrid },
  { id: "lista",  label: "Lista",  icon: List },
];

export function WorkspaceViewSwitcher({ view, onChange }: WorkspaceViewSwitcherProps) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full p-0.5"
      style={{ background: "var(--glass-bg-soft)", border: "1px solid var(--border-card)" }}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = view === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "text-[var(--text-title)]" : "text-[var(--muted-foreground)]"
            )}
            style={{ background: active ? "var(--tab-active-bg)" : "transparent" }}
          >
            <Icon size={13} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
