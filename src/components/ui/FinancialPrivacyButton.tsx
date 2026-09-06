"use client";

import { useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinancialPrivacyStore } from "@/store/financial-privacy";

interface FinancialPrivacyButtonProps {
  className?: string;
  compact?: boolean;
}

export function FinancialPrivacyButton({ className, compact = false }: FinancialPrivacyButtonProps) {
  const valuesHidden = useFinancialPrivacyStore((state) => state.valuesHidden);
  const hydrate = useFinancialPrivacyStore((state) => state.hydrate);
  const toggle = useFinancialPrivacyStore((state) => state.toggle);

  useEffect(() => hydrate(), [hydrate]);

  const label = valuesHidden ? "Exibir valores" : "Ocultar valores";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={valuesHidden}
      aria-label={label}
      title={label}
      className={cn(
        "flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-[var(--text-body)] transition-all hover:bg-[var(--hover)] hover:text-[var(--text-title)] active:scale-95",
        className,
      )}
      style={{ border: "1px solid var(--glass-border)", background: "var(--glass-bg-soft)" }}
    >
      {valuesHidden ? <EyeOff size={17} /> : <Eye size={17} />}
      {!compact && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
