"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListChecks, StickyNote, Calendar, Rocket, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/workspace/kanban",     label: "Tarefas",     icon: ListChecks,      exact: false },
  { href: "/workspace/objetivos",  label: "Objetivos",   icon: Target,          exact: false },
  { href: "/workspace/notas",      label: "Notas",       icon: StickyNote,      exact: false },
  { href: "/workspace/calendario", label: "Calendário",  icon: Calendar,        exact: false },
  { href: "/workspace/onboarding", label: "Onboarding",  icon: Rocket,          exact: false },
];

interface WorkspaceSubNavProps {
  rightSlot?: React.ReactNode;
}

export function WorkspaceSubNav({ rightSlot }: WorkspaceSubNavProps) {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!scrollerRef.current || !activeLinkRef.current) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeLinkRef.current.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [pathname]);

  return (
    <div
      className="workspace-subnav px-4 pt-4 sm:px-6"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <nav aria-label="Navegação do Workspace" className="flex items-center justify-between gap-2 sm:gap-4">
        <div
          ref={scrollerRef}
          className="min-w-0 flex-1 scroll-px-4 overflow-x-auto overscroll-x-contain sm:scroll-px-0 [&::-webkit-scrollbar]:hidden"
          style={{
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="flex min-w-max items-center gap-1">
            {SECTIONS.map((section) => {
              const active = section.exact ? pathname === section.href : (pathname?.startsWith(section.href) ?? false);
              const Icon = section.icon;
              return (
                <Link
                  ref={active ? activeLinkRef : undefined}
                  key={section.href}
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 px-3 pb-3 text-sm font-medium transition-colors",
                    active ? "text-[var(--text-title)]" : "text-[var(--muted-foreground)] hover:text-[var(--text-title)]"
                  )}
                  style={{ borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent" }}
                >
                  <Icon size={14} />
                  {section.label}
                </Link>
              );
            })}
          </div>
        </div>
        {rightSlot && <div className="shrink-0 pb-3">{rightSlot}</div>}
      </nav>
    </div>
  );
}
