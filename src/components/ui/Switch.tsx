"use client";

interface SwitchProps {
  checked:  boolean;
  onChange: (value: boolean) => void;
  label?:   string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative flex-shrink-0 transition-colors focus-visible:outline-none"
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? "var(--primary)" : "rgba(255,255,255,0.12)",
      }}
    >
      <span
        className="absolute rounded-full bg-white transition-all duration-200"
        style={{ top: 2, left: checked ? 18 : 2, width: 16, height: 16 }}
      />
    </button>
  );
}
