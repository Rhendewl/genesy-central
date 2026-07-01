"use client";

import { useState, useEffect } from "react";
import { Monitor, Smartphone, Palette } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Form } from "@/types";
import { FormRenderer } from "@/components/formularios/FormRenderer";
import type { FormRendererScreen } from "@/components/formularios/FormRenderer";
import { DeviceFrameMobile }  from "./device-frames/DeviceFrameMobile";
import { DeviceFrameTablet }  from "./device-frames/DeviceFrameTablet";
import { DeviceFrameDesktop } from "./device-frames/DeviceFrameDesktop";

// ── Tipos ──────────────────────────────────────────────────────────────────────

type Device = "desktop" | "mobile";

const DEVICE_CONFIG: Record<Device, { label: string; icon: React.ElementType }> = {
  desktop: { label: "Desktop", icon: Monitor    },
  mobile:  { label: "Mobile",  icon: Smartphone },
};

interface LivePreviewProps {
  form: Form;
  selectedId: string | null;
  onSelectTheme: () => void;
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function LivePreview({ form, selectedId, onSelectTheme }: LivePreviewProps) {
  const steps      = form.steps ?? [];
  const hasWelcome = form.welcome_screen?.enabled ?? false;

  const [device,    setDevice]    = useState<Device>("desktop");
  const [screen,    setScreen]    = useState<FormRendererScreen>(hasWelcome ? "welcome" : steps.length > 0 ? "step" : "ending");
  const [stepIndex, setStepIndex] = useState(0);
  const [dir,       setDir]       = useState(1);
  const [answers,   setAnswers]   = useState<Record<string, unknown>>({});

  // Sync preview quando a seleção da sidebar muda
  useEffect(() => {
    if (!selectedId || selectedId === "theme") return;

    if (selectedId === "welcome") { setDir(1); setScreen("welcome"); return; }
    if (selectedId === "ending")  { setDir(1); setScreen("ending");  return; }

    const idx = steps.findIndex(s => s.id === selectedId);
    if (idx !== -1) {
      setDir(idx >= stepIndex ? 1 : -1);
      setScreen("step");
      setStepIndex(idx);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ── Navegação interna ──────────────────────────────────────────────────────

  const canGoBack = (() => {
    if (screen === "welcome") return false;
    if (screen === "step")    return stepIndex > 0 || hasWelcome;
    if (screen === "ending")  return steps.length > 0 || hasWelcome;
    return false;
  })();

  const goNext = () => {
    if (screen === "ending") return;
    setDir(1);
    if (screen === "welcome") {
      if (steps.length > 0) { setScreen("step"); setStepIndex(0); }
      else                   { setScreen("ending"); }
    } else {
      if (stepIndex < steps.length - 1) { setStepIndex(i => i + 1); }
      else                               { setScreen("ending"); }
    }
  };

  const goBack = () => {
    setDir(-1);
    if (screen === "step") {
      if (stepIndex > 0) { setStepIndex(i => i - 1); }
      else if (hasWelcome) { setScreen("welcome"); }
    } else if (screen === "ending") {
      if (steps.length > 0) { setScreen("step"); setStepIndex(steps.length - 1); }
      else if (hasWelcome)   { setScreen("welcome"); }
    }
  };

  const reset = () => {
    setDir(1);
    setAnswers({});
    if (hasWelcome)        { setScreen("welcome"); }
    else if (steps.length) { setScreen("step"); setStepIndex(0); }
    else                   { setScreen("ending"); }
  };

  // ── Tema ───────────────────────────────────────────────────────────────────

  const resolvedBg = form.theme?.backgroundColor && !form.theme.backgroundColor.startsWith("var(")
    ? form.theme.backgroundColor
    : "#ffffff";
  const resolvedPrimary = form.theme?.primaryColor && !form.theme.primaryColor.startsWith("var(")
    ? form.theme.primaryColor
    : "#22c55e";

  const previewForm: Form = {
    ...form,
    theme: { ...form.theme, backgroundColor: resolvedBg, primaryColor: resolvedPrimary },
  };

  // ── Renderer JSX (único, reutilizado em todos os device frames) ───────────

  const renderer = (
    <FormRenderer
      form={previewForm}
      screen={screen}
      currentStepIndex={stepIndex}
      direction={dir}
      answers={answers}
      isSubmitting={false}
      canGoBack={canGoBack}
      onStart={goNext}
      onNext={goNext}
      onBack={goBack}
      onRestart={reset}
      onAnswer={(stepId, value) => setAnswers(p => ({ ...p, [stepId]: value }))}
      mode="preview"
    />
  );

  const themeActive = selectedId === "theme";

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      aria-label="Preview do formulário"
      role="region"
      style={{ background: "transparent" }}
    >
      {/* ── Toolbar ── */}
      <div
        className="flex items-center py-2 px-4 flex-shrink-0 gap-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Botão Tema */}
        <button
          onClick={onSelectTheme}
          aria-pressed={themeActive}
          aria-label="Abrir painel de tema"
          title="Tema"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all flex-shrink-0"
          style={{
            background: themeActive ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.05)",
            color:      themeActive ? "#a78bfa"                : "rgba(255,255,255,0.40)",
            border: `1px solid ${themeActive ? "rgba(167,139,250,0.32)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          <Palette size={13} aria-hidden="true" />
          <span>Tema</span>
        </button>

        {/* Separador */}
        <div className="flex-shrink-0" style={{ width: 1, height: 18, background: "rgba(255,255,255,0.09)" }} aria-hidden="true" />

        {/* Botões de dispositivo */}
        <div className="flex-1 flex items-center justify-center gap-1">
          {(Object.entries(DEVICE_CONFIG) as [Device, typeof DEVICE_CONFIG[Device]][]).map(([key, c]) => {
            const Icon   = c.icon;
            const active = device === key;
            return (
              <button
                key={key}
                onClick={() => setDevice(key)}
                title={c.label}
                aria-label={`Preview em ${c.label}`}
                aria-pressed={active}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={{
                  background: active ? "rgba(255,255,255,0.10)" : "transparent",
                  color:      active ? "var(--text-title)"      : "var(--muted-foreground)",
                  border: `1px solid ${active ? "rgba(255,255,255,0.14)" : "transparent"}`,
                }}
              >
                <Icon size={13} aria-hidden="true" />
                <span className="hidden sm:inline">{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Preview area ── */}
      <div className="flex-1 flex overflow-hidden" style={{ padding: device === "desktop" ? 32 : 24 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={device}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1   }}
            exit={{    opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {device === "mobile"  && <DeviceFrameMobile  bg={resolvedBg}>{renderer}</DeviceFrameMobile>}
            {device === "desktop" && (
              <div style={{ width: "100%", maxWidth: 1100, height: "100%" }}>
                <DeviceFrameDesktop bg={resolvedBg} slug={form.slug}>{renderer}</DeviceFrameDesktop>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
