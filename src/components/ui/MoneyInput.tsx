"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Converts float (e.g. 1250.90) → cents integer (125090)
function toCents(v: number): number {
  return Math.round(v * 100);
}

// Extracts only digits from raw string, clamps to max cents, returns integer cents
function rawToCents(raw: string, maxCents: number): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  return Math.min(parseInt(digits, 10), maxCents);
}

// Formats cents integer → "R$ 1.250,90"
function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  // Maximum value in BRL (default: 9 999 999.99)
  max?: number;
}

export function MoneyInput({
  value,
  onChange,
  placeholder = "R$ 0,00",
  disabled = false,
  className,
  max = 9_999_999.99,
}: MoneyInputProps) {
  const maxCents = Math.round(max * 100);
  const [cents, setCents] = useState(() => toCents(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from external value changes (e.g. modal reset) when not actively editing
  useEffect(() => {
    if (!focused) {
      setCents(toCents(value));
    }
  }, [value, focused]);

  const display = cents > 0 ? centsToDisplay(cents) : "";

  const moveCursorToEnd = () => {
    const el = inputRef.current;
    if (!el) return;
    const len = el.value.length;
    el.setSelectionRange(len, len);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCents = rawToCents(e.target.value, maxCents);
    setCents(newCents);
    onChange(newCents / 100);
    // Defer cursor-to-end so React finishes re-rendering with the new value
    requestAnimationFrame(moveCursorToEnd);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const newCents = rawToCents(pasted, maxCents);
    setCents(newCents);
    onChange(newCents / 100);
    requestAnimationFrame(moveCursorToEnd);
  };

  const handleFocus = () => {
    setFocused(true);
    requestAnimationFrame(moveCursorToEnd);
  };

  const handleBlur = () => {
    setFocused(false);
  };

  // Prevent non-numeric keys (allow: digits, backspace, delete, tab, arrows, ctrl shortcuts)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = [
      "Backspace", "Delete", "Tab", "Escape", "Enter",
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End",
    ];
    if (allowed.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey) return; // copy/paste/undo shortcuts
    if (!/^\d$/.test(e.key)) e.preventDefault();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onPaste={handlePaste}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none placeholder:text-[#b4b4b4]/50 transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={{ border: "none" }}
    />
  );
}
