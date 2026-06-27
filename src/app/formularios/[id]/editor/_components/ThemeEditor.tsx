"use client";

import type { FormTheme } from "@/types";
import { Toggle, Field } from "./primitives";

interface ThemeEditorProps {
  theme: FormTheme;
  onChange: (patch: Partial<FormTheme>) => void;
}

function ColorSwatch({
  value,
  label,
  onChange,
}: {
  value: string | undefined;
  label: string;
  onChange: (v: string) => void;
}) {
  const hex = value ?? "#66aed6";
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer"
      style={{ background: "var(--background)", borderColor: "var(--border)" }}
    >
      <input
        type="color"
        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
        value={hex}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
        title={label}
      />
      <span className="text-xs font-mono" style={{ color: "var(--text-title)" }}>
        {hex}
      </span>
    </div>
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex gap-1.5" role="group" aria-label={ariaLabel}>
      {options.map(opt => {
        const active = (value ?? options[0].value) === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: active ? "var(--primary)" : "var(--background)",
              color: active ? "#fff" : "var(--muted-foreground)",
              border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeEditor({ theme, onChange }: ThemeEditorProps) {
  return (
    <div className="flex flex-col gap-5 py-2">
      <Field label="Cor principal" htmlFor="theme-primary">
        <ColorSwatch
          value={theme.primaryColor}
          label="Cor principal"
          onChange={v => onChange({ primaryColor: v })}
        />
      </Field>

      <Field label="Cor de fundo" htmlFor="theme-bg">
        <ColorSwatch
          value={theme.backgroundColor}
          label="Cor de fundo"
          onChange={v => onChange({ backgroundColor: v })}
        />
      </Field>

      <Field label="Estilo do botão">
        <ChipGroup
          ariaLabel="Estilo do botão"
          options={[
            { value: "rounded" as const, label: "Arredondado" },
            { value: "square"  as const, label: "Quadrado" },
            { value: "pill"    as const, label: "Pílula" },
          ]}
          value={theme.buttonStyle}
          onChange={v => onChange({ buttonStyle: v })}
        />
      </Field>

      <Field label="Alinhamento do texto">
        <ChipGroup
          ariaLabel="Alinhamento do texto"
          options={[
            { value: "left"   as const, label: "←" },
            { value: "center" as const, label: "↔" },
            { value: "right"  as const, label: "→" },
          ]}
          value={theme.textAlign}
          onChange={v => onChange({ textAlign: v })}
        />
      </Field>

      <Toggle
        label="Barra de progresso"
        enabled={theme.progressBar ?? true}
        onToggle={() => onChange({ progressBar: !(theme.progressBar ?? true) })}
      />
    </div>
  );
}
