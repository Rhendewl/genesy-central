import { ModuleAccessGate } from "@/components/layout/ModuleAccessGate";

export default function TrafegoLayout({ children }: { children: React.ReactNode }) {
  return <ModuleAccessGate module="trafego">{children}</ModuleAccessGate>;
}
