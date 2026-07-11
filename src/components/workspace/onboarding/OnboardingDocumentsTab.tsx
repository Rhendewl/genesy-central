"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ONBOARDING_DOCUMENT_STATUSES, type OnboardingDocumentStatus, type OnboardingProjectDocument } from "@/types/onboarding";

const STATUS_COLOR: Record<OnboardingDocumentStatus, string> = {
  nao_solicitado: "#7c878e",
  solicitado:     "#e0a344",
  recebido:       "#4a8fd4",
  validado:       "#6b9b6f",
};

export function OnboardingDocumentsTab({ projectId, isAdmin }: { projectId: string; isAdmin: boolean }) {
  const [documents, setDocuments] = useState<OnboardingProjectDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");

  const fetchDocuments = useCallback(async () => {
    const res = await fetch(`/api/workspace/onboarding/projects/${projectId}/documents`);
    const json = await res.json() as { documents?: OnboardingProjectDocument[]; error?: string };
    if (res.ok && json.documents) setDocuments(json.documents);
    setIsLoading(false);
  }, [projectId]);

  useEffect(() => { void fetchDocuments(); }, [fetchDocuments]);

  async function handleStatusChange(docId: string, status: OnboardingDocumentStatus) {
    setDocuments((prev) => prev.map((d) => d.id === docId ? { ...d, status } : d));
    const res = await fetch(`/api/workspace/onboarding/projects/${projectId}/documents/${docId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (!res.ok) { toast.error("Erro ao atualizar status"); void fetchDocuments(); }
  }

  async function handleNotesBlur(docId: string, notes: string) {
    await fetch(`/api/workspace/onboarding/projects/${projectId}/documents/${docId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes }),
    });
  }

  async function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    const res = await fetch(`/api/workspace/onboarding/projects/${projectId}/documents`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }),
    });
    if (!res.ok) { toast.error("Erro ao adicionar item"); return; }
    setNewLabel("");
    void fetchDocuments();
  }

  async function handleDelete(docId: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    await fetch(`/api/workspace/onboarding/projects/${projectId}/documents/${docId}`, { method: "DELETE" });
  }

  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />;

  return (
    <div className="lc-card p-4">
      {documents.length === 0 && (
        <p className="py-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum item de documento/acesso ainda.</p>
      )}
      <div className="flex flex-col gap-2">
        {documents.map((doc) => (
          <div key={doc.id} className="group flex flex-col gap-2 rounded-lg p-2 hover:bg-[var(--hover)]">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm" style={{ color: "var(--text-title)" }}>{doc.label}</span>
              <select
                value={doc.status}
                onChange={(e) => void handleStatusChange(doc.id, e.target.value as OnboardingDocumentStatus)}
                className="rounded-full px-2 py-1 text-[11px] font-medium outline-none"
                style={{ background: `${STATUS_COLOR[doc.status]}18`, color: STATUS_COLOR[doc.status], border: `1px solid ${STATUS_COLOR[doc.status]}28` }}
              >
                {ONBOARDING_DOCUMENT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              {isAdmin && (
                <button onClick={() => void handleDelete(doc.id)} className="opacity-0 transition-opacity group-hover:opacity-100">
                  <X size={13} style={{ color: "var(--muted-foreground)" }} />
                </button>
              )}
            </div>
            <input
              defaultValue={doc.notes ?? ""}
              onBlur={(e) => void handleNotesBlur(doc.id, e.target.value)}
              placeholder="Observações (link, login, contato...)"
              className="rounded-lg bg-transparent px-1 py-1 text-xs outline-none placeholder:text-[var(--muted-foreground)]"
              style={{ color: "var(--muted-foreground)" }}
            />
          </div>
        ))}
      </div>
      {isAdmin && (
        <div className="mt-2 flex items-center gap-2 border-t pt-2" style={{ borderColor: "var(--glass-border)" }}>
          <Plus size={14} style={{ color: "var(--muted-foreground)" }} />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
            placeholder="Ex: Meta Ads, Google Ads, CRM, Drive..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
            style={{ color: "var(--text-title)" }}
          />
        </div>
      )}
    </div>
  );
}
