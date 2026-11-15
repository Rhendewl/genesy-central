"use client";

import { useId, useState, type ReactNode } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";

/** Keep filter controls mounted so collapsing the mobile toolbar preserves drafts. */
export function WorkspaceMobileControls({ title, createLabel, onCreate, active = false, children }: {
  title: string;
  createLabel: string;
  onCreate: () => void;
  active?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="workspace-mobile-tools">
    <div className="mb-2 flex items-center gap-2 md:hidden">
      <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-title)]">{title}</h2>
      <button type="button" aria-label={`Filtros e opções: ${title}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} className={`workspace-mobile-icon ${active ? "is-active" : ""}`}>
        <SlidersHorizontal size={17} />{active && <span className="workspace-mobile-dot" />}
      </button>
      <button type="button" aria-label={createLabel} title={createLabel} onClick={onCreate} className="workspace-mobile-icon workspace-mobile-create"><Plus size={19} /></button>
    </div>
    <div id={id} className={`workspace-mobile-tools-content ${open ? "is-open" : ""}`}>{children}</div>
  </div>;
}
