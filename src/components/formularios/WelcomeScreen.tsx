"use client";

import React, { useRef, useEffect } from "react";
import type { FormWelcomeScreen, FormTheme } from "@/types";

interface WelcomeScreenProps {
  welcome: FormWelcomeScreen;
  theme?: Partial<FormTheme>;
  onStart: () => void;
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

// Detecta se a string é HTML (vem do TipTap) ou texto puro
function isHtml(s?: string): boolean {
  return !!s && s.trimStart().startsWith("<");
}

// Remove <p> externo único — usado para renderizar título inline em <h1>
function stripOuterP(html: string): string {
  return html.replace(/^<p>([\s\S]*)<\/p>$/, "$1").trim();
}

export const WelcomeScreen = React.memo(function WelcomeScreen({
  welcome,
  theme,
  onStart,
}: WelcomeScreenProps) {
  const btnRef  = useRef<HTMLButtonElement>(null);
  const primary = theme?.primaryColor ?? "var(--primary)";
  const light   = isLightBg(theme?.backgroundColor);

  const btnRadius =
    theme?.buttonStyle === "pill"   ? "9999px" :
    theme?.buttonStyle === "square" ? "8px"    : "14px";

  // textColor explícito tem prioridade sobre a detecção de luminosidade
  const titleColor = theme?.textColor ?? (light ? "#111827" : "var(--text-title)");
  const descColor  = theme?.textColor ?? (light ? "#6b7280" : "var(--muted-foreground)");

  // Alinhamento: do tema (default center para tela de boas-vindas)
  const align      = (theme?.textAlign ?? "center") as React.CSSProperties["textAlign"];
  const alignItems =
    theme?.textAlign === "left"  ? "flex-start" :
    theme?.textAlign === "right" ? "flex-end"   : "center";

  useEffect(() => { btnRef.current?.focus(); }, []);

  const titleIsHtml = isHtml(welcome.title);
  const descIsHtml  = isHtml(welcome.description);
  const hasDesc     = !!welcome.description;

  return (
    <div
      className="w-full max-w-lg flex flex-col"
      style={{ alignItems, textAlign: align }}
      aria-labelledby="welcome-title"
    >
      {/* Imagem / Logo */}
      {welcome.imageUrl && (
        <img
          src={welcome.imageUrl}
          alt="Logo ou imagem do formulário"
          className="object-contain"
          style={{
            maxHeight: 56,
            maxWidth: 140,
            marginBottom: 28,
            alignSelf: alignItems,
          }}
        />
      )}

      {/* Título */}
      {welcome.title && (
        titleIsHtml ? (
          <h1
            id="welcome-title"
            className="rich-welcome-title"
            style={{
              color: titleColor,
              fontSize: "1.5rem",
              fontWeight: 600,
              lineHeight: 1.18,
              marginBottom: hasDesc ? "0.75rem" : "1.75rem",
            }}
            dangerouslySetInnerHTML={{ __html: stripOuterP(welcome.title) }}
          />
        ) : (
          <h1
            id="welcome-title"
            style={{
              color: titleColor,
              fontSize: "1.5rem",
              fontWeight: 600,
              lineHeight: 1.18,
              marginBottom: hasDesc ? "0.75rem" : "1.75rem",
            }}
          >
            {welcome.title}
          </h1>
        )
      )}

      {/* Descrição */}
      {hasDesc && (
        descIsHtml ? (
          <div
            className="rich-welcome-desc"
            style={{
              color: descColor,
              fontSize: "0.9375rem",
              lineHeight: 1.65,
              marginBottom: "1.75rem",
              // textAlign do tema é o default; inline styles do TipTap sobrescrevem por parágrafo
            }}
            dangerouslySetInnerHTML={{ __html: welcome.description! }}
          />
        ) : (
          <p
            style={{
              color: descColor,
              fontSize: "0.9375rem",
              lineHeight: 1.65,
              marginBottom: "1.75rem",
            }}
          >
            {welcome.description}
          </p>
        )
      )}

      {/* Botão */}
      <button
        ref={btnRef}
        onClick={onStart}
        className="font-semibold transition-all hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          background: primary,
          color: "#fff",
          fontSize: "0.9375rem",
          borderRadius: btnRadius,
          outlineColor: primary,
          paddingTop: "0.875rem",
          paddingBottom: "0.875rem",
          paddingLeft: "2.5rem",
          paddingRight: "2.5rem",
          minWidth: 160,
          alignSelf: alignItems,
        }}
        aria-label={`${welcome.buttonText || "Começar"} — iniciar formulário`}
      >
        {welcome.buttonText || "Começar"}
      </button>
    </div>
  );
});
