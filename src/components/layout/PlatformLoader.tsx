"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const PlatformLoaderVisual = dynamic(
  () => import("./PlatformLoaderVisual").then(module => module.PlatformLoaderVisual),
  { ssr: false },
);

export function PlatformLoader() {
  const pathname = usePathname();
  const isPublicPage = pathname?.startsWith("/form/") || pathname?.startsWith("/agendar/");
  if (isPublicPage) return null;
  return <PlatformLoaderVisual />;
}
