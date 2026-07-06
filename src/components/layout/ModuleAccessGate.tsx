"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useModuleAccess } from "@/hooks/useModuleAccess";

interface ModuleAccessGateProps {
  module:   string;
  children: React.ReactNode;
}

// Bloqueia o acesso direto (via URL) a uma página cujo módulo o usuário não
// tem habilitado em suas permissões — hoje só o menu escondia o link, o que
// nunca impediu digitar a URL direto.
export function ModuleAccessGate({ module, children }: ModuleAccessGateProps) {
  const { hasAccess, isLoading } = useModuleAccess(module);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
        <div className="h-40 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 px-4 py-24 text-center sm:px-6">
        <ShieldAlert size={28} style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>Acesso restrito</p>
        <p className="max-w-xs text-xs" style={{ color: "var(--muted-foreground)" }}>
          Você não tem permissão para acessar este módulo.
        </p>
        <Link href="/" className="lc-btn mt-2 px-4 py-2 text-sm">
          Voltar ao Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
