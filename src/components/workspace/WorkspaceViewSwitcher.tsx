"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSegmentIndicator } from "@/components/ui/useSegmentIndicator";

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
  const seg = useSegmentIndicator({ background: "var(--tab-active-bg)" });
  return (
    <div
      ref={seg.trackRef}
      role="group" aria-label="Visualização das tarefas"
      className="workspace-view-switcher relative inline-flex items-center gap-0.5 rounded-full p-0.5"
      style={{ background: "var(--glass-bg-soft)", border: "1px solid var(--border-card)" }}
    >
      {seg.indicator}
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = view === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-label={opt.label}
            title={opt.label}
            aria-pressed={active}
            data-active={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "relative z-[1] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "text-[var(--text-title)]" : "text-[var(--muted-foreground)]"
            )}
          >
            <Icon size={13} />
            <span className="hidden md:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
