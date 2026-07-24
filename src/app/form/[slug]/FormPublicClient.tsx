"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, WifiOff, AlertCircle } from "lucide-react";

import { useFormularioRenderer } from "@/hooks/useFormularioRenderer";
import { FormRenderer } from "@/components/formularios/FormRenderer";
import type { FormRendererScreen } from "@/components/formularios/FormRenderer";
import type { Form } from "@/types";

// ── Componente ────────────────────────────────────────────────────────────────

export function FormPublicClient({ slug, initialForm }: { slug: string; initialForm: Form }) {
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
  } = useFormularioRenderer(slug, initialForm);

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
  // Resolve cores para valores concretos — nunca CSS vars no contexto público,
  // pois o visitante pode não ter o tema da plataforma carregado.
  const bg = form?.theme?.backgroundColor && !form.theme.backgroundColor.startsWith("var(")
    ? form.theme.backgroundColor
    : "#ffffff";
  const primary = form?.theme?.primaryColor && !form.theme.primaryColor.startsWith("var(")
    ? form.theme.primaryColor
    : "#22c55e";

  // Tema resolvido: garante que o FormRenderer e os renderers internos usem
  // os mesmos valores concretos que o container externo.
  const resolvedTheme = { ...(form?.theme ?? {}), backgroundColor: bg, primaryColor: primary };

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
    console.log("[FormPublicPage] render: loading");
    return (
      <div
        className="h-dvh flex items-center justify-center"
        style={{ background: "#ffffff" }}
        role="status"
        aria-label="Carregando formulário"
      >
        <Loader2
          size={32}
          className="animate-spin"
          style={{ color: "#22c55e" }}
          aria-hidden="true"
        />
      </div>
    );
  }

  // ── Não encontrado ─────────────────────────────────────────────────────────
  // Cores hardcoded: este estado não tem acesso ao tema do formulário.
  // Usar CSS vars aqui causaria texto invisível no dark mode (html.dark).
  if (screen === "not_found") {
    console.log("[FormPublicPage] render: not_found");
    return (
      <div
        className="h-dvh flex flex-col items-center justify-center gap-3 p-8 text-center"
        style={{ background: "#ffffff" }}
      >
        <p
          className="text-xl font-semibold"
          style={{ color: "#111827" }}
        >
          Formulário não encontrado
        </p>
        <p className="text-base" style={{ color: "#6b7280" }}>
          Este link pode estar inválido ou o formulário foi desativado.
        </p>
      </div>
    );
  }

  // ── Erro de submissão — após todas as tentativas ───────────────────────────
  // Cores hardcoded: usa bg do formulário (disponível) mas texto sem CSS vars.
  if (screen === "error") {
    console.log("[FormPublicPage] render: error, isOnline:", isOnline);
    const errBg = bg;
    const errBtnRadius =
      form?.theme?.buttonStyle === "pill"   ? "9999px" :
      form?.theme?.buttonStyle === "square" ? "8px"    : "12px";
    return (
      <div
        className="h-dvh flex flex-col items-center justify-center gap-6 p-8 text-center"
        style={{ background: errBg }}
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
          <p className="text-xl font-semibold" style={{ color: "#111827" }}>
            Erro ao enviar
          </p>
          <p className="text-sm max-w-xs" style={{ color: "#6b7280" }}>
            {isOnline
              ? "Não foi possível enviar suas respostas. Suas respostas estão salvas."
              : "Sem conexão com a internet. Tentaremos novamente quando a conexão for restaurada."}
          </p>
        </div>

        {isOnline && (
          <button
            onClick={retrySubmit}
            className="px-6 py-3 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: primary, color: "#fff", borderRadius: errBtnRadius, outlineColor: primary }}
            aria-label="Tentar enviar novamente"
          >
            Tentar novamente
          </button>
        )}

        {!isOnline && (
          <div className="flex items-center gap-2 text-sm" style={{ color: "#6b7280" }}>
            <WifiOff size={14} aria-hidden="true" />
            Aguardando conexão...
          </div>
        )}
      </div>
    );
  }

  // ── Formulário ─────────────────────────────────────────────────────────────
  if (!form) {
    console.warn("[FormPublicPage] screen=", screen, "but form is null → null render");
    return null;
  }

  console.log("[FormPublicPage] render: screen=", screen, "rendererScreen=", rendererScreen, "bg=", bg, "steps=", form.steps?.length, "welcome=", form.welcome_screen?.enabled);

  return (
    <div
      className="h-dvh flex flex-col overflow-hidden"
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
          form={{ ...form, theme: resolvedTheme }}
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

      {/* Rodapé discreto — cor calculada com base no fundo do tema */}
      <footer
        className="py-4 text-center text-xs flex-shrink-0"
        style={{ color: bg === "#ffffff" ? "#9ca3af" : "rgba(255,255,255,0.35)" }}
      >
        Formulário criado com Genesy
      </footer>
    </div>
  );
}
