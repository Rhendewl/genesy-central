"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showLogo?: boolean;
}

export function Header({ title, subtitle, showLogo = false }: HeaderProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex items-center justify-between px-6 pt-6 pb-2"
    >
      {/* Left — Page title */}
      <div>
        {showLogo && (
          <img
            src="/genesy-logo.svg"
            alt="Genesy"
            className="mb-2 h-5 w-auto select-none opacity-75"
            draggable={false}
          />
        )}
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: "var(--text-title)", letterSpacing: "-0.02em" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm" style={{ color: "var(--muted-foreground)" }}>{subtitle}</p>
        )}
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-2">
        {/* Sign out */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 disabled:opacity-50"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--input)",
                  color: "var(--muted-foreground)",
                }}
                aria-label="Sair da conta"
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.35)";
                  (e.currentTarget as HTMLElement).style.color = "#ef4444";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                }}
              />
            }
          >
            {isSigningOut ? (
              <User size={15} className="animate-pulse" />
            ) : (
              <LogOut size={15} />
            )}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="border-[var(--border-tooltip)] bg-[var(--bg-tooltip)] text-[var(--text-tooltip)]">
            Sair
          </TooltipContent>
        </Tooltip>
      </div>
    </motion.header>
  );
}
