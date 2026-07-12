"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import { useOnboardingTemplates } from "@/hooks/useOnboardingTemplates";
import type { NewOnboardingProject, OnboardingProject } from "@/types/onboarding";

interface NewOnboardingWizardProps {
  onClose: () => void;
  onCreate: (data: NewOnboardingProject) => Promise<{ error: string | null; project: OnboardingProject | null }>;
}

export function NewOnboardingWizard({ onClose, onCreate }: NewOnboardingWizardProps) {
  const { clients } = useAgencyClients();
  const { templates } = useOnboardingTemplates();

  const [clientId,   setClientId]   = useState("");
  const [templateId, setTemplateId] = useState("");
  const [name,        setName]        = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [startDate,  setStartDate]  = useState(new Date().toISOString().slice(0, 10));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTemplates = templates.filter((t) => t.is_active);

  useEffect(() => {
    if (nameTouched) return;
    const client = clients.find((c) => c.id === clientId);
    const template = templates.find((t) => t.id === templateId);
    if (client) setName(template ? `${client.name} — ${template.name}` : client.name);
  }, [clientId, templateId, clients, templates, nameTouched]);

  async function handleCreate() {
    if (!clientId) { setError("Selecione um cliente"); return; }
    if (!name.trim()) { setError("Nome é obrigatório"); return; }
    setIsSaving(true);
    setError(null);
    const result = await onCreate({
      name:        name.trim(),
      client_id:   clientId,
      template_id: templateId || undefined,
      start_date:  startDate,
    });
    setIsSaving(false);
    if (result.error) { setError(result.error); return; }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 lc-scrim"
      style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--bg-modal)", border: "1px solid var(--border-modal)", boxShadow: "0 24px 64px var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Novo Onboarding</p>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--hover)]">
            <X size={16} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Cliente</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
            >
              <option value="">Selecione...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Template</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
            >
              <option value="">Sem template (projeto vazio)</option>
              {activeTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Nome do onboarding</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setNameTouched(true); }}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Data de início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
            />
          </div>

          {error && <p className="text-xs" style={{ color: "#e05c5c" }}>{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
          <button
            onClick={onClose}
            className="rounded-full px-4 py-1.5 text-xs"
            style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={isSaving}
            className="lc-btn flex items-center gap-1.5 px-4 py-1.5 text-xs disabled:opacity-40"
          >
            {isSaving && <Loader2 size={12} className="animate-spin" />}
            Criar Onboarding
          </button>
        </div>
      </div>
    </div>
  );
}
