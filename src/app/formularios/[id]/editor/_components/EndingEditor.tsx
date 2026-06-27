"use client";

import { Plus, Trash2 } from "lucide-react";
import type { FormEnding } from "@/types";
import { Field, StyledInput, StyledTextarea } from "./primitives";

interface EndingEditorProps {
  endings: FormEnding[];
  onChange: (endings: FormEnding[]) => void;
}

export function EndingEditor({ endings, onChange }: EndingEditorProps) {
  const updateEnding = (id: string, patch: Partial<FormEnding>) =>
    onChange(endings.map(e => e.id === id ? { ...e, ...patch } : e));

  const addEnding = () =>
    onChange([
      ...endings,
      {
        id: crypto.randomUUID(),
        title: "Obrigado pela sua resposta!",
        description: "",
      },
    ]);

  const removeEnding = (id: string) => {
    if (endings.length <= 1) return;
    onChange(endings.filter(e => e.id !== id));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            Tela de Encerramento
          </h3>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Exibida após o envio
          </p>
        </div>
        <button
          onClick={addEnding}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all hover:opacity-90"
          style={{ background: "var(--accent)", color: "var(--muted-foreground)" }}
          aria-label="Adicionar nova tela de encerramento"
        >
          <Plus size={11} aria-hidden="true" />
          Adicionar
        </button>
      </div>

      {endings.map((ending, idx) => (
        <div
          key={ending.id}
          className="flex flex-col gap-3 p-3 rounded-xl border"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>
              ENCERRAMENTO {idx + 1}
            </span>
            {endings.length > 1 && (
              <button
                onClick={() => removeEnding(ending.id)}
                className="p-1 rounded hover:bg-red-500/10 transition-colors"
                aria-label={`Remover encerramento ${idx + 1}`}
              >
                <Trash2 size={11} style={{ color: "#ef4444" }} aria-hidden="true" />
              </button>
            )}
          </div>

          <Field label="Título" htmlFor={`ending-title-${ending.id}`}>
            <StyledInput
              id={`ending-title-${ending.id}`}
              value={ending.title}
              placeholder="Obrigado!"
              onChange={e => updateEnding(ending.id, { title: e.target.value })}
            />
          </Field>

          <Field label="Descrição" htmlFor={`ending-desc-${ending.id}`}>
            <StyledTextarea
              id={`ending-desc-${ending.id}`}
              rows={2}
              value={ending.description ?? ""}
              placeholder="Mensagem de encerramento..."
              onChange={e => updateEnding(ending.id, { description: e.target.value })}
            />
          </Field>

          <Field label="URL de redirecionamento (opcional)" htmlFor={`ending-url-${ending.id}`}>
            <StyledInput
              id={`ending-url-${ending.id}`}
              type="url"
              value={ending.redirectUrl ?? ""}
              placeholder="https://..."
              onChange={e => updateEnding(ending.id, { redirectUrl: e.target.value || undefined })}
            />
          </Field>
        </div>
      ))}
    </div>
  );
}
