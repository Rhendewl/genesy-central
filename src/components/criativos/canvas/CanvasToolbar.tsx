"use client";

import { ArrowLeft, Save, Play, Loader2, CheckCheck, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWorkflowStore } from "@/store/workflow";

interface CanvasToolbarProps {
  onSave: () => Promise<void>;
  onRun: () => void;
}

export function CanvasToolbar({ onSave, onRun }: CanvasToolbarProps) {
  const router = useRouter();
  const { projectName, isDirty, isSaving, executionState } = useWorkflowStore();
  const isRunning   = executionState === "running";
  const isCompleted = executionState === "completed";
  const isError     = executionState === "error";

  return (
    <div
      className="flex items-center shrink-0"
      style={{
        height: 52,
        // Padding responsivo: mais apertado em telas pequenas
        padding: "0 clamp(12px, 2.5vw, 20px)",
        gap: "clamp(6px, 1vw, 12px)",
        background: "rgba(3, 3, 7, 0.90)",
        borderBottom: "1px solid rgba(255,255,255,0.055)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.03), " +
          "0 4px 24px rgba(0,0,0,0.45)",
        zIndex: 50,
        // Garante que o toolbar não ultrapasse o container
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {/* ── Lado esquerdo ─────────────────────────────────────────────── */}
      <div className="flex items-center shrink-0" style={{ gap: "clamp(6px, 1vw, 12px)", minWidth: 0 }}>
        {/* Back */}
        <button
          onClick={() => router.push("/criativos")}
          className="flex items-center gap-1.5 shrink-0 transition-colors"
          style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, whiteSpace: "nowrap" }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)")}
        >
          <ArrowLeft size={13} />
          {/* Oculta "Projetos" em viewports muito estreitas */}
          <span className="hidden sm:inline" style={{ letterSpacing: "0.02em" }}>Projetos</span>
        </button>

        {/* Divider */}
        <div className="shrink-0" style={{ width: 1, height: 18, background: "rgba(255,255,255,0.07)" }} />

        {/* Project name — trunca antes de empurrar os botões */}
        <span
          className="truncate"
          style={{
            color: "rgba(255,255,255,0.75)",
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            // Cresce até 200px, mas encolhe quando necessário
            maxWidth: "clamp(80px, 18vw, 220px)",
            minWidth: 0,
            flexShrink: 1,
          }}
        >
          {projectName}
        </span>

        {/* Unsaved dot */}
        {isDirty && !isSaving && (
          <div
            className="shrink-0"
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "rgba(139,92,246,0.8)",
              boxShadow: "0 0 6px rgba(139,92,246,0.6)",
            }}
          />
        )}
      </div>

      {/* ── Spacer ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0" />

      {/* ── Lado direito ──────────────────────────────────────────────── */}
      <div className="flex items-center shrink-0" style={{ gap: "clamp(6px, 1vw, 10px)" }}>
        {/* Status badge — oculto em viewports muito estreitas */}
        {isCompleted && (
          <div
            className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0"
            style={{
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.2)",
              color: "#34D399",
              fontSize: 11,
              whiteSpace: "nowrap",
            }}
          >
            <CheckCheck size={11} />
            <span>Gerado</span>
          </div>
        )}
        {isError && (
          <div
            className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.18)",
              color: "#F87171",
              fontSize: 11,
              whiteSpace: "nowrap",
            }}
          >
            <AlertCircle size={11} />
            <span>Erro</span>
          </div>
        )}

        {/* Save */}
        <button
          onClick={onSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shrink-0"
          style={{
            background: isDirty && !isSaving ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.025)",
            border: `1px solid ${isDirty && !isSaving ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}`,
            color: isDirty && !isSaving ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.22)",
            fontSize: 12,
            cursor: isDirty && !isSaving ? "pointer" : "default",
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
          }}
        >
          {isSaving
            ? <Loader2 size={11} className="animate-spin" />
            : !isDirty
            ? <CheckCheck size={11} />
            : <Save size={11} />
          }
          {/* Texto só aparece a partir de sm */}
          <span className="hidden sm:inline">
            {isSaving ? "Salvando..." : "Salvar"}
          </span>
        </button>

        {/* Run */}
        <button
          onClick={onRun}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all shrink-0"
          style={{
            background: isRunning
              ? "rgba(139,92,246,0.12)"
              : "rgba(139,92,246,0.18)",
            border: `1px solid ${isRunning ? "rgba(139,92,246,0.25)" : "rgba(139,92,246,0.4)"}`,
            color: isRunning ? "rgba(167,139,250,0.55)" : "#C4B5FD",
            fontSize: 12,
            fontWeight: 500,
            cursor: isRunning ? "default" : "pointer",
            letterSpacing: "0.01em",
            boxShadow: isRunning ? "none" : "0 0 16px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
            whiteSpace: "nowrap",
          }}
        >
          {isRunning
            ? <Loader2 size={12} className="animate-spin" />
            : <Play size={12} />
          }
          {/* Em telas muito pequenas mostra só o ícone; sm+ mostra texto */}
          <span className="hidden sm:inline">
            {isRunning ? "Executando..." : "Executar"}
          </span>
        </button>
      </div>
    </div>
  );
}
