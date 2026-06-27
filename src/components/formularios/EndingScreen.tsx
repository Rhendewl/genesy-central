"use client";

import React from "react";
import { motion } from "framer-motion";
import { Loader2, RotateCcw } from "lucide-react";
import type { FormEnding, FormTheme } from "@/types";

interface EndingScreenProps {
  ending: FormEnding | null;
  theme?: Partial<FormTheme>;
  isSubmitting?: boolean;
  onRestart?: () => void;
  mode?: "public" | "preview";
}

export const EndingScreen = React.memo(function EndingScreen({
  ending,
  theme,
  isSubmitting = false,
  onRestart,
  mode = "public",
}: EndingScreenProps) {
  const btnRadius =
    theme?.buttonStyle === "pill"   ? "9999px" :
    theme?.buttonStyle === "square" ? "8px"    : "12px";

  return (
    <div
      className="w-full max-w-lg flex flex-col items-center text-center gap-6"
      aria-labelledby="ending-title"
    >
      {/* Ícone de sucesso */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{ background: "rgba(34,197,94,0.15)" }}
        aria-hidden="true"
      >
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
          style={{ fontSize: 36 }}
        >
          ✓
        </motion.span>
      </motion.div>

      <div className="flex flex-col gap-3">
        <h2
          id="ending-title"
          className="font-bold"
          style={{
            color: "var(--text-title)",
            fontSize: "clamp(1.375rem, 4vw, 2rem)",
          }}
        >
          {ending?.title ?? "Obrigado!"}
        </h2>

        {ending?.description && (
          <p
            className="leading-relaxed max-w-sm mx-auto"
            style={{
              color: "var(--muted-foreground)",
              fontSize: "clamp(0.9375rem, 2.5vw, 1.0625rem)",
            }}
          >
            {ending.description}
          </p>
        )}
      </div>

      {/* Spinner de envio — apenas no modo público */}
      {mode === "public" && isSubmitting && (
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
          role="status"
          aria-live="polite"
          aria-label="Enviando respostas"
        >
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Enviando respostas...
        </div>
      )}

      {/* Botão de restart — não aparece durante submissão no modo público */}
      {onRestart && (mode === "preview" || !isSubmitting) && (
        <button
          onClick={onRestart}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all hover:opacity-80 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            borderRadius: btnRadius,
            border: "1px solid var(--border)",
            color: "var(--muted-foreground)",
            background: "transparent",
            outlineColor: "var(--primary)",
          }}
          aria-label="Preencher o formulário novamente"
        >
          <RotateCcw size={14} aria-hidden="true" />
          Preencher novamente
        </button>
      )}
    </div>
  );
});
