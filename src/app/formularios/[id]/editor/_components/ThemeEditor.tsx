"use client";

import type { FormTheme } from "@/types";
import { Toggle, Field } from "./primitives";

interface ThemeEditorProps {
  theme: FormTheme;
  onChange: (patch: Partial<FormTheme>) => void;
}

// ── ColorSwatch ────────────────────────────────────────────────────────────────

function ColorSwatch({
  value,
  label,
  onChange,
  onClear,
  autoLabel = "Automático",
}: {
  value: string | undefined;
  label: string;
  onChange: (v: string) => void;
  onClear?: () => void;
  autoLabel?: string;
}) {
  const isAuto    = !value;
  const displayHex = isAuto ? "#94a3b8" : value;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer flex-1 transition-opacity"
        style={{
          background: "var(--background)",
          borderColor: "var(--border)",
          opacity: isAuto ? 0.6 : 1,
        }}
      >
        <input
          type="color"
          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
          value={displayHex}
          onChange={e => onChange(e.target.value)}
          aria-label={label}
          title={label}
        />
        <span className="text-xs font-mono" style={{ color: "var(--text-title)" }}>
          {isAuto ? autoLabel : displayHex}
        </span>
      </div>
      {onClear && !isAuto && (
        <button
          type="button"
          onClick={onClear}
          className="w-7 h-7 flex items-center justify-center rounded text-sm hover:bg-white/10 transition-colors flex-shrink-0"
          style={{ color: "var(--muted-foreground)" }}
          title="Restaurar automático"
          aria-label="Remover cor personalizada"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── ChipGroup ─────────────────────────────────────────────────────────────────

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (v: T) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex gap-1.5"
      role="group"
      aria-label={ariaLabel}
      style={{ pointerEvents: disabled ? "none" : "auto", opacity: disabled ? 0.4 : 1 }}
    >
      {options.map(opt => {
        const active = !disabled && (value ?? options[0].value) === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => !disabled && onChange(opt.value)}
            aria-pressed={active}
            disabled={disabled}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: active ? "rgba(102,174,214,0.20)" : "rgba(0,0,0,0.30)",
              color: active ? "#66aed6" : "var(--muted-foreground)",
              border: `1px solid ${active ? "rgba(102,174,214,0.35)" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[9px] font-bold uppercase tracking-widest pt-1"
      style={{ color: "rgba(255,255,255,0.25)" }}
    >
      {children}
    </p>
  );
}

// ── ThemeEditor ────────────────────────────────────────────────────────────────

export function ThemeEditor({ theme, onChange }: ThemeEditorProps) {
  return (
    <div className="flex flex-col gap-5 py-2">

      {/* ── Cores ── */}
      <SectionLabel>Cores</SectionLabel>

      <Field label="Cor principal">
        <ColorSwatch
          value={theme.primaryColor}
          label="Cor principal"
          onChange={v => onChange({ primaryColor: v })}
        />
      </Field>

      <Field label="Cor de fundo">
        <ColorSwatch
          value={theme.backgroundColor}
          label="Cor de fundo"
          onChange={v => onChange({ backgroundColor: v })}
        />
      </Field>

      <Field label="Cor do texto">
        <ColorSwatch
          value={theme.textColor}
          label="Cor do texto"
          onChange={v => onChange({ textColor: v })}
          onClear={() => onChange({ textColor: undefined })}
          autoLabel="Automático"
        />
      </Field>

      {/* ── Botão ── */}
      <SectionLabel>Botão</SectionLabel>

      <Field label="Estilo">
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

      {/* ── Texto ── */}
      <SectionLabel>Texto</SectionLabel>

      <Field label="Alinhamento">
        <ChipGroup
          ariaLabel="Alinhamento do texto"
          options={[
            { value: "left"   as const, label: "← Esquerda" },
            { value: "center" as const, label: "↔ Centro" },
            { value: "right"  as const, label: "→ Direita" },
          ]}
          value={theme.textAlign}
          onChange={v => onChange({ textAlign: v })}
        />
      </Field>

      {/* ── Layout ── */}
      <SectionLabel>Layout</SectionLabel>

      <Toggle
        label="Barra de progresso"
        enabled={theme.progressBar ?? true}
        onToggle={() => onChange({ progressBar: !(theme.progressBar ?? true) })}
      />

      <Field label="Raio dos cantos">
        <ChipGroup
          ariaLabel="Raio dos cantos (em breve)"
          options={[
            { value: "none"   as const, label: "Nenhum" },
            { value: "medium" as const, label: "Médio" },
            { value: "full"   as const, label: "Total" },
          ]}
          value={undefined}
          onChange={() => {}}
          disabled
        />
      </Field>

    </div>
  );
}
