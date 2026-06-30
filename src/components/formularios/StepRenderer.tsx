"use client";

// ─────────────────────────────────────────────────────────────────────────────
// StepRenderer — fonte única de renderização de steps.
// Usado pelo editor (PreviewPanel) e pela página pública /form/[slug].
// Contém: validação, máscara de telefone, navegação por teclado, ARIA.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useId, useRef, useEffect } from "react";
import { Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { FormStep, FormTheme } from "@/types";

export interface StepRendererProps {
  step: FormStep;
  theme?: Partial<FormTheme>;
  value?: unknown;
  onChange?: (value: unknown) => void;
  onNext?: () => void;
  onBack?: () => void;
  stepIndex?: number;
  totalSteps?: number;
  canGoBack?: boolean;
}

// ── Utilitário: detecta fundo claro a partir de hex ───────────────────────────

function isLightBg(bg?: string): boolean {
  if (!bg || bg.startsWith("var(")) return false;
  const hex = bg.replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex;
  if (full.length !== 6) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

// ── Máscara de telefone ────────────────────────────────────────────────────────

function applyPhoneMask(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2)  return `(${d}`;
  if (d.length <= 6)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ── Validação ─────────────────────────────────────────────────────────────────

export function validateStep(step: FormStep, value: unknown): string | null {
  if (!step.required) return null;
  if (step.type === "statement" || step.type === "redirect") return null;

  switch (step.type) {
    case "name":
    case "short_text":
    case "long_text":
    case "number":
    case "date":
      if (!value || String(value).trim() === "") return "Este campo é obrigatório";
      return null;

    case "email": {
      const v = String(value ?? "").trim();
      if (!v) return "Este campo é obrigatório";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Digite um e-mail válido";
      return null;
    }

    case "phone": {
      const digits = String(value ?? "").replace(/\D/g, "");
      if (!digits) return "Este campo é obrigatório";
      if (digits.length < 10) return "Telefone inválido";
      return null;
    }

    case "single_choice":
      if (!value || value === "") return "Selecione uma opção";
      return null;

    case "multiple_choice":
      if (!Array.isArray(value) || value.length === 0) return "Selecione pelo menos uma opção";
      return null;

    case "rating":
      if (!value || (value as number) === 0) return "Por favor, dê uma avaliação";
      return null;

    case "file_upload":
      return "Faça upload de um arquivo";

    default:
      return null;
  }
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function StepRenderer({
  step,
  theme,
  value,
  onChange,
  onNext,
  onBack,
  stepIndex,
  totalSteps,
  canGoBack,
}: StepRendererProps) {
  const [error,     setError]     = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const uid     = useId();
  const errorId = `${uid}-error`;

  // Ref sempre aponta para o onNext mais recente — evita closure stale no setTimeout.
  const onNextRef = useRef(onNext);
  useEffect(() => { onNextRef.current = onNext; });

  // Timer de auto-advance (single_choice / rating) — cancelado no unmount para
  // evitar double-advance se o usuário navegar manualmente antes do timer disparar.
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current !== null) clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  const primary   = theme?.primaryColor ?? "var(--primary)";
  const light     = isLightBg(theme?.backgroundColor);
  // textColor explícito do tema tem prioridade sobre detecção de luminosidade
  const textColor = theme?.textColor ?? (light ? "#111827" : "var(--text-title)");
  const muted     = light ? "#6b7280" : "var(--muted-foreground)";
  const cardBg    = light ? "rgba(0,0,0,0.04)" : "var(--card)";
  const borderC   = light ? "rgba(0,0,0,0.12)"  : "var(--border)";
  const align     = (theme?.textAlign ?? "left") as React.CSSProperties["textAlign"];

  const btnRadius =
    theme?.buttonStyle === "pill"   ? "9999px" :
    theme?.buttonStyle === "square" ? "8px"    : "12px";

  const inputBase = "w-full px-4 py-3 rounded-xl outline-none transition-all text-base";

  // React-controlled border so re-renders don't reset the focus color.
  const inputBorderColor = isFocused ? primary : error ? "#ef4444" : borderC;
  const inputStyle: React.CSSProperties = {
    background: cardBg,
    border: `1px solid ${inputBorderColor}`,
    color: textColor,
    fontSize: 16,
  };

  const onFocusB = useCallback(() => setIsFocused(true),  []);
  const onBlurB  = useCallback(() => setIsFocused(false), []);

  const handleNext = useCallback(() => {
    const err = validateStep(step, value);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onNext?.();
  }, [step, value, onNext]);

  const handleChange = useCallback((val: unknown) => {
    setError(null);
    onChange?.(val);
  }, [onChange]);

  // Per-input Enter handler — NOT on the outer container to avoid double-fires
  // when a button (like "Continuar") is focused and Enter activates it.
  const onEnterKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    }
  }, [handleNext]);

  const onEnterKeyAllowShift = useCallback((e: React.KeyboardEvent) => {
    // long_text: plain Enter advances; Shift+Enter inserts newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    }
  }, [handleNext]);

  function renderInput() {
    const commonInputProps = {
      "aria-required":     step.required,
      "aria-invalid":      error ? (true as const) : undefined,
      "aria-describedby":  error ? errorId : undefined,
    };

    switch (step.type) {
      case "name":
        return (
          <input
            type="text"
            inputMode="text"
            autoComplete="name"
            autoCapitalize="words"
            className={inputBase}
            style={inputStyle}
            placeholder={step.placeholder || "Seu nome completo"}
            value={(value as string) ?? ""}
            autoFocus
            onChange={e => handleChange(e.target.value)}
            onFocus={onFocusB}
            onBlur={onBlurB}
            onKeyDown={onEnterKey}
            {...commonInputProps}
          />
        );

      case "short_text":
        return (
          <input
            type="text"
            className={inputBase}
            style={inputStyle}
            placeholder={step.placeholder || "Digite aqui..."}
            value={(value as string) ?? ""}
            autoFocus
            onChange={e => handleChange(e.target.value)}
            onFocus={onFocusB}
            onBlur={onBlurB}
            onKeyDown={onEnterKey}
            {...commonInputProps}
          />
        );

      case "long_text":
        return (
          <textarea
            rows={4}
            className={cn(inputBase, "resize-none leading-relaxed")}
            style={inputStyle}
            placeholder={step.placeholder || "Digite aqui..."}
            value={(value as string) ?? ""}
            autoFocus
            onChange={e => handleChange(e.target.value)}
            onFocus={onFocusB}
            onBlur={onBlurB}
            onKeyDown={onEnterKeyAllowShift}
            {...commonInputProps}
          />
        );

      case "email":
        return (
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            className={inputBase}
            style={inputStyle}
            placeholder={step.placeholder || "seu@email.com"}
            value={(value as string) ?? ""}
            autoFocus
            onChange={e => handleChange(e.target.value)}
            onFocus={onFocusB}
            onBlur={onBlurB}
            onKeyDown={onEnterKey}
            {...commonInputProps}
          />
        );

      case "phone":
        return (
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={inputBase}
            style={inputStyle}
            placeholder={step.placeholder || "(00) 00000-0000"}
            value={(value as string) ?? ""}
            autoFocus
            onChange={e => handleChange(applyPhoneMask(e.target.value))}
            onFocus={onFocusB}
            onBlur={onBlurB}
            onKeyDown={onEnterKey}
            {...commonInputProps}
          />
        );

      case "number":
        return (
          <input
            type="number"
            inputMode="decimal"
            className={inputBase}
            style={inputStyle}
            placeholder={step.placeholder || "0"}
            value={(value as string) ?? ""}
            autoFocus
            onChange={e => handleChange(e.target.value)}
            onFocus={onFocusB}
            onBlur={onBlurB}
            onKeyDown={onEnterKey}
            {...commonInputProps}
          />
        );

      case "date":
        return (
          <input
            type="date"
            className={inputBase}
            style={{ ...inputStyle, colorScheme: light ? "light" : "dark" } as React.CSSProperties}
            value={(value as string) ?? ""}
            onChange={e => handleChange(e.target.value)}
            onFocus={onFocusB}
            onBlur={onBlurB}
            onKeyDown={onEnterKey}
            {...commonInputProps}
          />
        );

      case "single_choice":
      case "multiple_choice": {
        const selected = Array.isArray(value)
          ? (value as string[])
          : value ? [value as string] : [];
        const isMulti = step.type === "multiple_choice";

        return (
          <div
            className="flex flex-col gap-2"
            role={isMulti ? "group" : "radiogroup"}
            aria-label={step.title}
            aria-required={step.required}
          >
            {(step.choices ?? []).map(c => {
              const sel = selected.includes(c.value);
              return (
                <motion.button
                  key={c.id}
                  type="button"
                  role={isMulti ? "checkbox" : "radio"}
                  aria-checked={sel}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (isMulti) {
                      handleChange(sel
                        ? selected.filter(v => v !== c.value)
                        : [...selected, c.value]);
                    } else {
                      handleChange(c.value);
                      if (autoAdvanceTimer.current !== null) clearTimeout(autoAdvanceTimer.current);
                      autoAdvanceTimer.current = setTimeout(() => {
                        autoAdvanceTimer.current = null;
                        if (!validateStep(step, c.value)) {
                          setError(null);
                          onNextRef.current?.();
                        }
                      }, 350);
                    }
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base text-left transition-colors"
                  style={{
                    background: sel ? `${primary}18` : cardBg,
                    border: `1px solid ${sel ? primary : borderC}`,
                    color: sel ? primary : textColor,
                    fontSize: 16,
                  }}
                >
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center"
                    style={{
                      borderColor: sel ? primary : muted,
                      background:  sel ? primary : "transparent",
                    }}
                    aria-hidden="true"
                  >
                    {sel && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  {c.label}
                </motion.button>
              );
            })}
          </div>
        );
      }

      case "rating": {
        const max = step.maxRating ?? 5;
        const cur = (value as number) ?? 0;
        return (
          <div
            className="flex gap-2 flex-wrap"
            role="group"
            aria-label={`Avaliação de 1 a ${max} estrelas`}
            aria-required={step.required}
          >
            {Array.from({ length: max }, (_, i) => i + 1).map(n => (
              <motion.button
                key={n}
                type="button"
                onClick={() => {
                  handleChange(n);
                  if (autoAdvanceTimer.current !== null) clearTimeout(autoAdvanceTimer.current);
                  autoAdvanceTimer.current = setTimeout(() => {
                    autoAdvanceTimer.current = null;
                    if (!step.required || n > 0) { setError(null); onNextRef.current?.(); }
                  }, 400);
                }}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                aria-label={`${n} estrela${n !== 1 ? "s" : ""}`}
                aria-pressed={n <= cur}
                className="transition-transform focus-visible:outline focus-visible:outline-2 rounded"
                style={{ outlineColor: primary }}
              >
                <Star
                  size={36}
                  style={{
                    color: n <= cur ? "#f59e0b" : muted,
                    fill:  n <= cur ? "#f59e0b" : "transparent",
                    transition: "color 0.15s, fill 0.15s",
                  }}
                />
              </motion.button>
            ))}
          </div>
        );
      }

      case "statement":
        return step.content ? (
          <p className="text-base leading-relaxed" style={{ color: muted }}>
            {step.content}
          </p>
        ) : null;

      case "redirect":
        return (
          <div
            className="px-4 py-3 rounded-xl text-sm font-mono"
            style={{ background: cardBg, border: `1px solid ${borderC}`, color: muted }}
          >
            → {step.content || "(URL não definida)"}
          </div>
        );

      case "file_upload":
        return (
          <label
            className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer transition-colors hover:border-current"
            style={{ borderColor: borderC, background: cardBg, color: muted }}
            aria-label="Área para upload de arquivo"
          >
            <input
              type="file"
              className="sr-only"
              onChange={() => handleChange("__file_selected__")}
              aria-required={step.required}
            />
            <p className="text-base font-medium mb-1" style={{ color: textColor }}>
              Clique para selecionar
            </p>
            <p className="text-sm" style={{ color: muted }}>
              ou arraste um arquivo aqui
            </p>
          </label>
        );

      default:
        return null;
    }
  }

  const showNextBtn = step.type !== "redirect" && step.type !== "single_choice" && step.type !== "rating";
  const showBackBtn = false;
  const btnLabel =
    step.type === "statement"   ? "Continuar" :
    step.type === "file_upload" ? "Enviar arquivo" : "Próximo →";

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Obrigatório */}
      {step.required && (
        <div className="flex justify-end text-sm">
          <span className="font-medium" style={{ color: primary }}>Obrigatório</span>
        </div>
      )}

      {/* Título + descrição */}
      <div style={{ textAlign: align }}>
        <h2
          className="font-bold leading-snug mb-2"
          style={{
            color: textColor,
            fontSize: theme?.titleSize ?? "1.25rem",
          }}
        >
          {step.title || "Sem título"}
        </h2>
        {step.description && (
          <p
            className="text-base"
            style={{ color: muted, fontSize: theme?.descriptionSize ?? "0.9375rem" }}
          >
            {step.description}
          </p>
        )}
      </div>

      {/* Input */}
      <div>{renderInput()}</div>

      {/* Mensagem de erro */}
      <AnimatePresence>
        {error && (
          <motion.p
            id={errorId}
            role="alert"
            aria-live="polite"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-sm font-medium -mt-2"
            style={{ color: "#ef4444" }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Ações — sem onKeyDown no container para evitar double-fire em botões */}
      {(showNextBtn || showBackBtn) && (
        <div
          className="flex items-center gap-3"
          style={{ justifyContent: align === "center" ? "center" : "flex-start" }}
        >
          {showBackBtn && (
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-3 text-base font-medium transition-all hover:opacity-80 active:scale-95"
              style={{
                borderRadius: btnRadius,
                border: `1px solid ${borderC}`,
                color: muted,
                background: "transparent",
              }}
              aria-label="Voltar para a pergunta anterior"
            >
              Voltar
            </button>
          )}
          {showNextBtn && (
            <button
              type="button"
              onClick={handleNext}
              className="px-7 py-3 text-base font-semibold transition-all hover:opacity-90 active:scale-95"
              style={{ borderRadius: btnRadius, background: primary, color: "#fff" }}
            >
              {btnLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
