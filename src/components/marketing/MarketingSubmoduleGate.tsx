"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useMarketingAccess } from "@/hooks/useMarketingAccess";
import { marketingPermissionForPath } from "@/lib/module-permissions";

// Bloqueia submódulos do Marketing não liberados ao membro e leva para o
// primeiro submódulo permitido (inclusive a partir de /marketing).
export function MarketingSubmoduleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { can, isLoading, home } = useMarketingAccess();
  const key = marketingPermissionForPath(pathname);
  const allowed = key ? can(key) : pathname === "/marketing" ? false : true;
  const redirectTo = !isLoading && !allowed && home && home !== pathname ? home : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (isLoading || redirectTo || (pathname === "/marketing" && home)) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
        <div className="h-40 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 px-4 py-24 text-center sm:px-6">
        <ShieldAlert size={28} style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>Acesso restrito</p>
        <p className="max-w-xs text-xs" style={{ color: "var(--muted-foreground)" }}>
          Nenhuma área do Marketing foi liberada para você.
        </p>
        <Link href="/" className="lc-btn mt-2 px-4 py-2 text-sm">
          Voltar ao Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
