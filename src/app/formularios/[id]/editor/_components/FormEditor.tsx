"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FormEditor — orquestrador principal do editor visual
// Layout: ContentSidebar | LivePreview | PropertiesPanel
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MousePointer2 } from "lucide-react";
import { toast } from "sonner";

import { useFormularioEditor } from "@/hooks/useFormularioEditor";
import { useFormularios } from "@/hooks/useFormularios";

import type {
  FormStep, FormStepType, FormWelcomeScreen, FormEnding, FormTheme, LogicRule,
} from "@/types";

import { EditorToolbar }  from "./EditorToolbar";
import { ContentSidebar } from "./ContentSidebar";
import { LivePreview }    from "./LivePreview";
import { BlockSettings }  from "./BlockSettings";
import { WelcomeEditor }  from "./WelcomeEditor";
import { EndingEditor }   from "./EndingEditor";
import { ThemeEditor }    from "./ThemeEditor";
import { createDefaultStep } from "./blocks";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_WELCOME: FormWelcomeScreen = {
  enabled: true,
  title:   "Bem-vindo!",
  description: "",
  buttonText: "Começar",
};

const DEFAULT_THEME: FormTheme = {
  primaryColor:    "#22c55e",
  backgroundColor: "#ffffff",
  buttonStyle:     "rounded",
  textAlign:       "left",
  progressBar:     true,
};

const HISTORY_MAX = 50;

// ── Tipos ─────────────────────────────────────────────────────────────────────

type SelectedElement = null | "welcome" | "ending" | "theme" | string;

interface FormEditorProps {
  id: string;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function FormEditor({ id }: FormEditorProps) {
  const router   = useRouter();
  const editor   = useFormularioEditor(id);
  const { publicarFormulario } = useFormularios();
  const { form, isLoading, isSaving, isDirty, save, updateSteps } = editor;

  const [selected, setSelected] = useState<SelectedElement>(null);

  const historyStack = useRef<FormStep[][]>([]);

  // ── Atalhos de teclado ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key === "s") {
        e.preventDefault();
        save();
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
  }, [form, editor]);

  const removeStep = useCallback((stepId: string) => {
    if (!form) return;
    pushHistory(form.steps ?? []);
    editor.updateSteps((form.steps ?? []).filter(s => s.id !== stepId));
    if (selected === stepId) setSelected(null);

    // Limpa regras de lógica órfãs: a pergunta removida deixa de disparar
    // regras (elas somem) e deixa de ser um alvo válido (volta pro padrão
    // "Próxima pergunta" nas regras de outras perguntas que apontavam pra ela).
    const rules = form.logic_rules ?? [];
    if (rules.some(r => r.condition.step === stepId || r.action.target === stepId)) {
      editor.updateLogic(
        rules
          .filter(r => r.condition.step !== stepId)
          .map(r => r.action.target === stepId ? { ...r, action: { type: "jump" as const, target: undefined } } : r)
      );
    }
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

  const welcome    = form.welcome_screen ?? DEFAULT_WELCOME;
  const endings    = form.endings?.length ? form.endings : [{ id: "default", title: "Obrigado!" }];
  const steps      = form.steps ?? [];
  const theme      = { ...DEFAULT_THEME, ...form.theme };
  const logicRules = form.logic_rules ?? [];

  // Não usa useMemo: o form só está disponível depois dos early returns
  // acima (isLoading/!form), então um hook aqui violaria a ordem de hooks
  // entre renders. O array de regras é pequeno o suficiente para recalcular.
  const logicCountByStep: Record<string, number> = {};
  for (const rule of logicRules) {
    logicCountByStep[rule.condition.step] = (logicCountByStep[rule.condition.step] ?? 0) + 1;
  }

  const selectedStep =
    selected && selected !== "welcome" && selected !== "ending" && selected !== "theme"
      ? steps.find(s => s.id === selected) ?? null
      : null;

  // ── Painel de propriedades (direito) ───────────────────────────────────────

  function renderProperties() {
    if (selected === "theme") {
      return (
        <div className="p-4 overflow-y-auto h-full">
          <ThemeEditor theme={theme} onChange={editor.updateTheme} />
        </div>
      );
    }

    if (selected === "welcome") {
      return (
        <div className="p-4 overflow-y-auto h-full">
          <WelcomeEditor welcome={welcome} onChange={editor.updateWelcome} formId={id} />
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
            allSteps={steps}
            endings={endings}
            logicRules={logicRules}
            onChangeLogic={editor.updateLogic}
          />
        </div>
      );
    }

    // Empty state
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
          Selecione um elemento na lista para editar suas propriedades
        </p>
      </div>
    );
  }

  const propertyPanelLabel =
    selected === "welcome" ? "Boas-vindas" :
    selected === "ending"  ? "Encerramento" :
    selected === "theme"   ? "Tema" :
    selectedStep           ? "Propriedades" : "";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: "transparent" }}
    >
      <EditorToolbar
        formName={form.name}
        formStatus={form.status}
        formSlug={form.slug ?? null}
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={save}
        onBack={() => router.push(`/formularios/${id}`)}
        onChangeName={name =>
          editor.updateMeta({ name, description: form.description ?? null, slug: form.slug })
        }
        onPublish={handlePublish}
      />

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar esquerda — Conteúdo ── */}
        <ContentSidebar
          steps={steps}
          welcome={welcome}
          endings={endings}
          logicCountByStep={logicCountByStep}
          selectedId={selected}
          onSelectWelcome={() => setSelected(s => s === "welcome" ? null : "welcome")}
          onSelectStep={id => setSelected(s => s === id ? null : id)}
          onSelectEnding={() => setSelected(s => s === "ending" ? null : "ending")}
          onAddStep={addStep}
          onDeleteStep={removeStep}
          onDuplicateStep={duplicateStep}
          onReorderSteps={reorderSteps}
        />

        {/* ── Centro — Preview em tempo real ── */}
        <LivePreview
          form={{ ...form, theme, welcome_screen: welcome }}
          selectedId={selected}
          onSelectTheme={() => setSelected(s => s === "theme" ? null : "theme")}
        />

        {/* ── Painel direito — Propriedades ── */}
        <div
          className="w-80 flex-shrink-0 border-l flex flex-col overflow-hidden"
          style={{
            borderColor: "var(--glass-border)",
            background: "var(--hover)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          {selected && (
            <div
              className="px-4 py-2.5 border-b flex items-center justify-between flex-shrink-0"
              style={{ borderColor: "var(--glass-border)" }}
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                {propertyPanelLabel}
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
            {renderProperties()}
          </div>
        </div>

      </div>
    </div>
  );
}
