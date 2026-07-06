"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LayoutGrid, StickyNote, Calendar, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/workspace",            label: "Dashboard",  icon: LayoutDashboard, exact: true },
  { href: "/workspace/kanban",     label: "Kanban",     icon: LayoutGrid,      exact: false },
  { href: "/workspace/notas",      label: "Notas",      icon: StickyNote,      exact: false },
  { href: "/workspace/calendario", label: "Calendário", icon: Calendar,        exact: false },
  { href: "/workspace/objetivos",  label: "Objetivos",  icon: Target,          exact: false },
];

export function WorkspaceSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 px-4 pt-4 sm:px-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      {SECTIONS.map((section) => {
        const active = section.exact ? pathname === section.href : (pathname?.startsWith(section.href) ?? false);
        const Icon = section.icon;
        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              "flex items-center gap-1.5 px-3 pb-3 text-sm font-medium transition-colors",
              active ? "text-white" : "text-[var(--muted-foreground)] hover:text-white/80"
            )}
            style={{ borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent" }}
          >
            <Icon size={14} />
            {section.label}
          </Link>
        );
      })}
    </div>
  );
}
