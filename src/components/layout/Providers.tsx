"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const AuthenticatedProviders = dynamic(
  () => import("./AuthenticatedProviders").then(module => module.AuthenticatedProviders),
);

const PUBLIC_PREFIXES = ["/form/", "/agendar/", "/portal/", "/convite/"];

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PREFIXES.some(prefix => pathname?.startsWith(prefix));
  if (isPublic) return <>{children}</>;
  return <AuthenticatedProviders>{children}</AuthenticatedProviders>;
}
