import { create } from "zustand";
import type { Theme, PeriodFilter } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Lancaster Global Store (Zustand)
// Keeps only truly global, cross-module UI state.
// Data-fetching state lives in each module's hook (useLeads, useLancamentos, etc.)
// ─────────────────────────────────────────────────────────────────────────────

interface GlobalStore {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

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
  // ── Theme ──
  theme: "dark",
  setTheme: (theme) => {
    set({ theme });
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(theme);
    }
  },
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add(next);
      }
      return { theme: next };
    }),

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
