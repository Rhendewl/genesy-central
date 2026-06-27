"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { Form } from "@/types";
import { FormRenderer } from "@/components/formularios/FormRenderer";
import type { FormRendererScreen } from "@/components/formularios/FormRenderer";

interface PreviewPanelProps {
  form: Form;
}

export function PreviewPanel({ form }: PreviewPanelProps) {
  // idx: -1 = welcome, 0..N-1 = step, N = ending
  const [idx,     setIdx]     = useState<number>(-1);
  const [dir,     setDir]     = useState<number>(1);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const steps      = form.steps   ?? [];
  const hasWelcome = form.welcome_screen?.enabled ?? false;

  const atWelcome = idx === -1;
  const atEnding  = idx >= steps.length;

  const canGoBack = idx > -1 && !(idx === 0 && !hasWelcome);
  const canGoNext = !atEnding;

  // ── Navegação ──────────────────────────────────────────────────────────────

  const goNext = () => {
    if (!canGoNext) return;
    setDir(1);
    setIdx(i => i + 1);
  };
  const goPrev = () => {
    if (!canGoBack) return;
    setDir(-1);
    setIdx(i => i - 1);
  };
  const reset = () => {
    setDir(1);
    setIdx(hasWelcome ? -1 : 0);
    setAnswers({});
  };

  // ── Mapeamento para FormRenderer ───────────────────────────────────────────
  // idx=-1 → welcome, 0..N-1 → step, N → ending
  const screen: FormRendererScreen =
    atWelcome ? "welcome" :
    atEnding  ? "ending"  : "step";

  const currentStepIndex = Math.max(0, idx);

  const bg = form.theme?.backgroundColor || "var(--background)";

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center overflow-auto py-10 px-4 gap-6"
      style={{ background: "var(--background)" }}
    >
      {/* Phone mockup */}
      <div
        className="relative flex-shrink-0 overflow-hidden shadow-2xl"
        style={{
          width: 375,
          height: 700,
          borderRadius: 44,
          border: "6px solid rgba(255,255,255,0.10)",
          background: bg,
        }}
        aria-label="Preview do formulário"
        role="region"
      >
        {/* Notch */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 z-10"
          style={{
            width: 120,
            height: 28,
            background: "rgba(0,0,0,0.75)",
            borderRadius: "0 0 16px 16px",
          }}
          aria-hidden="true"
        />

        {/* Motor de renderização — mesmo que a página pública */}
        <div className="absolute inset-0 pt-7">
          <FormRenderer
            form={form}
            screen={screen}
            currentStepIndex={currentStepIndex}
            direction={dir}
            answers={answers}
            isSubmitting={false}
            canGoBack={canGoBack}
            onStart={goNext}
            onNext={goNext}
            onBack={goPrev}
            onRestart={reset}
            onAnswer={(stepId, value) => setAnswers(p => ({ ...p, [stepId]: value }))}
            mode="preview"
          />
        </div>
      </div>

      {/* Controles externos — específicos do preview */}
      <div className="flex items-center gap-4">
        <button
          onClick={goPrev}
          disabled={!canGoBack}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/10 disabled:opacity-25"
          style={{ border: "1px solid var(--border)" }}
          aria-label="Tela anterior"
        >
          <ChevronLeft size={16} style={{ color: "var(--muted-foreground)" }} aria-hidden="true" />
        </button>

        <span
          className="text-xs min-w-[80px] text-center"
          style={{ color: "var(--muted-foreground)" }}
        >
          {atWelcome
            ? "Boas-vindas"
            : atEnding
              ? "Encerramento"
              : `${idx + 1} / ${steps.length}`}
        </span>

        <button
          onClick={goNext}
          disabled={!canGoNext}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/10 disabled:opacity-25"
          style={{ border: "1px solid var(--border)" }}
          aria-label="Próxima tela"
        >
          <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} aria-hidden="true" />
        </button>

        <button
          onClick={reset}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
          style={{ border: "1px solid var(--border)" }}
          aria-label="Reiniciar preview"
          title="Reiniciar preview"
        >
          <RefreshCw size={14} style={{ color: "var(--muted-foreground)" }} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
