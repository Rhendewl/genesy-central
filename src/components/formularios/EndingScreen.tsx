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

export const EndingScreen = React.memo(function EndingScreen({
  ending,
  theme,
  isSubmitting = false,
  onRestart,
  mode = "public",
}: EndingScreenProps) {
  const light     = isLightBg(theme?.backgroundColor);
  const textColor = theme?.textColor ?? (light ? "#111827" : "var(--text-title)");
  const muted     = light ? "#6b7280" : "var(--muted-foreground)";
  const borderC   = light ? "rgba(0,0,0,0.12)" : "var(--border)";

  const btnRadius =
    theme?.buttonStyle === "pill"   ? "9999px" :
    theme?.buttonStyle === "square" ? "8px"    : "12px";

  const align      = (theme?.textAlign ?? "center") as React.CSSProperties["textAlign"];
  const alignItems =
    theme?.textAlign === "left"  ? "flex-start" :
    theme?.textAlign === "right" ? "flex-end"   : "center";

  return (
    <div
      className="w-full max-w-lg flex flex-col gap-6"
      style={{ alignItems }}
      aria-labelledby="ending-title"
    >
      {/* Ícone de sucesso — sempre centralizado */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="w-16 h-16 rounded-2xl flex items-center justify-center self-center"
        style={{ background: "rgba(34,197,94,0.15)" }}
        aria-hidden="true"
      >
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
          style={{ fontSize: 28 }}
        >
          ✓
        </motion.span>
      </motion.div>

      {/* Texto */}
      <div className="flex flex-col gap-2" style={{ textAlign: align }}>
        <h2
          id="ending-title"
          style={{
            color: textColor,
            fontSize: "1.375rem",
            fontWeight: 600,
            lineHeight: 1.2,
          }}
        >
          {ending?.title ?? "Obrigado!"}
        </h2>

        {ending?.description && (
          <p
            style={{
              color: muted,
              fontSize: "0.875rem",
              lineHeight: 1.65,
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
          style={{ color: muted }}
          role="status"
          aria-live="polite"
          aria-label="Enviando respostas"
        >
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Enviando respostas...
        </div>
      )}

      {/* Botão de restart — desabilitado em modo público */}
      {onRestart && mode === "preview" && (
        <button
          onClick={onRestart}
          className="flex items-center gap-2 text-sm font-medium transition-all hover:opacity-80 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            borderRadius: btnRadius,
            border: `1px solid ${borderC}`,
            color: muted,
            background: "transparent",
            outlineColor: "var(--primary)",
            padding: "0.625rem 1.25rem",
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
