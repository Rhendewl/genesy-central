"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface AutomationSelectOption {
  value: string;
  label: string;
}

interface AutomationSelectProps {
  value: string;
  options: AutomationSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  size?: "xs" | "sm";
}

export function AutomationSelect({
  value,
  options,
  onChange,
  disabled,
  className,
  size = "sm",
}: AutomationSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(opt => opt.value === value) ?? options[0];
  const textClass = size === "xs" ? "text-xs" : "text-sm";
  const paddingClass = size === "xs" ? "px-2 py-1 pr-7" : "px-3 py-2 pr-8";

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={`w-full rounded-lg text-left outline-none transition-colors disabled:opacity-40 ${paddingClass} ${textClass}`}
        style={{ background: "var(--hover)", border: "1px solid var(--border)", color: "var(--text-title)" }}
      >
        <span className="block truncate">{selected?.label ?? "Selecionar..."}</span>
      </button>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-3 top-1/2 transition-transform"
        style={{ color: "var(--muted-foreground)", transform: open ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)" }}
      />

      {open && (
        <div className="lc-modal-panel absolute left-0 right-0 top-full z-[90] mt-1.5 max-h-56 overflow-y-auto rounded-xl p-1.5">
          {options.map(opt => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--hover)] ${textClass}`}
                style={{
                  background: active ? "var(--hover)" : "transparent",
                  color: active ? "var(--text-title)" : "var(--muted-foreground)",
                }}
              >
                <span className="truncate">{opt.label}</span>
                {active && <Check size={12} style={{ color: "var(--text-title)" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
