"use client";

import { cn } from "@/lib/utils";
import type { FormWelcomeScreen } from "@/types";
import { Toggle, Field, StyledInput, StyledTextarea } from "./primitives";

interface WelcomeEditorProps {
  welcome: FormWelcomeScreen;
  onChange: (welcome: FormWelcomeScreen) => void;
}

export function WelcomeEditor({ welcome, onChange }: WelcomeEditorProps) {
  const up = (patch: Partial<FormWelcomeScreen>) => onChange({ ...welcome, ...patch });

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            Tela de Boas-vindas
          </h3>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Exibida antes das perguntas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {welcome.enabled ? "Ativa" : "Inativa"}
          </span>
          <Toggle
            enabled={welcome.enabled}
            onToggle={() => up({ enabled: !welcome.enabled })}
            label="Tela de boas-vindas ativa"
          />
        </div>
      </div>

      <div className={cn("flex flex-col gap-4", !welcome.enabled && "opacity-40 pointer-events-none")}>
        <Field label="Título" htmlFor="welcome-title">
          <StyledInput
            id="welcome-title"
            value={welcome.title}
            placeholder="Bem-vindo ao nosso formulário"
            onChange={e => up({ title: e.target.value })}
          />
        </Field>

        <Field label="Descrição" htmlFor="welcome-desc">
          <StyledTextarea
            id="welcome-desc"
            rows={3}
            value={welcome.description ?? ""}
            placeholder="Uma breve descrição..."
            onChange={e => up({ description: e.target.value })}
          />
        </Field>

        <Field label="Texto do botão" htmlFor="welcome-btn">
          <StyledInput
            id="welcome-btn"
            value={welcome.buttonText}
            placeholder="Começar"
            onChange={e => up({ buttonText: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
