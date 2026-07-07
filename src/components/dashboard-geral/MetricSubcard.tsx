"use client";

interface MetricSubcardProps {
  label: string;
  value: string;
}

export function MetricSubcard({ label, value }: MetricSubcardProps) {
  return (
    <div
      className="rounded-xl p-2"
      style={{ background: "var(--bg-lead-card)", border: "1px solid var(--border)" }}
    >
      <p className="text-[8px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </p>
      <p className="mt-0.5 truncate text-[13px] font-bold" style={{ color: "var(--text-title)" }}>
        {value}
      </p>
    </div>
  );
}
