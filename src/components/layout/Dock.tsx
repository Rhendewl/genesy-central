"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  TrendingUp,
  Settings,
  LogOut,
  User,
  Contact,
  NotepadText,
  Calendar,
  KanbanSquare,
  MessagesSquare,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGlobalStore } from "@/store";
import { getSupabaseClient } from "@/lib/supabase";
import { useCurrentMember } from "@/context/CurrentMemberContext";

// Cada item tem uma permKey que referencia os módulos em user_profiles.permissions
const NAV_ITEMS = [
  { href: "/",              label: "Dashboard", icon: LayoutDashboard, exactMatch: true,  permKey: "dashboard" },
  { href: "/workspace",     label: "Workspace", icon: KanbanSquare,    exactMatch: false, permKey: "workspace" },
  { href: "/crm",           label: "CRM",       icon: Users,           exactMatch: false, permKey: "crm" },
  { href: "/conversas",     label: "Conversas", icon: MessagesSquare,  exactMatch: false, permKey: "conversas" },
  { href: "/clientes",      label: "Clientes",  icon: Contact,         exactMatch: false, permKey: "clientes" },
  { href: "/financeiro",    label: "Financeiro",icon: Wallet,          exactMatch: false, permKey: "financeiro" },
  { href: "/trafego",       label: "Tráfego",   icon: TrendingUp,      exactMatch: false, permKey: "trafego" },
  { href: "/formularios",   label: "Formulários", icon: NotepadText,  exactMatch: false, permKey: "formularios" },
  { href: "/agendamentos",  label: "Agenda",      icon: Calendar,  exactMatch: false, permKey: "agendamentos" },
  { href: "/configuracoes", label: "Config",      icon: Settings,  exactMatch: false, permKey: "configuracoes" },
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
            background: "var(--bg-tooltip)",
            border: "1px solid var(--border-tooltip)",
            borderRadius: 8,
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-tooltip)",
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
            width:                38,
            height:               38,
            borderRadius:         12,
            background:           active ? "var(--hover)" : "transparent",
            backdropFilter:       active ? "blur(12px) saturate(140%)" : "none",
            WebkitBackdropFilter: active ? "blur(12px) saturate(140%)" : "none",
            border:               active ? "1px solid var(--glass-border)" : "1px solid transparent",
            boxShadow:            active ? "0 2px 12px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)" : "none",
            transition:           "background 0.2s, border 0.2s, box-shadow 0.2s",
          }}
        >
          {active && (
            <motion.span
              layoutId="sidebar-glow"
              className="absolute inset-0 rounded-[11px]"
              style={{
                background: "radial-gradient(circle at center, var(--hover) 0%, transparent 70%)",
              }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <Icon
            size={17}
            strokeWidth={active ? 2.1 : 1.7}
            style={{
              color: active ? "var(--text-title)" : "var(--icon)",
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

// ─── Botão de troca de tema ───────────────────────────────────────────────────

function DockThemeToggle() {
  const theme = useGlobalStore((s) => s.theme);
  const toggleTheme = useGlobalStore((s) => s.toggleTheme);
  const [hovered, setHovered] = useState(false);
  const isLight = theme === "light";

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
        onClick={toggleTheme}
        aria-label={isLight ? "Mudar para tema escuro" : "Mudar para tema claro"}
        className="flex items-center justify-center"
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
          (e.currentTarget as HTMLElement).style.background = "var(--hover)";
          (e.currentTarget as HTMLElement).style.border = "1px solid var(--glass-border)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.border = "1px solid transparent";
        }}
      >
        {isLight ? (
          <Moon size={17} strokeWidth={1.7} style={{ color: "var(--icon)" }} />
        ) : (
          <Sun size={17} strokeWidth={1.7} style={{ color: "rgba(255,255,255,0.35)" }} />
        )}
      </motion.button>
      <DockTooltip label={isLight ? "Tema escuro" : "Tema claro"} visible={hovered} />
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
          <User size={17} strokeWidth={1.7} className="animate-pulse" style={{ color: "var(--icon)" }} />
        ) : (
          <LogOut size={17} strokeWidth={1.7} style={{ color: "var(--icon)", transition: "color 0.2s" }} />
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

  const { member, isOwner } = useCurrentMember();
  const canvasMode = useGlobalStore((s) => s.canvasMode);

  // useMemo deve ficar ANTES de qualquer early return para não violar a regra dos hooks
  const visibleItems = useMemo(() => {
    if (isOwner === null || isOwner === true) return NAV_ITEMS;
    if (!member || !member.is_active) return NAV_ITEMS.filter((i) => i.permKey === "dashboard");
    const perms = member.permissions;
    return NAV_ITEMS.filter((i) => perms.includes(i.permKey));
  }, [member, isOwner]);

  // Não renderiza nada no modo canvas (editor full-screen)
  if (canvasMode) return null;

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

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
        className="hidden md:flex fixed left-3 top-3 bottom-3 z-50 w-[58px] flex-col items-center rounded-[22px]"
        style={{
          background:           "var(--dock-bg)",
          backdropFilter:       "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border:               "1px solid var(--glass-border)",
          boxShadow:            "var(--dock-shadow)",
        }}
      >
        <div className="flex items-center justify-center pt-5 pb-4 shrink-0">
          <img
            src="/g-cinza.svg"
            alt="Lancaster"
            style={{ width: 26, height: "auto", opacity: 0.75 }}
            draggable={false}
          />
        </div>

        <div style={{ width: 28, height: 1, background: "var(--glass-border)", flexShrink: 0 }} />

        <nav className="flex flex-1 flex-col items-center justify-center gap-1.5 py-4">
          {visibleItems.map((item) => (
            <DockNavItem key={item.href} {...item} pathname={pathname} />
          ))}
        </nav>

        <div style={{ width: 28, height: 1, background: "var(--glass-border)", flexShrink: 0 }} />

        <div className="flex items-center justify-center pb-1.5 shrink-0">
          <DockThemeToggle />
        </div>

        <div className="flex items-center justify-center pt-1.5 pb-5 shrink-0">
          <DockLogoutItem onSignOut={handleSignOut} isSigningOut={isSigningOut} />
        </div>
      </motion.aside>
    </>
  );
}
