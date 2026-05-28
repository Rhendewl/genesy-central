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

  const isRunning = executionState === "running";

  return (
    <div
      className="flex items-center gap-3 px-4 shrink-0"
      style={{
        height: 52,
        background: "rgba(10,10,12,0.98)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
        zIndex: 50,
      }}
    >
      {/* Back */}
      <button
        onClick={() => router.push("/criativos")}
        className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        <ArrowLeft size={14} />
        <span>Projetos</span>
      </button>

      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

      {/* Project name */}
      <span className="text-sm font-medium truncate max-w-[220px]" style={{ color: "rgba(255,255,255,0.85)" }}>
        {projectName}
      </span>

      {/* Dirty indicator */}
      {isDirty && !isSaving && (
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
          • não salvo
        </span>
      )}

      <div className="flex-1" />

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={isSaving || !isDirty}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-all"
        style={{
          background: isDirty && !isSaving ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: isDirty && !isSaving ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)",
          cursor: isDirty && !isSaving ? "pointer" : "default",
        }}
      >
        {isSaving ? (
          <Loader2 size={12} className="animate-spin" />
        ) : !isDirty ? (
          <CheckCheck size={12} />
        ) : (
          <Save size={12} />
        )}
        {isSaving ? "Salvando..." : "Salvar"}
      </button>

      {/* Run button */}
      <button
        onClick={onRun}
        disabled={isRunning}
        className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-md transition-all"
        style={{
          background: isRunning ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.2)",
          border: `1px solid ${isRunning ? "rgba(16,185,129,0.3)" : "rgba(16,185,129,0.4)"}`,
          color: isRunning ? "rgba(16,185,129,0.6)" : "#6EE7B7",
          cursor: isRunning ? "default" : "pointer",
        }}
      >
        {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
        {isRunning ? "Executando..." : "Executar"}
      </button>

      {executionState === "error" && (
        <AlertCircle size={14} style={{ color: "#EF4444" }} />
      )}
      {executionState === "completed" && (
        <CheckCheck size={14} style={{ color: "#10B981" }} />
      )}
    </div>
  );
}
