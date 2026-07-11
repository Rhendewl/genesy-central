"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileStack, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/workspace/onboarding",           label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/workspace/onboarding/templates", label: "Templates", icon: FileStack,       exact: false },
  { href: "/workspace/onboarding/equipe",    label: "Equipe",    icon: Users,           exact: false },
];

export function OnboardingSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 px-4 pt-3 sm:px-6">
      {SECTIONS.map((section) => {
        const active = section.exact ? pathname === section.href : (pathname?.startsWith(section.href) ?? false);
        const Icon = section.icon;
        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "text-[var(--text-title)]" : "text-[var(--muted-foreground)] hover:text-[var(--text-title)]"
            )}
            style={{ background: active ? "var(--hover)" : "transparent" }}
          >
            <Icon size={13} />
            {section.label}
          </Link>
        );
      })}
    </div>
  );
}
