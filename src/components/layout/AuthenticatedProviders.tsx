"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGlobalStore, THEME_STORAGE_KEY } from "@/store";
import { CurrentMemberProvider, useCurrentMember } from "@/context/CurrentMemberContext";

// Sincroniza o tema salvo no perfil (banco) apenas quando este navegador/
// dispositivo ainda não tem uma preferência local — ou seja, só corrige o
// caso de "logar em um dispositivo novo". Se já existe valor em localStorage,
// a escolha local sempre vence (evita brigar com o toggle manual do usuário).
function ThemeProfileSync() {
  const { member } = useCurrentMember();
  const hydrateThemeFromProfile = useGlobalStore((s) => s.hydrateThemeFromProfile);

  useEffect(() => {
    if (!member) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(THEME_STORAGE_KEY)) return;
    hydrateThemeFromProfile(member.theme);
  }, [member, hydrateThemeFromProfile]);

  return null;
}

export function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  const theme = useGlobalStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
  }, [theme]);

  return (
    <TooltipProvider delay={300}>
      <CurrentMemberProvider>
        <ThemeProfileSync />
        {children}
      </CurrentMemberProvider>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "var(--bg-tooltip)",
            border: "1px solid var(--border-tooltip)",
            color: "var(--text-tooltip)",
          },
        }}
      />
    </TooltipProvider>
  );
}
