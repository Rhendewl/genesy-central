"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FormEditor — orquestrador principal do editor visual
// Gerencia: seleção de elemento, modo preview, painel ativo, ops de steps.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MousePointer2 } from "lucide-react";
import { toast } from "sonner";

import { useFormularioEditor } from "@/hooks/useFormularioEditor";
import { useFormularios } from "@/hooks/useFormularios";

import type {
  FormStep, FormStepType, FormWelcomeScreen, FormEnding, FormTheme,
} from "@/types";

import { EditorToolbar }  from "./EditorToolbar";
import { EditorSidebar }  from "./EditorSidebar";
import { EditorCanvas }   from "./EditorCanvas";
import { BlockSettings }  from "./BlockSettings";
import { WelcomeEditor }  from "./WelcomeEditor";
import { EndingEditor }   from "./EndingEditor";
import { PreviewPanel }   from "./PreviewPanel";
import { createDefaultStep } from "./blocks";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_WELCOME: FormWelcomeScreen = {
  enabled: true,
  title:   "Bem-vindo!",
  description: "",
  buttonText: "Começar",
};

const DEFAULT_THEME: FormTheme = {
  primaryColor:    "var(--primary)",
  backgroundColor: "var(--background)",
  buttonStyle:     "rounded",
  textAlign:       "left",
  progressBar:     true,
};

const HISTORY_MAX = 50;

// ── Tipos ─────────────────────────────────────────────────────────────────────

type SelectedElement = null | "welcome" | "ending" | string;

interface FormEditorProps {
  id: string;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function FormEditor({ id }: FormEditorProps) {
  const router   = useRouter();
  const editor   = useFormularioEditor(id);
  const { publicarFormulario } = useFormularios();
  const { form, isLoading, isSaving, isDirty, save, updateSteps } = editor;

  const [selected,    setSelected]    = useState<SelectedElement>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [activePanel, setActivePanel] = useState<"blocks" | "theme">("blocks");

  const historyStack = useRef<FormStep[][]>([]);

  // ── Atalhos de teclado ─────────────────────────────────────────────────────
  // Deps: save e updateSteps são callbacks estáveis — o listener é registrado
  // uma única vez e não precisa ser removido/adicionado a cada render.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (meta && e.key === "p") {
        e.preventDefault();
        setPreviewMode(m => !m);
        return;
      }
      if (meta && e.key === "z") {
        e.preventDefault();
        const prev = historyStack.current.pop();
        if (prev) updateSteps(prev);
        return;
      }
      if (e.key === "Escape") {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save, updateSteps]);

  // Auto-save a cada 30s
  useEffect(() => {
    if (!isDirty) return;
    const t = setInterval(() => { if (isDirty) save(); }, 30_000);
    return () => clearInterval(t);
  }, [isDirty, save]);

  // Auto-save ao sair da aba
  useEffect(() => {
    const handler = () => { if (isDirty) save(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [isDirty, save]);

  // ── Helpers de history ─────────────────────────────────────────────────────

  function pushHistory(steps: FormStep[]) {
    if (historyStack.current.length >= HISTORY_MAX) {
      historyStack.current.shift();
    }
    historyStack.current.push(steps);
  }

  // ── Operações sobre steps ──────────────────────────────────────────────────

  const addStep = useCallback((type: FormStepType) => {
    if (!form) return;
    pushHistory(form.steps ?? []);
    const step = createDefaultStep(type);
    editor.updateSteps([...(form.steps ?? []), step]);
    setSelected(step.id);
    setActivePanel("blocks");
  }, [form, editor]);

  const removeStep = useCallback((stepId: string) => {
    if (!form) return;
    pushHistory(form.steps ?? []);
    editor.updateSteps((form.steps ?? []).filter(s => s.id !== stepId));
    if (selected === stepId) setSelected(null);
  }, [form, editor, selected]);

  const updateStep = useCallback((stepId: string, patch: Partial<FormStep>) => {
    if (!form) return;
    editor.updateSteps(
      (form.steps ?? []).map(s => s.id === stepId ? { ...s, ...patch } : s)
    );
  }, [form, editor]);

  const duplicateStep = useCallback((stepId: string) => {
    if (!form) return;
    const orig = (form.steps ?? []).find(s => s.id === stepId);
    if (!orig) return;
    pushHistory(form.steps ?? []);
    const copy: FormStep = { ...orig, id: crypto.randomUUID() };
    const idx  = (form.steps ?? []).findIndex(s => s.id === stepId);
    const next = [...(form.steps ?? [])];
    next.splice(idx + 1, 0, copy);
    editor.updateSteps(next);
    setSelected(copy.id);
  }, [form, editor]);

  const reorderSteps = useCallback((steps: FormStep[]) => {
    editor.updateSteps(steps);
  }, [editor]);

  // ── Publicar ───────────────────────────────────────────────────────────────

  const handlePublish = useCallback(async () => {
    if (isDirty) await save();
    const { error } = await publicarFormulario(id);
    if (error) toast.error("Erro ao publicar", { description: error });
    else       toast.success("Formulário publicado!");
  }, [id, isDirty, save, publicarFormulario]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "var(--background)" }}
      >
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }

  if (!form) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "var(--background)" }}
      >
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Formulário não encontrado.
        </p>
      </div>
    );
  }

  // ── Dados resolvidos ───────────────────────────────────────────────────────

  const welcome = form.welcome_screen ?? DEFAULT_WELCOME;
  const endings = form.endings?.length ? form.endings : [{ id: "default", title: "Obrigado!" }];
  const steps   = form.steps ?? [];
  const theme   = { ...DEFAULT_THEME, ...form.theme };

  const selectedStep =
    selected && selected !== "welcome" && selected !== "ending"
      ? steps.find(s => s.id === selected) ?? null
      : null;

  // ── Painel direito ─────────────────────────────────────────────────────────

  function renderRightPanel() {
    if (!selected) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--accent)" }}
            aria-hidden="true"
          >
            <MousePointer2 size={18} style={{ color: "var(--muted-foreground)" }} />
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Selecione um elemento no canvas para editar suas propriedades
          </p>
        </div>
      );
    }

    if (selected === "welcome") {
      return (
        <div className="p-4 overflow-y-auto h-full">
          <WelcomeEditor welcome={welcome} onChange={editor.updateWelcome} />
        </div>
      );
    }

    if (selected === "ending") {
      return (
        <div className="p-4 overflow-y-auto h-full">
          <EndingEditor endings={endings} onChange={editor.updateEndings} />
        </div>
      );
    }

    if (selectedStep) {
      return (
        <div className="p-4 overflow-y-auto h-full">
          <BlockSettings
            step={selectedStep}
            onChange={patch => updateStep(selectedStep.id, patch)}
          />
        </div>
      );
    }

    return null;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: "var(--background)" }}
    >
      <EditorToolbar
        formName={form.name}
        formStatus={form.status}
        isDirty={isDirty}
        isSaving={isSaving}
        previewMode={previewMode}
        onSave={save}
        onBack={() => router.push("/formularios")}
        onTogglePreview={() => setPreviewMode(m => !m)}
        onChangeName={name =>
          editor.updateMeta({ name, description: form.description ?? null, slug: form.slug })
        }
        onPublish={handlePublish}
      />

      {previewMode ? (
        <PreviewPanel form={{ ...form, theme, welcome_screen: welcome }} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* ── Sidebar esquerda ── */}
          <div
            className="w-72 flex-shrink-0 flex flex-col border-r overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
              {(["blocks", "theme"] as const).map(panel => (
                <button
                  key={panel}
                  onClick={() => setActivePanel(panel)}
                  aria-pressed={activePanel === panel}
                  className="flex-1 py-3 text-xs font-medium transition-all"
                  style={{
                    color:
                      activePanel === panel
                        ? "var(--text-title)"
                        : "var(--muted-foreground)",
                    borderBottom:
                      activePanel === panel
                        ? "2px solid var(--primary)"
                        : "2px solid transparent",
                  }}
                >
                  {panel === "blocks" ? "Blocos" : "Tema"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              <EditorSidebar
                activePanel={activePanel}
                theme={theme}
                onAddBlock={addStep}
                onThemeChange={editor.updateTheme}
              />
            </div>
          </div>

          {/* ── Canvas central ── */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ background: "var(--muted)" }}
          >
            <EditorCanvas
              welcome={welcome}
              steps={steps}
              endings={endings}
              selectedId={selected}
              onSelectWelcome={() =>
                setSelected(s => s === "welcome" ? null : "welcome")
              }
              onSelectEnding={() =>
                setSelected(s => s === "ending" ? null : "ending")
              }
              onSelectStep={stepId =>
                setSelected(s => s === stepId ? null : stepId)
              }
              onAddStep={addStep}
              onDeleteStep={removeStep}
              onDuplicateStep={duplicateStep}
              onReorderSteps={reorderSteps}
              onOpenBlockLibrary={() => setActivePanel("blocks")}
            />
          </div>

          {/* ── Painel direito ── */}
          <div
            className="w-80 flex-shrink-0 border-l flex flex-col overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            {selected && (
              <div
                className="px-4 py-2.5 border-b flex items-center justify-between"
                style={{ borderColor: "var(--border)" }}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {selected === "welcome"
                    ? "Boas-vindas"
                    : selected === "ending"
                      ? "Encerramento"
                      : "Propriedades"}
                </span>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs hover:opacity-60 transition-opacity"
                  style={{ color: "var(--muted-foreground)" }}
                  aria-label="Fechar painel de propriedades"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {renderRightPanel()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
