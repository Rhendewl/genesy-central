"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  TrendingUp,
  Settings,
  LogOut,
  User,
  Contact,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGlobalStore } from "@/store";
import { getSupabaseClient } from "@/lib/supabase";

const NAV_ITEMS = [
  { href: "/",          label: "Dashboard", icon: LayoutDashboard, exactMatch: true },
  { href: "/crm",       label: "CRM",       icon: Users,           exactMatch: false },
  { href: "/clientes",  label: "Clientes",  icon: Contact,         exactMatch: false },
  { href: "/financeiro",label: "Financeiro",icon: Wallet,          exactMatch: false },
  { href: "/trafego",   label: "Tráfego",   icon: TrendingUp,      exactMatch: false },
  { href: "/configuracoes", label: "Config",icon: Settings,        exactMatch: false },
];

// ─── Tooltip flutuante ────────────────────────────────────────────────────────

function DockTooltip({ label, visible }: { label: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-[60] whitespace-nowrap"
          style={{
            background: "rgba(10,10,12,0.88)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 8,
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 500,
            color: "rgba(255,255,255,0.82)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Item de navegação ────────────────────────────────────────────────────────

function DockNavItem({
  href,
  label,
  icon: Icon,
  exactMatch,
  pathname,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  exactMatch: boolean;
  pathname: string;
}) {
  const [hovered, setHovered] = useState(false);
  const active = exactMatch ? pathname === href : pathname.startsWith(href);

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={href} className="block">
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.91 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="relative flex items-center justify-center"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: active ? "rgba(255,255,255,0.09)" : "transparent",
            border: active ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
            boxShadow: active ? "0 0 18px rgba(255,255,255,0.05)" : "none",
            transition: "background 0.2s, border 0.2s, box-shadow 0.2s",
          }}
        >
          {active && (
            <motion.span
              layoutId="sidebar-glow"
              className="absolute inset-0 rounded-[11px]"
              style={{
                background: "radial-gradient(circle at center, rgba(255,255,255,0.07) 0%, transparent 70%)",
              }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <Icon
            size={17}
            strokeWidth={active ? 2.1 : 1.7}
            style={{
              color: active ? "#ffffff" : "rgba(255,255,255,0.38)",
              transition: "color 0.2s",
              position: "relative",
              zIndex: 1,
            }}
          />
        </motion.div>
      </Link>
      <DockTooltip label={label} visible={hovered} />
    </div>
  );
}

// ─── Botão de logout ──────────────────────────────────────────────────────────

function DockLogoutItem({
  onSignOut,
  isSigningOut,
}: {
  onSignOut: () => void;
  isSigningOut: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.91 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        onClick={onSignOut}
        disabled={isSigningOut}
        aria-label="Sair da conta"
        className="flex items-center justify-center disabled:opacity-40"
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: "transparent",
          border: "1px solid transparent",
          cursor: "pointer",
          transition: "background 0.2s, border 0.2s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.09)";
          (e.currentTarget as HTMLElement).style.border = "1px solid rgba(239,68,68,0.15)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.border = "1px solid transparent";
        }}
      >
        {isSigningOut ? (
          <User size={17} strokeWidth={1.7} className="animate-pulse" style={{ color: "rgba(255,255,255,0.35)" }} />
        ) : (
          <LogOut size={17} strokeWidth={1.7} style={{ color: "rgba(255,255,255,0.35)", transition: "color 0.2s" }} />
        )}
      </motion.button>
      <DockTooltip label="Sair" visible={hovered} />
    </div>
  );
}

// ─── Dock ─────────────────────────────────────────────────────────────────────

export function Dock() {
  const pathname = usePathname();
  const router = useRouter();
  const isModalOpen = useGlobalStore((s) => s.modalCount > 0);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  // Mobile bottom dock — mantido igual ao original
  const mobileTransition = {
    duration: isModalOpen ? 0.28 : 0.46,
    ease: isModalOpen
      ? ([0.4, 0, 1, 1] as [number, number, number, number])
      : ([0.34, 1.56, 0.64, 1] as [number, number, number, number]),
  };

  return (
    <>
      {/* ── Desktop: dock flutuante ───────────────────────────────── */}
      <motion.aside
        initial={{ x: 0, opacity: 1 }}
        animate={
          isModalOpen
            ? { x: -12, opacity: 0, pointerEvents: "none" as const }
            : { x: 0, opacity: 1, pointerEvents: "auto" as const }
        }
        transition={{ duration: isModalOpen ? 0.24 : 0.4, ease: isModalOpen ? "easeIn" : "easeOut" }}
        aria-label="Navegação principal"
        className="hidden lg:flex fixed left-3 top-3 bottom-3 z-50 w-[58px] flex-col items-center rounded-[22px]"
        style={{
          background: "rgba(0, 0, 0, 0.07)",
          border: "1px solid rgba(255, 255, 255, 0.07)",
          boxShadow:
            "0 8px 48px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo — limpa, sem card */}
        <div className="flex items-center justify-center pt-5 pb-4 shrink-0">
          <img
            src="/g-cinza.svg"
            alt="Lancaster"
            style={{ width: 26, height: "auto", opacity: 0.75 }}
            draggable={false}
          />
        </div>

        {/* Divisor */}
        <div style={{ width: 28, height: 1, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

        {/* Nav items */}
        <nav className="flex flex-1 flex-col items-center justify-center gap-1.5 py-4">
          {NAV_ITEMS.map((item) => (
            <DockNavItem key={item.href} {...item} pathname={pathname} />
          ))}
        </nav>

        {/* Divisor */}
        <div style={{ width: 28, height: 1, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

        {/* Logout */}
        <div className="flex items-center justify-center pt-4 pb-5 shrink-0">
          <DockLogoutItem onSignOut={handleSignOut} isSigningOut={isSigningOut} />
        </div>
      </motion.aside>

      {/* ── Mobile: dock central no rodapé ───────────────────────── */}
      <div className="lg:hidden fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <motion.nav
          initial={{ y: 0, opacity: 1, scale: 1 }}
          animate={
            isModalOpen
              ? { y: 18, opacity: 0, scale: 0.93, pointerEvents: "none" as const }
              : { y: 0, opacity: 1, scale: 1, pointerEvents: "auto" as const }
          }
          transition={mobileTransition}
          aria-label="Navegação principal"
          className="pointer-events-auto"
        >
          <div
            className="flex items-center gap-0.5 rounded-full px-2 py-1.5"
            style={{
              background: "rgba(0, 0, 0, 0.22)",
              border: "none",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.45), 0 1px 0 rgba(255,255,255,0.04) inset",
            }}
          >
            {NAV_ITEMS.map((item) => {
              const active = item.exactMatch
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href} className="block">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.93 }}
                    transition={{ duration: 0.18 }}
                    className={cn(
                      "relative flex flex-col items-center gap-1 rounded-full px-4 py-2.5 transition-all duration-200",
                      active ? "bg-[rgba(255,255,255,0.07)]" : "hover:bg-[rgba(255,255,255,0.04)]"
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
                        style={{ width: 4, height: 4, backgroundColor: "rgba(255,255,255,0.55)" }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </motion.nav>
      </div>
    </>
  );
}
