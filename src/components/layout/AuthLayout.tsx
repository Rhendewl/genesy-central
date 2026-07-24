"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const PrivateAuthLayout = dynamic(
  () => import("./PrivateAuthLayout").then(module => module.PrivateAuthLayout),
);

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLightweightPublicPage = pathname?.startsWith("/form/") || pathname?.startsWith("/agendar/");
  if (isLightweightPublicPage) return <main className="min-h-dvh">{children}</main>;
  return <PrivateAuthLayout>{children}</PrivateAuthLayout>;
}
