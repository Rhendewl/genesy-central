"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
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
  X,
  Sun,
  Moon,
} from "lucide-react";
import { useGlobalStore } from "@/store";
import { getSupabaseClient } from "@/lib/supabase";
import { useCurrentMember } from "@/context/CurrentMemberContext";

// ─── Nav items ────────────────────────────────────────────────────────────────

type NavItem = {
  href:       string;
  label:      string;
  icon:       React.ElementType;
  exactMatch: boolean;
  permKey:    string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/",              label: "Dashboard",    icon: LayoutDashboard, exactMatch: true,  permKey: "dashboard"    },
  { href: "/workspace",     label: "Workspace",    icon: KanbanSquare,    exactMatch: false, permKey: "workspace"    },
  { href: "/crm",           label: "CRM",          icon: Users,           exactMatch: false, permKey: "crm"          },
  { href: "/conversas",     label: "Conversas",    icon: MessagesSquare,  exactMatch: false, permKey: "conversas"    },
  { href: "/clientes",      label: "Clientes",     icon: Contact,         exactMatch: false, permKey: "clientes"     },
  { href: "/financeiro",    label: "Financeiro",   icon: Wallet,          exactMatch: false, permKey: "financeiro"   },
  { href: "/trafego",       label: "Tráfego",      icon: TrendingUp,      exactMatch: false, permKey: "trafego"      },
  { href: "/formularios",   label: "Formulários",  icon: NotepadText,     exactMatch: false, permKey: "formularios"  },
  { href: "/agendamentos",  label: "Agenda",       icon: Calendar,        exactMatch: false, permKey: "agendamentos" },
  { href: "/configuracoes", label: "Configurações",icon: Settings,        exactMatch: false, permKey: "configuracoes"},
];

// ─── Animation variants ───────────────────────────────────────────────────────

// iOS-like cubic-bezier easings (typed as BezierDefinition)
const IOS_SPRING   = [0.32, 0.72, 0, 1]   as [number, number, number, number];
const IOS_EASE_OUT = [0.4,  0,    0.8, 0.4] as [number, number, number, number];

const overlayVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1,  transition: { duration: 0.26, ease: "easeOut" as const } },
  exit:    { opacity: 0,  transition: { duration: 0.20, ease: "easeIn"  as const, delay: 0.07 } },
};

const sidebarVariants: Variants = {
  hidden:  { x: "-100%" },
  visible: { x: 0,       transition: { duration: 0.30, ease: IOS_SPRING } },
  exit:    { x: "-100%", transition: { duration: 0.24, ease: IOS_EASE_OUT, delay: 0.04 } },
};

const navContainerVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.038, delayChildren: 0.14 } },
  exit:    { opacity: 0, transition: { duration: 0.10 } },
};

const navItemVariants: Variants = {
  hidden:  { opacity: 0, x: -14 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.22, ease: IOS_SPRING } },
  exit:    { opacity: 0, x: -8, transition: { duration: 0.10 } },
};

// ─── HamburgerIcon ────────────────────────────────────────────────────────────

function HamburgerIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <div
      className="relative"
      style={{ width: 20, height: 14 }}
      aria-hidden="true"
    >
      <motion.span
        className="absolute left-0 right-0 rounded-full"
        style={{ top: 0, height: 1.5, backgroundColor: "color-mix(in srgb, var(--text-title) 88%, transparent)", transformOrigin: "center" }}
        animate={isOpen ? { y: 6.25, rotate: 45 } : { y: 0, rotate: 0 }}
        transition={{ duration: 0.24, ease: IOS_SPRING as [number, number, number, number] }}
      />
      <motion.span
        className="absolute left-0 rounded-full"
        style={{ top: "50%", marginTop: "-0.75px", height: 1.5, width: 13, backgroundColor: "color-mix(in srgb, var(--text-title) 50%, transparent)" }}
        animate={isOpen ? { opacity: 0, x: -4 } : { opacity: 1, x: 0 }}
        transition={{ duration: 0.14 }}
      />
      <motion.span
        className="absolute left-0 right-0 rounded-full"
        style={{ bottom: 0, height: 1.5, backgroundColor: "color-mix(in srgb, var(--text-title) 88%, transparent)", transformOrigin: "center" }}
        animate={isOpen ? { y: -6.25, rotate: -45 } : { y: 0, rotate: 0 }}
        transition={{ duration: 0.24, ease: IOS_SPRING as [number, number, number, number] }}
      />
    </div>
  );
}

// ─── NavigationItem ───────────────────────────────────────────────────────────

interface NavigationItemProps {
  href:       string;
  label:      string;
  icon:       React.ElementType;
  exactMatch: boolean;
  pathname:   string;
  onNavigate: () => void;
}

function NavigationItem({ href, label, icon: Icon, exactMatch, pathname, onNavigate }: NavigationItemProps) {
  const active = exactMatch ? pathname === href : pathname.startsWith(href);

  return (
    <motion.div variants={navItemVariants}>
      <Link
        href={href}
        onClick={onNavigate}
        className="block rounded-2xl outline-none focus-visible:ring-1 focus-visible:ring-white/20"
        aria-current={active ? "page" : undefined}
      >
        <div
          className="relative flex items-center gap-3.5 px-4 rounded-2xl transition-all duration-200 active:scale-[0.97] border"
          style={{
            minHeight:   54,
            background:  active ? "var(--hover)" : "transparent",
            borderColor: active ? "var(--glass-border)" : "transparent",
            ...(active ? {
              boxShadow: "0 2px 14px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.07)",
            } : undefined),
          }}
        >
          {active && (
            <span
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{ background: "radial-gradient(circle at 28% 50%, var(--hover) 0%, transparent 70%)" }}
              aria-hidden="true"
            />
          )}
          <Icon
            size={19}
            strokeWidth={active ? 2.1 : 1.7}
            style={{
              color:     active ? "var(--text-title)" : "var(--icon)",
              flexShrink: 0,
              position:  "relative",
              zIndex:    1,
            }}
          />
          <span
            className="text-[14px] font-medium leading-none"
            style={{
              color:    active ? "var(--text-title)" : "var(--text-body)",
              position: "relative",
              zIndex:   1,
            }}
          >
            {label}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── ThemeToggleRow ───────────────────────────────────────────────────────────

function ThemeToggleRow() {
  const theme = useGlobalStore((s) => s.theme);
  const toggleTheme = useGlobalStore((s) => s.toggleTheme);
  const isLight = theme === "light";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isLight ? "Mudar para tema escuro" : "Mudar para tema claro"}
      className="flex items-center gap-3.5 w-full px-4 rounded-2xl transition-all duration-200 active:scale-[0.97] mb-0.5"
      style={{
        minHeight:  54,
        border:     "1px solid transparent",
        color:      "var(--icon)",
        background: "transparent",
        cursor:     "pointer",
      }}
      onMouseEnter={e => {
        const t = e.currentTarget;
        t.style.background  = "var(--hover)";
        t.style.borderColor = "var(--glass-border)";
      }}
      onMouseLeave={e => {
        const t = e.currentTarget;
        t.style.background   = "transparent";
        t.style.borderColor  = "transparent";
      }}
    >
      {isLight
        ? <Moon size={19} strokeWidth={1.7} style={{ flexShrink: 0 }} />
        : <Sun  size={19} strokeWidth={1.7} style={{ flexShrink: 0 }} />
      }
      <span className="text-[14px] font-medium leading-none">
        {isLight ? "Tema escuro" : "Tema claro"}
      </span>
    </button>
  );
}

// ─── NavigationOverlay ────────────────────────────────────────────────────────

function NavigationOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="nav-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="md:hidden fixed inset-0 z-[90] backdrop-blur-[3px]"
          style={{ background: "rgba(0,0,0,0.52)" }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </AnimatePresence>
  );
}

// ─── MobileHeader ─────────────────────────────────────────────────────────────

interface MobileHeaderProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

function MobileHeader({ isOpen, onOpen, onClose }: MobileHeaderProps) {
  return (
    <div
      className="md:hidden fixed left-0 right-0 z-[80] px-4"
      style={{ top: 0, paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
    >
      <header
        className="flex items-center justify-between w-full h-14 px-4 rounded-[22px]"
        style={{
          background:           "var(--dock-bg)",
          backdropFilter:       "blur(30px) saturate(170%)",
          WebkitBackdropFilter: "blur(30px) saturate(170%)",
          border:               "1px solid var(--glass-border)",
          boxShadow:            "var(--dock-shadow)",
        }}
      >
        {/* Hamburger button */}
        <button
          onClick={isOpen ? onClose : onOpen}
          aria-label={isOpen ? "Fechar menu" : "Abrir menu de navegação"}
          aria-expanded={isOpen}
          aria-controls="mobile-sidebar"
          className="flex items-center justify-center rounded-xl transition-colors duration-150 active:scale-90"
          style={{
            width:       40,
            height:      40,
            flexShrink:  0,
            background:  isOpen ? "var(--hover)" : "transparent",
            border:      "1px solid",
            borderColor: isOpen ? "var(--glass-border)" : "transparent",
          }}
        >
          <HamburgerIcon isOpen={isOpen} />
        </button>

        {/* Logomarca */}
        <img
          src="/genesy-logoname.svg"
          alt="Genesy"
          draggable={false}
          style={{ height: 22, width: "auto", opacity: 0.88 }}
        />
      </header>
    </div>
  );
}

// ─── MobileSidebar ────────────────────────────────────────────────────────────

interface MobileSidebarProps {
  isOpen:       boolean;
  onClose:      () => void;
  visibleItems: NavItem[];
  pathname:     string;
  isSigningOut: boolean;
  onSignOut:    () => void;
}

function MobileSidebar({
  isOpen,
  onClose,
  visibleItems,
  pathname,
  isSigningOut,
  onSignOut,
}: MobileSidebarProps) {
  const sidebarRef  = useRef<HTMLElement>(null);
  const touchStartX = useRef(0);

  // Focus trap + ESC
  useEffect(() => {
    if (!isOpen || !sidebarRef.current) return;
    const el = sidebarRef.current;

    const focusables = Array.from(
      el.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    }

    document.addEventListener("keydown", onKey);
    setTimeout(() => first?.focus(), 60);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Android back button
  useEffect(() => {
    if (!isOpen) return;
    window.history.pushState(null, "", window.location.href);
    function onPop() { onClose(); }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isOpen, onClose]);

  // Swipe-left to close
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 56) onClose();
  }

  return (
    <>
      <NavigationOverlay isOpen={isOpen} onClose={onClose} />

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="mobile-sidebar"
            ref={sidebarRef}
            id="mobile-sidebar"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="md:hidden fixed left-0 top-0 bottom-0 z-[100] flex flex-col"
            style={{
              width:                "min(82vw, 340px)",
              background:           "var(--dock-bg)",
              backdropFilter:       "blur(48px) saturate(200%)",
              WebkitBackdropFilter: "blur(48px) saturate(200%)",
              borderRight:          "1px solid var(--glass-border)",
              boxShadow:            "var(--dock-shadow)",
            }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* Sidebar header */}
            <div
              className="flex items-center justify-between px-5 flex-shrink-0"
              style={{
                paddingTop:    "calc(env(safe-area-inset-top, 0px) + 1.25rem)",
                paddingBottom: "1rem",
                borderBottom:  "1px solid var(--glass-border)",
              }}
            >
              <img
                src="/genesy-logoname.svg"
                alt="Genesy"
                draggable={false}
                style={{ height: 20, width: "auto", opacity: 0.82 }}
              />
              <button
                onClick={onClose}
                aria-label="Fechar menu"
                className="flex items-center justify-center rounded-xl transition-all active:scale-90"
                style={{
                  width:       36,
                  height:      36,
                  flexShrink:  0,
                  background:  "var(--hover)",
                  border:      "1px solid var(--glass-border)",
                  color:       "var(--icon)",
                  cursor:      "pointer",
                }}
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            </div>

            {/* Nav items — scrollable */}
            <motion.nav
              variants={navContainerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0.5"
              aria-label="Módulos da plataforma"
            >
              {visibleItems.map((item) => (
                <NavigationItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  exactMatch={item.exactMatch}
                  pathname={pathname}
                  onNavigate={onClose}
                />
              ))}
            </motion.nav>

            {/* Footer — tema + logout */}
            <div
              className="flex-shrink-0 px-3"
              style={{
                paddingTop:    "0.75rem",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
                borderTop:     "1px solid var(--glass-border)",
              }}
            >
              <ThemeToggleRow />
              <button
                onClick={onSignOut}
                disabled={isSigningOut}
                aria-label="Sair da conta"
                className="flex items-center gap-3.5 w-full px-4 rounded-2xl transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                style={{
                  minHeight:  54,
                  border:     "1px solid transparent",
                  color:      "var(--icon)",
                  background: "transparent",
                  cursor:     "pointer",
                }}
                onMouseEnter={e => {
                  const t = e.currentTarget;
                  t.style.background   = "rgba(239,68,68,0.07)";
                  t.style.borderColor  = "rgba(239,68,68,0.11)";
                  t.style.color        = "rgba(239,68,68,0.78)";
                }}
                onMouseLeave={e => {
                  const t = e.currentTarget;
                  t.style.background   = "transparent";
                  t.style.borderColor  = "transparent";
                  t.style.color        = "var(--icon)";
                }}
              >
                {isSigningOut
                  ? <User   size={19} strokeWidth={1.7} style={{ flexShrink: 0 }} className="animate-pulse" />
                  : <LogOut size={19} strokeWidth={1.7} style={{ flexShrink: 0 }} />
                }
                <span className="text-[14px] font-medium leading-none">Sair da conta</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── MobileNavigation ─────────────────────────────────────────────────────────

export function MobileNavigation() {
  const pathname   = usePathname();
  const router     = useRouter();
  const canvasMode = useGlobalStore((s) => s.canvasMode);

  const [isOpen,       setIsOpen]       = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const { member, isOwner } = useCurrentMember();

  const open  = useCallback(() => setIsOpen(true),  []);
  const close = useCallback(() => setIsOpen(false), []);

  // Auto-close on route change
  useEffect(() => { close(); }, [pathname, close]);

  const visibleItems = useMemo<NavItem[]>(() => {
    if (isOwner === null || isOwner === true) return NAV_ITEMS;
    if (!member || !member.is_active) return NAV_ITEMS.filter(i => i.permKey === "dashboard");
    const perms = member.permissions;
    return NAV_ITEMS.filter(i => perms.includes(i.permKey));
  }, [member, isOwner]);

  if (canvasMode) return null;

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    close();
    router.push("/auth");
    router.refresh();
  }

  return (
    <>
      <MobileHeader isOpen={isOpen} onOpen={open} onClose={close} />
      <MobileSidebar
        isOpen={isOpen}
        onClose={close}
        visibleItems={visibleItems}
        pathname={pathname ?? "/"}
        isSigningOut={isSigningOut}
        onSignOut={handleSignOut}
      />
    </>
  );
}
