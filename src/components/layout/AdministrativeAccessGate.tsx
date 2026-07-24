"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import { isAdministrativeMember } from "@/lib/user-access";

export function AdministrativeAccessGate({ children }: { children: React.ReactNode }) {
  const { member, isOwner, isLoading } = useCurrentMember();

  if (isLoading || isOwner === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
        <div className="h-40 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />
      </div>
    );
  }

  if (!isAdministrativeMember(member, isOwner === true)) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-3 px-4 py-24 text-center sm:px-6">
        <ShieldAlert size={28} style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>Acesso restrito</p>
        <p className="max-w-xs text-xs" style={{ color: "var(--muted-foreground)" }}>
          Esta área está disponível apenas para administradores e sócios.
        </p>
        <Link href="/configuracoes" className="lc-btn mt-2 px-4 py-2 text-sm">
          Voltar às Configurações
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
