"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormStep } from "@/types";
import { getBlockDef } from "./blocks";
import { Toggle, Field, StyledInput, StyledTextarea, inputBaseClass } from "./primitives";

interface BlockSettingsProps {
  step: FormStep;
  onChange: (patch: Partial<FormStep>) => void;
}

// ── Campos comuns ─────────────────────────────────────────────────────────────

function CommonFields({ step, onChange }: BlockSettingsProps) {
  const showRequired = step.type !== "statement" && step.type !== "redirect";
  return (
    <>
      <Field label="Título da pergunta" htmlFor={`bs-title-${step.id}`}>
        <StyledInput
          id={`bs-title-${step.id}`}
          value={step.title}
          placeholder="Digite a pergunta..."
          onChange={e => onChange({ title: e.target.value })}
        />
      </Field>

      <Field label="Descrição (opcional)" htmlFor={`bs-desc-${step.id}`}>
        <StyledTextarea
          id={`bs-desc-${step.id}`}
          rows={2}
          value={step.description ?? ""}
          placeholder="Informação adicional..."
          onChange={e => onChange({ description: e.target.value || undefined })}
        />
      </Field>

      {showRequired && (
        <Toggle
          label="Resposta obrigatória"
          enabled={step.required}
          onToggle={() => onChange({ required: !step.required })}
        />
      )}
    </>
  );
}

// ── Placeholder ───────────────────────────────────────────────────────────────

function PlaceholderField({ step, onChange }: BlockSettingsProps) {
  return (
    <Field label="Placeholder" htmlFor={`bs-ph-${step.id}`}>
      <StyledInput
        id={`bs-ph-${step.id}`}
        value={step.placeholder ?? ""}
        placeholder="Texto de ajuda..."
        onChange={e => onChange({ placeholder: e.target.value })}
      />
    </Field>
  );
}

// ── Editor de opções ──────────────────────────────────────────────────────────

function ChoicesEditor({ step, onChange }: BlockSettingsProps) {
  const choices = step.choices ?? [];

  const updateChoice = (id: string, label: string) =>
    onChange({
      choices: choices.map(c =>
        c.id === id ? { ...c, label, value: label.toLowerCase().replace(/\s+/g, "_") } : c
      ),
    });

  const addChoice = () =>
    onChange({
      choices: [
        ...choices,
        {
          id: crypto.randomUUID(),
          label: `Opção ${choices.length + 1}`,
          value: `opcao_${choices.length + 1}`,
        },
      ],
    });

  const removeChoice = (id: string) => {
    if (choices.length <= 1) return;
    onChange({ choices: choices.filter(c => c.id !== id) });
  };

  return (
    <Field label="Opções">
      <div className="flex flex-col gap-1.5">
        {choices.map((choice, i) => (
          <div key={choice.id} className="flex items-center gap-1.5">
            <GripVertical
              size={12}
              aria-hidden="true"
              style={{ color: "var(--muted-foreground)" }}
              className="flex-shrink-0 opacity-40"
            />
            <StyledInput
              className="flex-1"
              value={choice.label}
              placeholder="Opção..."
              aria-label={`Opção ${i + 1}`}
              onChange={e => updateChoice(choice.id, e.target.value)}
            />
            <button
              onClick={() => removeChoice(choice.id)}
              className="flex-shrink-0 p-1 rounded hover:bg-red-500/10 transition-colors"
              disabled={choices.length <= 1}
              aria-label="Remover opção"
            >
              <Trash2
                size={11}
                aria-hidden="true"
                style={{ color: choices.length <= 1 ? "var(--border)" : "#ef4444" }}
              />
            </button>
          </div>
        ))}

        <button
          onClick={addChoice}
          className="flex items-center gap-1.5 text-xs py-2 px-3 rounded-lg transition-all hover:bg-white/5 mt-1"
          style={{ color: "var(--primary)", border: "1px dashed var(--border)" }}
        >
          <Plus size={11} aria-hidden="true" />
          Adicionar opção
        </button>
      </div>
    </Field>
  );
}

// ── Rating ────────────────────────────────────────────────────────────────────

function RatingSettings({ step, onChange }: BlockSettingsProps) {
  const max = step.maxRating ?? 5;
  return (
    <Field label="Número máximo de estrelas">
      <div className="flex gap-1.5" role="group" aria-label="Selecionar número de estrelas">
        {[3, 5, 7, 10].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange({ maxRating: n })}
            aria-pressed={max === n}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: max === n ? "rgba(64,69,73,0.20)" : "rgba(0,0,0,0.30)",
              color: max === n ? "#404549" : "var(--muted-foreground)",
              border: `1px solid ${max === n ? "rgba(64,69,73,0.35)" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </Field>
  );
}

// ── Content field ─────────────────────────────────────────────────────────────

function ContentField({
  step,
  onChange,
  label,
  placeholder,
  fieldId,
}: BlockSettingsProps & { label: string; placeholder: string; fieldId: string }) {
  return (
    <Field label={label} htmlFor={fieldId}>
      <StyledTextarea
        id={fieldId}
        rows={3}
        value={step.content ?? ""}
        placeholder={placeholder}
        onChange={e => onChange({ content: e.target.value })}
      />
    </Field>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function BlockSettings({ step, onChange }: BlockSettingsProps) {
  const def   = getBlockDef(step.type);
  const color = def?.color ?? "var(--primary)";
  const Icon  = def?.icon;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}18` }}
            aria-hidden="true"
          >
            <Icon size={14} style={{ color }} />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            {def?.label ?? step.type}
          </p>
          <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            {def?.description}
          </p>
        </div>
      </div>

      <CommonFields step={step} onChange={onChange} />

      <div style={{ height: "1px", background: "var(--border)" }} role="separator" />

      {(step.type === "short_text" ||
        step.type === "long_text"  ||
        step.type === "email"      ||
        step.type === "phone"      ||
        step.type === "number") && (
        <PlaceholderField step={step} onChange={onChange} />
      )}

      {(step.type === "multiple_choice" || step.type === "single_choice") && (
        <ChoicesEditor step={step} onChange={onChange} />
      )}

      {step.type === "rating" && (
        <RatingSettings step={step} onChange={onChange} />
      )}

      {step.type === "statement" && (
        <ContentField
          step={step}
          onChange={onChange}
          label="Conteúdo do texto"
          placeholder="Escreva aqui o texto informativo..."
          fieldId={`bs-content-${step.id}`}
        />
      )}

      {step.type === "redirect" && (
        <ContentField
          step={step}
          onChange={onChange}
          label="URL de destino"
          placeholder="https://..."
          fieldId={`bs-redirect-${step.id}`}
        />
      )}

      {step.type === "file_upload" && (
        <div
          className={cn(inputBaseClass, "text-center py-4")}
          style={{
            border: "1px dashed var(--border)",
            color: "var(--muted-foreground)",
            background: "var(--background)",
            borderRadius: "8px",
          }}
        >
          <p className="text-[10px]">Upload de arquivo — configurações disponíveis em breve</p>
        </div>
      )}
    </div>
  );
}
