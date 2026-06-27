"use client";

import React, { useRef, useEffect } from "react";
import type { FormWelcomeScreen, FormTheme } from "@/types";

interface WelcomeScreenProps {
  welcome: FormWelcomeScreen;
  theme?: Partial<FormTheme>;
  onStart: () => void;
}

export const WelcomeScreen = React.memo(function WelcomeScreen({
  welcome,
  theme,
  onStart,
}: WelcomeScreenProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const primary = theme?.primaryColor ?? "var(--primary)";
  const btnRadius =
    theme?.buttonStyle === "pill"   ? "9999px" :
    theme?.buttonStyle === "square" ? "8px"    : "14px";

  // Move focus to the CTA when the screen becomes visible
  useEffect(() => { btnRef.current?.focus(); }, []);

  return (
    <div
      className="w-full max-w-lg flex flex-col items-center text-center gap-6"
      aria-labelledby="welcome-title"
    >
      {welcome.title && (
        <h1
          id="welcome-title"
          className="font-bold leading-tight"
          style={{
            color: "var(--text-title)",
            fontSize: "clamp(1.5rem, 5vw, 2.25rem)",
          }}
        >
          {welcome.title}
        </h1>
      )}

      {welcome.description && (
        <p
          className="leading-relaxed max-w-md"
          style={{
            color: "var(--muted-foreground)",
            fontSize: "clamp(0.9375rem, 2.5vw, 1.125rem)",
          }}
        >
          {welcome.description}
        </p>
      )}

      <button
        ref={btnRef}
        onClick={onStart}
        className="mt-2 px-10 py-4 font-semibold transition-all hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          background: primary,
          color: "#fff",
          fontSize: 16,
          borderRadius: btnRadius,
          outlineColor: primary,
          minWidth: 180,
          minHeight: 52,
        }}
        aria-label={`${welcome.buttonText || "Começar"} — iniciar formulário`}
      >
        {welcome.buttonText || "Começar"}
      </button>
    </div>
  );
});
