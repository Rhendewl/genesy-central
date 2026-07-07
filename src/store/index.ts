import { create } from "zustand";
import type { Theme, PeriodFilter } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Lancaster Global Store (Zustand)
// Keeps only truly global, cross-module UI state.
// Data-fetching state lives in each module's hook (useLeads, useLancamentos, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export const THEME_STORAGE_KEY = "genesy-theme";

// Aplica a classe no <html> e persiste localmente — mesma lógica do script
// anti-flash em app/layout.tsx, chamada aqui em toda troca feita já hidratado.
function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

// Sincroniza a troca com o perfil do usuário (segue a conta entre dispositivos).
// Fire-and-forget: nunca bloqueia a troca visual, que já aconteceu via applyTheme.
function persistThemeToProfile(theme: Theme) {
  fetch("/api/profile/me", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ theme }),
  }).catch(() => {});
}

interface GlobalStore {
  // Canvas mode — esconde o Dock quando o editor de canvas está aberto
  canvasMode: boolean;
  setCanvasMode: (v: boolean) => void;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  // Aplica o tema vindo do perfil (login/troca de dispositivo) sem re-persistir no banco
  hydrateThemeFromProfile: (theme: Theme) => void;

  // Global period filter (dashboard)
  dashboardPeriod: PeriodFilter;
  setDashboardPeriod: (period: PeriodFilter) => void;

  // Loading overlay
  isGlobalLoading: boolean;
  setGlobalLoading: (v: boolean) => void;

  // Active module (for dock highlight)
  activeModule: string;
  setActiveModule: (module: string) => void;

  // Modal depth counter — dock hides when > 0
  modalCount: number;
  openModal: () => void;
  closeModal: () => void;
}

export const useGlobalStore = create<GlobalStore>((set) => ({
  // ── Canvas mode ──
  canvasMode: false,
  setCanvasMode: (v) => set({ canvasMode: v }),

  // ── Theme ──
  theme: getInitialTheme(),
  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
    persistThemeToProfile(theme);
  },
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      persistThemeToProfile(next);
      return { theme: next };
    }),
  hydrateThemeFromProfile: (theme) => {
    set({ theme });
    applyTheme(theme);
  },

  // ── Dashboard period ──
  dashboardPeriod: "mes",
  setDashboardPeriod: (period) => set({ dashboardPeriod: period }),

  // ── Loading ──
  isGlobalLoading: false,
  setGlobalLoading: (v) => set({ isGlobalLoading: v }),

  // ── Active module ──
  activeModule: "/",
  setActiveModule: (module) => set({ activeModule: module }),

  // ── Modal depth ──
  modalCount: 0,
  openModal: () => set((s) => ({ modalCount: s.modalCount + 1 })),
  closeModal: () => set((s) => ({ modalCount: Math.max(0, s.modalCount - 1) })),
}));
