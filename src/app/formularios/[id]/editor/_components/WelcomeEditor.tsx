"use client";

import { cn } from "@/lib/utils";
import type { FormWelcomeScreen } from "@/types";
import { Toggle, Field, StyledInput } from "./primitives";
import { RichTextEditor } from "./RichTextEditor";
import { WelcomeImageUpload } from "./WelcomeImageUpload";

const IMAGE_SIZE_OPTIONS: Array<{ value: NonNullable<FormWelcomeScreen["imageSize"]>; label: string }> = [
  { value: "small",  label: "Pequena" },
  { value: "medium", label: "Média" },
  { value: "large",  label: "Grande" },
];

interface WelcomeEditorProps {
  welcome: FormWelcomeScreen;
  onChange: (welcome: FormWelcomeScreen) => void;
  formId: string;
}

export function WelcomeEditor({ welcome, onChange, formId }: WelcomeEditorProps) {
  const up = (patch: Partial<FormWelcomeScreen>) => onChange({ ...welcome, ...patch });

  return (
    <div className="flex flex-col gap-5">
      <Toggle
        label="Ativar tela de boas-vindas"
        enabled={welcome.enabled}
        onToggle={() => up({ enabled: !welcome.enabled })}
      />

      <div className={cn("flex flex-col gap-4", !welcome.enabled && "opacity-40 pointer-events-none")}>

        {/* Upload de imagem/logo */}
        <Field label="Imagem / Logo">
          <WelcomeImageUpload
            formId={formId}
            imageUrl={welcome.imageUrl}
            onUpload={url => up({ imageUrl: url })}
            onRemove={() => up({ imageUrl: undefined })}
          />
        </Field>

        {welcome.imageUrl && (
          <Field label="Tamanho da imagem">
            <div className="flex gap-1.5" role="group" aria-label="Selecionar tamanho da imagem">
              {IMAGE_SIZE_OPTIONS.map(opt => {
                const current = welcome.imageSize ?? "medium";
                const active = current === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => up({ imageSize: opt.value })}
                    aria-pressed={active}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: active ? "color-mix(in srgb, var(--primary) 20%, transparent)" : "var(--hover)",
                      color: active ? "var(--primary)" : "var(--muted-foreground)",
                      border: `1px solid ${active ? "color-mix(in srgb, var(--primary) 35%, transparent)" : "var(--glass-border)"}`,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {/* Título — Rich Text (modo inline: apenas marcas inline) */}
        <Field label="Título">
          <RichTextEditor
            value={welcome.title}
            onChange={html => up({ title: html })}
            placeholder="Bem-vindo ao nosso formulário"
            mode="inline"
            minHeight={44}
          />
        </Field>

        {/* Descrição — Rich Text completo */}
        <Field label="Descrição">
          <RichTextEditor
            value={welcome.description ?? ""}
            onChange={html => up({ description: html })}
            placeholder="Uma breve descrição..."
            mode="block"
            minHeight={100}
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
