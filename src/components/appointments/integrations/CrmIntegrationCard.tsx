"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Users }                   from "lucide-react";
import type { AppointmentCrmSettings }      from "@/types/appointments";

interface Pipeline { id: string; name: string; }
interface Stage    { id: string; name: string; pipeline_id: string; }

interface Props { calendarId: string; }

export function CrmIntegrationCard({ calendarId }: Props) {
  const [cfg,        setCfg]        = useState<AppointmentCrmSettings | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [isSaving,   setIsSaving]   = useState(false);
  const [pipelines,  setPipelines]  = useState<Pipeline[]>([]);
  const [stages,     setStages]     = useState<Stage[]>([]);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [saveOk,     setSaveOk]     = useState(false);

  // Local form state
  const [enabled,    setEnabled]    = useState(false);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId,    setStageId]    = useState<string>("");

  const fetchConfig = useCallback(async () => {
    try {
      const res  = await fetch(`/api/appointments/calendars/${calendarId}/integrations/crm`);
      const data = await res.json() as { crm: AppointmentCrmSettings | null };
      const c    = data.crm;
      setCfg(c);
      setEnabled(c?.enabled    ?? false);
      setPipelineId(c?.pipeline_id ?? "");
      setStageId(c?.stage_id   ?? "");
    } finally {
      setIsLoading(false);
    }
  }, [calendarId]);

  useEffect(() => { void fetchConfig(); }, [fetchConfig]);

  // Fetch pipelines on mount
  useEffect(() => {
    fetch("/api/crm/pipelines")
      .then(r => r.json())
      .then((d: { pipelines?: Pipeline[] }) => setPipelines(d.pipelines ?? []))
      .catch(() => {});
  }, []);

  // Fetch stages when pipeline changes
  useEffect(() => {
    if (!pipelineId) { setStages([]); return; }
    fetch(`/api/crm/pipelines/${pipelineId}/stages`)
      .then(r => r.json())
      .then((d: { stages?: Stage[] }) => setStages(d.stages ?? []))
      .catch(() => { setStages([]); });
  }, [pipelineId]);

  async function handleSave() {
    setSaveError(null);
    setSaveOk(false);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/appointments/calendars/${calendarId}/integrations/crm`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ enabled, pipeline_id: pipelineId || null, stage_id: stageId || null }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; crm?: AppointmentCrmSettings };
      if (!res.ok) { setSaveError(data.error ?? "Erro ao salvar"); return; }
      setCfg(data.crm ?? null);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } finally {
      setIsSaving(false);
    }
  }

  const isDirty =
    enabled    !== (cfg?.enabled    ?? false)     ||
    pipelineId !== (cfg?.pipeline_id ?? "")       ||
    stageId    !== (cfg?.stage_id   ?? "");

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-4"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--accent)" }}
        >
          <Users size={20} style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            CRM
          </p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Cria ou move um lead no pipeline ao receber um agendamento
          </p>
        </div>
        {!isLoading && (
          <div className="ml-auto shrink-0">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: cfg?.enabled ? "var(--success, #22c55e)" : "var(--muted-foreground)" }}
            />
          </div>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: "var(--text-title)" }}>Ativar integração</p>
            <button
              onClick={() => setEnabled(v => !v)}
              aria-pressed={enabled}
              className="relative rounded-full transition-colors shrink-0"
              style={{ background: enabled ? "var(--primary)" : "var(--border)", width: "40px", height: "22px" }}
            >
              <span
                className="absolute top-0.5 left-0.5 rounded-full bg-white transition-transform shadow"
                style={{ width: "18px", height: "18px", transform: enabled ? "translateX(18px)" : "translateX(0)" }}
              />
            </button>
          </div>

          {/* Pipeline select */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
              Pipeline
            </label>
            <select
              value={pipelineId}
              onChange={e => { setPipelineId(e.target.value); setStageId(""); }}
              className="text-sm rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text-title)" }}
            >
              <option value="">Selecione um pipeline</option>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Stage select */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
              Etapa
            </label>
            <select
              value={stageId}
              onChange={e => setStageId(e.target.value)}
              disabled={!pipelineId || stages.length === 0}
              className="text-sm rounded-lg px-3 py-2 border outline-none disabled:opacity-50"
              style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text-title)" }}
            >
              <option value="">Selecione uma etapa</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {saveError && (
            <p className="text-xs" style={{ color: "#ef4444" }}>{saveError}</p>
          )}
          {saveOk && (
            <p className="text-xs" style={{ color: "#22c55e" }}>Salvo com sucesso.</p>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50 self-start"
            style={{ background: "#b0b8c1", color: "#000000" }}
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            Salvar
          </button>
        </div>
      )}
    </div>
  );
}
