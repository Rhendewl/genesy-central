"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

interface TimePickerPopoverProps {
  value:    string | null; // "HH:mm"
  onChange: (time: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export function TimePickerPopover({ value, onChange, disabled = false, className }: TimePickerPopoverProps) {
  const [hh, mm] = value ? value.split(":") : [null, null];

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minuteColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const scrollToSelected = (container: HTMLDivElement | null, selectedValue: string | null) => {
      if (!container || !selectedValue) return;
      const el = container.querySelector<HTMLElement>(`[data-value="${selectedValue}"]`);
      el?.scrollIntoView({ block: "center" });
    };
    scrollToSelected(hourColRef.current, hh);
    scrollToSelected(minuteColRef.current, mm);
  }, [open, hh, mm]);

  const pick = (part: "h" | "m", val: string) => {
    const nextH = part === "h" ? val : hh ?? "00";
    const nextM = part === "m" ? val : mm ?? "00";
    onChange(`${nextH}:${nextM}`);
  };

  const label = hh && mm ? `${hh}:${mm}` : "--:--";

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="lc-filter-control flex h-8 items-center gap-2 rounded-lg px-2.5 text-xs transition-all disabled:cursor-not-allowed disabled:opacity-40"
        style={{ color: hh && mm ? "var(--text-title)" : "var(--text-placeholder)" }}
      >
        <Clock size={13} style={{ color: "var(--icon)", flexShrink: 0 }} />
        <span className="tabular-nums">{label}</span>
      </button>

      {open && !disabled && (
        <div
          className="lc-modal-panel absolute left-0 top-full z-50 mt-2 flex overflow-hidden rounded-2xl"
          style={{ width: 140 }}
        >
          <div ref={hourColRef} className="h-40 flex-1 overflow-y-auto py-1 scrollbar-none" style={{ borderRight: "1px solid var(--glass-border)" }}>
            {HOURS.map((h) => {
              const isSelected = hh === h;
              return (
                <button
                  key={h}
                  data-value={h}
                  onClick={() => pick("h", h)}
                  className="flex h-8 w-full items-center justify-center text-xs font-medium tabular-nums transition-colors"
                  style={{
                    background: isSelected ? "var(--tab-active-bg)" : "transparent",
                    color:      isSelected ? "var(--tab-active-text)" : "var(--text-body)",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--hover)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  {h}
                </button>
              );
            })}
          </div>
          <div ref={minuteColRef} className="h-40 flex-1 overflow-y-auto py-1 scrollbar-none">
            {MINUTES.map((m) => {
              const isSelected = mm === m;
              return (
                <button
                  key={m}
                  data-value={m}
                  onClick={() => pick("m", m)}
                  className="flex h-8 w-full items-center justify-center text-xs font-medium tabular-nums transition-colors"
                  style={{
                    background: isSelected ? "var(--tab-active-bg)" : "transparent",
                    color:      isSelected ? "var(--tab-active-text)" : "var(--text-body)",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--hover)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
