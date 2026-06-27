"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Loader2, WifiOff, AlertCircle } from "lucide-react";

import { useFormularioRenderer } from "@/hooks/useFormularioRenderer";
import { FormRenderer } from "@/components/formularios/FormRenderer";
import type { FormRendererScreen } from "@/components/formularios/FormRenderer";

// ── Componente ────────────────────────────────────────────────────────────────

export default function FormPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const {
    form,
    screen,
    currentStepIndex,
    answers,
    endingId,
    isOnline,
    canGoBack,
    startForm,
    goNext,
    goBack,
    setAnswer,
    submitForm,
    retrySubmit,
    restart,
  } = useFormularioRenderer(slug);

  // ── Direção da animação ────────────────────────────────────────────────────
  const [direction, setDirection] = useState(1);

  const handleStart = useCallback(() => { setDirection(1);  startForm(); }, [startForm]);
  const handleNext  = useCallback(() => { setDirection(1);  goNext();   }, [goNext]);
  const handleBack  = useCallback(() => { setDirection(-1); goBack();   }, [goBack]);
  const handleRestart = useCallback(() => { setDirection(1); restart(); }, [restart]);

  // ── Submissão automática ao atingir a tela de encerramento ────────────────
  // Ref pattern evita closure stale quando submitForm é recriado (ex: isOnline muda).
  const submitFormRef = useRef(submitForm);
  useEffect(() => { submitFormRef.current = submitForm; });

  useEffect(() => {
    if (screen === "ending") {
      submitFormRef.current();
    }
  }, [screen]);

  // ── Dados derivados ────────────────────────────────────────────────────────
  const bg      = form?.theme?.backgroundColor ?? "var(--background)";
  const primary = form?.theme?.primaryColor    ?? "var(--primary)";

  // Mapeia screen do hook → FormRendererScreen (welcome / step / ending)
  // submitting e submitted também renderizam a tela de encerramento
  const rendererScreen: FormRendererScreen =
    screen === "welcome"                   ? "welcome" :
    screen === "ending"   ||
    screen === "submitting" ||
    screen === "submitted"                 ? "ending"  : "step";

  const isSubmitting = screen === "submitting";

  // ── Loading ────────────────────────────────────────────────────────────────
  if (screen === "loading") {
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center"
        style={{ background: bg }}
        role="status"
        aria-label="Carregando formulário"
      >
        <Loader2
          size={32}
          className="animate-spin"
          style={{ color: primary }}
          aria-hidden="true"
        />
      </div>
    );
  }

  // ── Não encontrado ─────────────────────────────────────────────────────────
  if (screen === "not_found") {
    return (
      <div
        className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 p-8 text-center"
        style={{ background: bg }}
      >
        <p
          className="text-xl font-semibold"
          style={{ color: "var(--text-title)" }}
        >
          Formulário não encontrado
        </p>
        <p className="text-base" style={{ color: "var(--muted-foreground)" }}>
          Este link pode estar inválido ou o formulário foi desativado.
        </p>
      </div>
    );
  }

  // ── Erro de submissão — após todas as tentativas ───────────────────────────
  if (screen === "error") {
    return (
      <div
        className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 p-8 text-center"
        style={{ background: bg }}
        role="alert"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.12)" }}
          aria-hidden="true"
        >
          <AlertCircle size={28} style={{ color: "#ef4444" }} />
        </div>

        <div className="flex flex-col gap-2">
          <p
            className="text-xl font-semibold"
            style={{ color: "var(--text-title)" }}
          >
            Erro ao enviar
          </p>
          <p className="text-sm max-w-xs" style={{ color: "var(--muted-foreground)" }}>
            {isOnline
              ? "Não foi possível enviar suas respostas. Suas respostas estão salvas."
              : "Sem conexão com a internet. Tentaremos novamente quando a conexão for restaurada."}
          </p>
        </div>

        {isOnline && (
          <button
            onClick={retrySubmit}
            className="px-6 py-3 text-sm font-semibold rounded-xl transition-all hover:opacity-90 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              background:    primary,
              color:         "#fff",
              outlineColor:  primary,
              borderRadius:
                form?.theme?.buttonStyle === "pill"   ? "9999px" :
                form?.theme?.buttonStyle === "square" ? "8px"    : "12px",
            }}
            aria-label="Tentar enviar novamente"
          >
            Tentar novamente
          </button>
        )}

        {!isOnline && (
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            <WifiOff size={14} aria-hidden="true" />
            Aguardando conexão...
          </div>
        )}
      </div>
    );
  }

  // ── Formulário ─────────────────────────────────────────────────────────────
  if (!form) return null;

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: bg }}
    >
      {/* Banner de conexão perdida — visível durante o preenchimento */}
      {!isOnline && screen === "step" && (
        <div
          className="flex items-center justify-center gap-2 py-2 text-xs font-medium flex-shrink-0"
          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
          role="alert"
          aria-live="polite"
        >
          <WifiOff size={12} aria-hidden="true" />
          Sem conexão — suas respostas estão salvas localmente
        </div>
      )}

      <div className="flex-1 flex flex-col">
        <FormRenderer
          form={form}
          endingId={endingId}
          screen={rendererScreen}
          currentStepIndex={currentStepIndex}
          direction={direction}
          answers={answers}
          isSubmitting={isSubmitting}
          canGoBack={canGoBack}
          onStart={handleStart}
          onNext={handleNext}
          onBack={handleBack}
          onRestart={handleRestart}
          onAnswer={setAnswer}
          mode="public"
        />
      </div>

      {/* Rodapé discreto */}
      <footer
        className="py-4 text-center text-xs flex-shrink-0"
        style={{ color: "var(--muted-foreground)" }}
      >
        Formulário criado com Genesy
      </footer>
    </div>
  );
}
