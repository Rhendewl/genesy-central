"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FormRenderer — motor único de renderização de formulários.
//
// CONTRATOS DE ARQUITETURA (não violar):
// 1. Completamente agnóstico: sem fetch, Supabase, CRM, Analytics, Pixel, Webhooks.
// 2. Todo estado é externo: serializable para restore de sessão.
// 3. Toda comunicação é via callbacks: compatível com Logic Engine futuro.
// 4. Analytics via callbacks opcionais: zero acoplamento.
// 5. API estável: props nunca removidos, apenas adicionados (versionamento semântico).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Form, FormStep } from "@/types";
import { StepRenderer } from "./StepRenderer";
import { WelcomeScreen } from "./WelcomeScreen";
import { EndingScreen } from "./EndingScreen";
import { FormProgressBar } from "./FormProgressBar";

// ── Variantes de transição (constantes de módulo — nunca re-criadas) ──────────

const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

// Movimento lateral + fade
const VARIANTS = {
  enter: (dir: number) => ({ x: dir > 0 ? "60%" : "-60%", opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.3, ease: EASE } },
  exit:  (dir: number) => ({ x: dir > 0 ? "-60%" : "60%", opacity: 0, transition: { duration: 0.2, ease: EASE } }),
};

// Apenas fade — para prefers-reduced-motion
const VARIANTS_REDUCED = {
  enter: () => ({ opacity: 0, x: 0 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.15 } },
  exit:  () => ({ opacity: 0, x: 0, transition: { duration: 0.1 } }),
};

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export type FormRendererScreen = "welcome" | "step" | "ending";

/**
 * Estado serializable do renderer.
 * Toda esta estrutura pode ser armazenada (localStorage, DB) para restaurar
 * sessões, implementar autosave ou continuar de onde parou.
 */
export interface FormRendererState {
  screen: FormRendererScreen;
  currentStepIndex: number;
  /** 1 = avançando, -1 = voltando. Controla a direção da animação. */
  direction: number;
  answers: Record<string, unknown>;
  isSubmitting: boolean;
}

export interface FormRendererProps {
  // ── Dados ─────────────────────────────────────────────────────────────────
  form: Form;
  /**
   * ID da tela de encerramento selecionada pelo Logic Engine.
   * Quando ausente, usa o primeiro ending do formulário.
   */
  endingId?: string | null;

  // ── Estado controlado externamente (serializable) ─────────────────────────
  screen: FormRendererScreen;
  currentStepIndex: number;
  direction: number;
  answers: Record<string, unknown>;
  isSubmitting?: boolean;
  canGoBack: boolean;

  // ── Navegação — Logic Engine intercepta estes callbacks no futuro ─────────
  onStart: () => void;
  onNext: () => void;
  onBack: () => void;
  onRestart?: () => void;

  // ── Respostas ─────────────────────────────────────────────────────────────
  onAnswer: (stepId: string, value: unknown) => void;

  // ── Analytics — todos opcionais, zero coupling ────────────────────────────
  onRendererLoaded?: () => void;
  onWelcomeView?: () => void;
  onStepView?: (stepId: string, stepIndex: number) => void;
  onAnswerChanged?: (stepId: string, value: unknown) => void;
  onStepCompleted?: (stepId: string) => void;
  onComplete?: () => void;

  // ── Display ───────────────────────────────────────────────────────────────
  /** "preview" oculta spinner de submissão e sempre exibe botão de restart. */
  mode?: "public" | "preview";
}

// ── Componente ─────────────────────────────────────────────────────────────────

export const FormRenderer = React.memo(function FormRenderer({
  form,
  endingId,
  screen,
  currentStepIndex,
  direction,
  answers,
  isSubmitting = false,
  canGoBack,
  onStart,
  onNext,
  onBack,
  onRestart,
  onAnswer,
  onRendererLoaded,
  onWelcomeView,
  onStepView,
  onAnswerChanged,
  onStepCompleted,
  onComplete,
  mode = "public",
}: FormRendererProps) {

  // ── Variantes baseadas em prefers-reduced-motion ───────────────────────────
  const shouldReduce = useReducedMotion();
  const variants     = shouldReduce ? VARIANTS_REDUCED : VARIANTS;

  // ── Dados derivados ────────────────────────────────────────────────────────
  const steps: FormStep[] = form.steps ?? [];
  const currentStep       = steps[currentStepIndex] ?? null;
  const totalSteps        = steps.length;
  const primary           = form.theme?.primaryColor ?? "var(--primary)";
  const selectedEnding    = endingId
    ? (form.endings?.find(e => e.id === endingId) ?? form.endings?.[0] ?? null)
    : (form.endings?.[0] ?? null);

  const progressPct = totalSteps === 0
    ? 100
    : Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  // Chave única por tela — AnimatePresence usa para detectar troca de componente.
  const screenKey =
    screen === "welcome" ? "welcome" :
    screen === "ending"  ? "ending"  :
    `step-${currentStepIndex}`;

  // ── Refs de callbacks — evitam closures stale e tornam handlers estáveis ───

  const onStartRef          = useRef(onStart);
  const onNextRef           = useRef(onNext);
  const onBackRef           = useRef(onBack);
  const onAnswerRef         = useRef(onAnswer);
  const onAnswerChangedRef  = useRef(onAnswerChanged);
  const onStepCompletedRef  = useRef(onStepCompleted);
  const onRendererLoadedRef = useRef(onRendererLoaded);
  const onWelcomeViewRef    = useRef(onWelcomeView);
  const onStepViewRef       = useRef(onStepView);
  const onCompleteRef       = useRef(onComplete);
  const currentStepRef      = useRef(currentStep);

  useEffect(() => { onStartRef.current         = onStart; });
  useEffect(() => { onNextRef.current          = onNext; });
  useEffect(() => { onBackRef.current          = onBack; });
  useEffect(() => { onAnswerRef.current        = onAnswer; });
  useEffect(() => { onAnswerChangedRef.current = onAnswerChanged; });
  useEffect(() => { onStepCompletedRef.current = onStepCompleted; });
  useEffect(() => { onRendererLoadedRef.current = onRendererLoaded; });
  useEffect(() => { onWelcomeViewRef.current   = onWelcomeView; });
  useEffect(() => { onStepViewRef.current      = onStepView; });
  useEffect(() => { onCompleteRef.current      = onComplete; });
  useEffect(() => { currentStepRef.current     = currentStep; });

  // ── Analytics: onRendererLoaded — dispara uma única vez ───────────────────
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      console.log("[FormRenderer] mounted, screen=", screen, "steps=", steps.length, "currentStep=", currentStep?.id ?? null, "theme.bg=", form.theme?.backgroundColor);
      onRendererLoadedRef.current?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fallback defensivo: screen=welcome mas welcome_screen é null ────────────
  // O hook nunca deveria chegar aqui nesse estado, mas se chegar, avança para o step.
  useEffect(() => {
    if (screen === "welcome" && !form.welcome_screen) {
      console.warn("[FormRenderer] screen=welcome but form.welcome_screen is null → forcing start");
      onStartRef.current();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, form.welcome_screen]);

  // ── Analytics: eventos de troca de tela ───────────────────────────────────
  useEffect(() => {
    if (screen === "welcome") {
      onWelcomeViewRef.current?.();
    } else if (screen === "step" && currentStepRef.current) {
      onStepViewRef.current?.(currentStepRef.current.id, currentStepIndex);
    } else if (screen === "ending") {
      onCompleteRef.current?.();
    }
  // screenKey captura todas as transições: welcome→step-0→step-1→ending e restart
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenKey]);

  // ── Handlers estáveis — sem closures em props voláteis ────────────────────

  /** Encaminha resposta e emite onAnswerChanged para camada de analytics. */
  const handleAnswer = useCallback((stepId: string, value: unknown) => {
    onAnswerRef.current(stepId, value);
    onAnswerChangedRef.current?.(stepId, value);
  }, []);

  /**
   * Emite onStepCompleted e encaminha para o controlador de navegação.
   * No futuro: Logic Engine intercepta onNext e decide o target.
   */
  const handleNext = useCallback(() => {
    if (currentStepRef.current) {
      onStepCompletedRef.current?.(currentStepRef.current.id);
    }
    onNextRef.current();
  }, []);

  /** Encaminha para o controlador de navegação. */
  const handleBack = useCallback(() => { onBackRef.current(); }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col w-full h-full"
      role="main"
      aria-label={form.name || "Formulário"}
    >
      {/* Barra de progresso — visível apenas durante steps */}
      {form.theme?.progressBar !== false && screen === "step" && totalSteps > 0 && (
        <FormProgressBar pct={progressPct} color={primary} />
      )}

      {/* Área de conteúdo com transições */}
      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={screenKey}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 flex items-center justify-center p-6"
            style={{ paddingTop: screen === "step" ? "3rem" : "1.5rem" }}
          >

            {/* Tela de boas-vindas */}
            {screen === "welcome" && form.welcome_screen && (
              <WelcomeScreen
                welcome={form.welcome_screen}
                theme={form.theme}
                onStart={onStart}
              />
            )}

            {/* Step */}
            {screen === "step" && currentStep && (
              <div className="w-full max-w-lg">
                <StepRenderer
                  step={currentStep}
                  theme={form.theme}
                  value={answers[currentStep.id]}
                  onChange={v => handleAnswer(currentStep.id, v)}
                  onNext={handleNext}
                  onBack={handleBack}
                  stepIndex={currentStepIndex}
                  totalSteps={totalSteps}
                  canGoBack={canGoBack}
                  mode={mode}
                  formSteps={steps}
                  formAnswers={answers}
                />
              </div>
            )}

            {/* Tela de encerramento */}
            {screen === "ending" && (
              <EndingScreen
                ending={selectedEnding}
                theme={form.theme}
                isSubmitting={isSubmitting}
                onRestart={onRestart}
                mode={mode}
              />
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
});
