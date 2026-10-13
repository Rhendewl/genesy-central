import { CalculatorNavigation } from "@/components/calculadora/CalculatorNavigation";
import { ModuleAccessGate } from "@/components/layout/ModuleAccessGate";

export default function CalculadoraLayout({ children }: { children: React.ReactNode }) {
  return <ModuleAccessGate module="calculadora"><CalculatorNavigation />{children}</ModuleAccessGate>;
}
