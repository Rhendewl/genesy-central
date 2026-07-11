"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, FileStack, Layers, ListChecks, Loader2, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { OnboardingSubNav } from "@/components/workspace/onboarding/OnboardingSubNav";
import { useOnboardingTemplates } from "@/hooks/useOnboardingTemplates";

export default function OnboardingTemplatesPage() {
  const router = useRouter();
  const { templates, isLoading, createTemplate, deleteTemplate } = useOnboardingTemplates();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setIsSaving(true);
    const result = await createTemplate({ name: name.trim(), description: description.trim() || undefined });
    setIsSaving(false);
    if (result.error || !result.template) {
      toast.error(result.error ?? "Erro ao criar template");
      return;
    }
    setModalOpen(false);
    setName("");
    setDescription("");
    router.push(`/workspace/onboarding/templates/${result.template.id}`);
  }

  async function handleDelete(id: string, templateName: string) {
    if (!window.confirm(`Excluir o template "${templateName}"? Onboardings já criados a partir dele não são afetados.`)) return;
    setDeletingId(id);
    const result = await deleteTemplate(id);
    setDeletingId(null);
    if (result.error) toast.error(result.error);
  }

  return (
    <div className="flex flex-col pb-24">
      <OnboardingSubNav />

      <div className="px-4 pb-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>Templates de Onboarding</h1>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Etapas e tarefas reutilizáveis para iniciar a implantação de um cliente.
            </p>
          </div>
          <motion.button
            onClick={() => setModalOpen(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="lc-btn flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            Novo Template
          </motion.button>
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <FileStack size={28} style={{ color: "var(--muted-foreground)" }} />
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum template ainda</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Clique em &quot;Novo Template&quot; para montar o processo de implantação.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div
                key={t.id}
                onClick={() => router.push(`/workspace/onboarding/templates/${t.id}`)}
                className="group relative cursor-pointer p-4 lc-card"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="flex-1 truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>{t.name}</h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleDelete(t.id, t.name); }}
                    disabled={deletingId === t.id}
                    className="rounded p-1 opacity-0 transition-opacity hover:bg-red-500/10 group-hover:opacity-100"
                  >
                    {deletingId === t.id
                      ? <Loader2 size={14} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
                      : <Trash2 size={14} style={{ color: "#e05c5c" }} />}
                  </button>
                </div>
                {t.description && (
                  <p className="mb-3 line-clamp-2 text-xs" style={{ color: "var(--muted-foreground)" }}>{t.description}</p>
                )}
                <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  <span className="flex items-center gap-1"><Layers size={12} />{t.stage_count ?? 0} etapas</span>
                  <span className="flex items-center gap-1"><ListChecks size={12} />{t.task_count ?? 0} tarefas</span>
                  {!t.is_active && (
                    <span className="rounded-full px-2 py-0.5" style={{ background: "var(--hover)" }}>Inativo</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 lc-scrim"
          style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl"
            style={{ background: "var(--bg-modal)", border: "1px solid var(--border-modal)", boxShadow: "0 24px 64px var(--shadow-modal)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-5">
              <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Novo template</p>
              <button onClick={() => setModalOpen(false)} className="rounded p-1 hover:bg-[var(--hover)]">
                <X size={16} style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Onboarding Genesy Completo"
                  autoFocus
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Descrição (opcional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="resize-none rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-full px-4 py-1.5 text-xs"
                style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={isSaving || !name.trim()}
                className="lc-btn flex items-center gap-1.5 px-4 py-1.5 text-xs disabled:opacity-40"
              >
                {isSaving && <Loader2 size={12} className="animate-spin" />}
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
