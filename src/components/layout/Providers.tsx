"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGlobalStore } from "@/store";
import { CurrentMemberProvider } from "@/context/CurrentMemberContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useGlobalStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
  }, [theme]);

  return (
    <TooltipProvider delay={300}>
      <CurrentMemberProvider>
        {children}
      </CurrentMemberProvider>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "rgba(18,18,18,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#ffffff",
          },
        }}
      />
    </TooltipProvider>
  );
}
