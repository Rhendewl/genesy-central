"use client";

import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeDollarSign, CalendarDays, LayoutDashboard } from "lucide-react";
import { InstagramGlyph } from "@/components/marketing/InstagramReports";
import { cn } from "@/lib/utils";

function MetaGlyph({ size = 16, ...props }: SVGProps<SVGSVGElement> & { size?: string | number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 21" fill="none" aria-hidden="true" {...props}>
      <path
        d="M2.1 16.8C3.8 10.1 7.3 2.2 11.5 2.2c3.1 0 5.3 3.7 7.5 7.3 2 3.3 4 6.6 6.5 6.6 2.1 0 3.7-2.4 4.4-4.7M29.9 4.2c-1.1-1.3-2.4-2-4-2-4.5 0-7.8 7.6-10 12-1.5 3-2.8 5.1-4.7 5.1-2.7 0-4.4-3.5-6.1-6.8"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type NavIcon = ComponentType<{ size?: string | number; className?: string }>;

const ITEMS: Array<{ href: string; label: string; icon: NavIcon; exact?: boolean }> = [
  { href: "/marketing", label: "Visão Geral", icon: LayoutDashboard, exact: true },
  { href: "/marketing/relatorios", label: "Instagram", icon: InstagramGlyph },
  { href: "/marketing/calendario", label: "Calendário Editorial", icon: CalendarDays },
  { href: "/marketing/trafego", label: "Tráfego Pago", icon: MetaGlyph },
  { href: "/marketing/vgv", label: "VGV", icon: BadgeDollarSign },
];

export function MarketingSubNav() {
  const pathname = usePathname();
  return (
    <div className="border-b px-4 pt-3 sm:px-6 sm:pt-4" style={{ borderColor: "var(--border)" }}>
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <nav className="flex min-w-max gap-1">
          {ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 px-3 pb-2 pt-1 text-sm font-medium transition-colors sm:min-h-0 sm:pb-3 sm:pt-0",
                  active ? "text-[var(--text-title)]" : "text-[var(--muted-foreground)] hover:text-[var(--text-title)]",
                )}
                style={{ borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent" }}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
