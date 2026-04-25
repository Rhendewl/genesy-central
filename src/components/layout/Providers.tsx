"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGlobalStore } from "@/store";

// ─────────────────────────────────────────────────────────────────────────────
// Providers — wraps the entire app with all necessary context providers
// ─────────────────────────────────────────────────────────────────────────────

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useGlobalStore((s) => s.theme);

  // Apply theme class to <html> on mount and on change
  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
  }, [theme]);

  return (
    <TooltipProvider delay={300}>
      {children}
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "rgba(18,18,18,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#ffffff",
            backdropFilter: "blur(12px)",
          },
        }}
      />
    </TooltipProvider>
  );
}
