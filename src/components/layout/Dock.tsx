"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Wallet,
  TrendingUp,
  Settings,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGlobalStore } from "@/store";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exactMatch: true },
  { href: "/crm", label: "CRM", icon: Users, exactMatch: false },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, exactMatch: false },
  { href: "/trafego", label: "Tráfego", icon: TrendingUp, exactMatch: false },
  { href: "/configuracoes", label: "Config", icon: Settings, exactMatch: false },
];

const dockVariants = {
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    pointerEvents: "auto" as const,
  },
  hidden: {
    y: 18,
    opacity: 0,
    scale: 0.93,
    pointerEvents: "none" as const,
  },
};

export function Dock() {
  const pathname = usePathname();
  const isModalOpen = useGlobalStore((s) => s.modalCount > 0);

  function isActive(href: string, exactMatch: boolean) {
    if (exactMatch) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <motion.nav
        initial="visible"
        animate={isModalOpen ? "hidden" : "visible"}
        variants={dockVariants}
        transition={{
          duration: isModalOpen ? 0.28 : 0.46,
          ease: isModalOpen
            ? [0.4, 0, 1, 1]
            : [0.34, 1.56, 0.64, 1],
        }}
        aria-label="Navegação principal"
        className="pointer-events-auto"
      >
        <div
          className="flex items-center gap-0.5 rounded-full px-2 py-1.5"
          style={{
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            background: "rgba(0, 0, 0, 0.22)",
            border: "none",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.45), 0 1px 0 rgba(255,255,255,0.04) inset",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.exactMatch);
            const Icon = item.icon;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={<span />}>
                  <Link href={item.href} className="block">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.93 }}
                      transition={{ duration: 0.18 }}
                      className={cn(
                        "relative flex flex-col items-center gap-1 rounded-full px-4 py-2.5 transition-all duration-200",
                        active
                          ? "bg-[rgba(255,255,255,0.07)]"
                          : "hover:bg-[rgba(255,255,255,0.04)]"
                      )}
                    >
                      <Icon
                        size={19}
                        strokeWidth={active ? 2.25 : 1.75}
                        style={{ color: active ? "#ffffff" : "rgba(255,255,255,0.4)" }}
                      />

                      <span
                        className={cn(
                          "hidden text-[10px] leading-none sm:block font-medium",
                          active ? "text-white" : "text-white/40"
                        )}
                      >
                        {item.label}
                      </span>

                      {active && (
                        <motion.span
                          layoutId="dock-active-dot"
                          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full"
                          style={{
                            width: 4,
                            height: 4,
                            backgroundColor: "rgba(255,255,255,0.55)",
                          }}
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </motion.div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="border-[var(--border-tooltip)] bg-[var(--bg-tooltip)] text-[var(--text-tooltip)]"
                >
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </motion.nav>
    </div>
  );
}
