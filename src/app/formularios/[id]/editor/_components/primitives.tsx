"use client";

import React from "react";
import { cn } from "@/lib/utils";

// ── Toggle ────────────────────────────────────────────────────────────────────

interface ToggleProps {
  enabled: boolean;
  onToggle: () => void;
  label?: string;
}

export function Toggle({ enabled, onToggle, label }: ToggleProps) {
  // Track: 36×20px | Thumb: 16×16px | Padding: 2px
  // ON left: 36 - 16 - 2 = 18px  → right edge = 34px (dentro dos 36px) ✓
  // OFF left: 2px
  const btn = (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onToggle}
      className="relative flex-shrink-0 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        width: 36,
        height: 20,
        background: enabled ? "var(--primary)" : "rgba(255,255,255,0.12)",
        outlineColor: "var(--primary)",
      }}
    >
      <span
        className="absolute rounded-full bg-white transition-all duration-200"
        style={{
          top: 2,
          left: enabled ? 18 : 2,
          width: 16,
          height: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        }}
        aria-hidden="true"
      />
    </button>
  );

  if (!label) return btn;

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs select-none" style={{ color: "var(--text-title)" }}>
        {label}
      </span>
      {btn}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  children: React.ReactNode;
  htmlFor?: string;
}

export function Field({ label, children, htmlFor }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[10px] font-semibold uppercase tracking-wider cursor-default select-none"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Input style primitives ────────────────────────────────────────────────────
// Stable object reference: React skips DOM style re-application when the
// reference hasn't changed, which lets the focus-triggered borderColor mutation
// persist across re-renders caused by controlled onChange handlers.

export const inputBaseClass =
  "w-full px-3 py-2 text-xs rounded-lg outline-none transition-all";

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--background)",
  border: "1px solid var(--border)",
  color: "var(--text-title)",
};

function onFocusHighlight(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "var(--primary)";
}
function onBlurReset(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "var(--border)";
}

// ── StyledInput ───────────────────────────────────────────────────────────────

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "style">;

export function StyledInput({ className, onFocus, onBlur, ...props }: InputProps) {
  return (
    <input
      className={cn(inputBaseClass, className)}
      style={INPUT_STYLE}
      onFocus={e => { onFocusHighlight(e); onFocus?.(e); }}
      onBlur={e => { onBlurReset(e); onBlur?.(e); }}
      {...props}
    />
  );
}

// ── StyledTextarea ────────────────────────────────────────────────────────────

type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "style">;

export function StyledTextarea({ className, onFocus, onBlur, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(inputBaseClass, "resize-none", className)}
      style={INPUT_STYLE}
      onFocus={e => { onFocusHighlight(e); onFocus?.(e); }}
      onBlur={e => { onBlurReset(e); onBlur?.(e); }}
      {...props}
    />
  );
}
