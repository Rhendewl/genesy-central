"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, MoreHorizontal, Trash2, Archive,
  Clock, Copy, EyeOff, X, Loader2, MessageSquare,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useFormularios } from "@/hooks/useFormularios";
import { toast } from "sonner";
import type { Form } from "@/types";

const STATUS_LABEL: Record<string, string> = {
  draft:     "Inativo",
  published: "Ativo",
  archived:  "Arquivado",
  disabled:  "Inativo",
};

const STATUS_COLOR: Record<string, string> = {
  draft:     "rgba(255,255,255,0.35)",
  published: "#22c55e",
  archived:  "rgba(255,255,255,0.25)",
  disabled:  "rgba(255,255,255,0.35)",
};

// ── Card de formulário ─────────────────────────────────────────────────────────

function FormCard({
  form,
  onDelete,
  onArchive,
  onDuplicate,
  onToggleStatus,
}: {
  form: Form;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleStatus: (id: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const responseCount = form.response_count ?? 0;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="relative group p-4 cursor-pointer lc-card"
      onClick={() => router.push(`/formularios/${form.id}`)}
    >
      {/* Topo */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="p-2 rounded-lg" style={{ background: "var(--accent)" }}>
          <FileText size={14} style={{ color: "var(--primary)" }} />
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: `${STATUS_COLOR[form.status]}20`,
              color: STATUS_COLOR[form.status],
            }}
          >
            {STATUS_LABEL[form.status]}
          </span>
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
            >
              <MoreHorizontal size={14} style={{ color: "var(--muted-foreground)" }} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-6 z-20 w-44 rounded-lg border shadow-lg py-1"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                  onClick={() => { onDuplicate(form.id); setMenuOpen(false); }}
                >
                  <Copy size={12} />
                  Duplicar
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                  onClick={() => { onToggleStatus(form.id); setMenuOpen(false); }}
                >
                  <EyeOff size={12} />
                  {form.status === "disabled" ? "Ativar" : "Desativar"}
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                  onClick={() => { onArchive(form.id); setMenuOpen(false); }}
                >
                  <Archive size={12} />
                  {form.status === "archived" ? "Restaurar" : "Arquivar"}
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-red-500/10 transition-colors"
                  style={{ color: "#ef4444" }}
                  onClick={() => { onDelete(form.id); setMenuOpen(false); }}
                >
                  <Trash2 size={12} />
                  Excluir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nome */}
      <h3 className="font-semibold text-sm mb-1 truncate" style={{ color: "var(--text-title)" }}>
        {form.name}
      </h3>

      {/* Descrição */}
      {form.description && (
        <p className="text-xs line-clamp-2 mb-3" style={{ color: "var(--muted-foreground)" }}>
          {form.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}
        >
          <MessageSquare size={10} />
          <span className="text-xs">{responseCount} resposta{responseCount !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
          <Clock size={10} />
          <span className="text-xs">{formatDate(form.updated_at)}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "var(--accent)" }}
      >
        <FileText size={28} style={{ color: "var(--primary)" }} />
      </div>
      <h3 className="font-semibold text-base mb-1" style={{ color: "var(--text-title)" }}>
        Nenhum formulário criado
      </h3>
      <p className="text-sm mb-6 max-w-xs" style={{ color: "var(--muted-foreground)" }}>
        Crie seu primeiro formulário conversacional e comece a capturar leads de forma inteligente.
      </p>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
        style={{ background: "var(--primary)", color: "#fff" }}
      >
        <Plus size={15} />
        Criar Formulário
      </button>
    </motion.div>
  );
}

// ── Modal de criação ───────────────────────────────────────────────────────────

function NovoFormularioModal({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim());
    setSaving(false);
    setName("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm rounded-2xl p-6 lc-modal-panel">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-sm" style={{ color: "var(--text-title)" }}>Novo Formulário</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              Configure as perguntas no editor após criar
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={14} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>
              NOME DO FORMULÁRIO
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Qualificação de Leads Imobiliário"
              className="w-full text-sm rounded-lg px-3 py-2.5 outline-none transition-all"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--text-title)",
              }}
              onFocus={e => (e.target.style.borderColor = "var(--primary)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")}
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {saving ? "Criando..." : "Criar e abrir editor"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function FormulariosPage() {
  const router = useRouter();
  const { formularios, isLoading, createFormulario, deleteFormulario, updateStatus, duplicarFormulario } = useFormularios();
  const [modalOpen, setModalOpen] = useState(false);

  const handleCreate = async (name: string) => {
    const { data, error } = await createFormulario({ name, slug: "", description: null });
    if (error || !data) {
      toast.error("Erro ao criar formulário", { description: error ?? undefined });
    } else {
      setModalOpen(false);
      router.push(`/formularios/${data.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteFormulario(id);
    if (error) toast.error("Erro ao excluir formulário");
    else toast.success("Formulário excluído");
  };

  const handleArchive = async (id: string) => {
    const form = formularios.find(f => f.id === id);
    const novoStatus = form?.status === "archived" ? "draft" : "archived";
    const { error } = await updateStatus(id, novoStatus as never);
    if (error) toast.error("Erro ao arquivar");
    else toast.success(novoStatus === "archived" ? "Arquivado" : "Restaurado");
  };

  const handleToggleStatus = async (id: string) => {
    const form = formularios.find(f => f.id === id);
    const novoStatus = form?.status === "disabled" ? "draft" : "disabled";
    const { error } = await updateStatus(id, novoStatus as never);
    if (error) toast.error("Erro ao alterar status");
  };

  const handleDuplicate = async (id: string) => {
    const { data, error } = await duplicarFormulario(id);
    if (error || !data) toast.error("Erro ao duplicar formulário");
    else {
      toast.success("Formulário duplicado");
      router.push(`/formularios/${data.id}`);
    }
  };

  const ativos = formularios.filter(f => f.status !== "archived");
  const arquivados = formularios.filter(f => f.status === "archived");

  return (
    <div
      className="flex flex-col min-h-screen pb-24"
      style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
    >
      <Header
        title="Formulários"
        subtitle="Crie formulários conversacionais para capturar leads"
      />

      <div className="px-4 sm:px-6 pt-2 pb-4">
        {/* Barra de ações */}
        <div className="flex items-center justify-between mb-6">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <FileText size={13} style={{ color: "var(--muted-foreground)" }} />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {ativos.length} formulário{ativos.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 active:scale-95"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <Plus size={15} />
            Novo Formulário
          </button>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-xl border animate-pulse"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && formularios.length === 0 && (
          <EmptyState onCreate={() => setModalOpen(true)} />
        )}

        {/* Grid de ativos */}
        {!isLoading && ativos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {ativos.map(form => (
              <FormCard
                key={form.id}
                form={form}
                onDelete={handleDelete}
                onArchive={handleArchive}
                onDuplicate={handleDuplicate}
                onToggleStatus={handleToggleStatus}
              />
            ))}
          </div>
        )}

        {/* Arquivados */}
        {!isLoading && arquivados.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-3" style={{ color: "var(--muted-foreground)" }}>
              ARQUIVADOS ({arquivados.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50">
              {arquivados.map(form => (
                <FormCard
                  key={form.id}
                  form={form}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                  onDuplicate={handleDuplicate}
                  onToggleStatus={handleToggleStatus}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <NovoFormularioModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onCreate={handleCreate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
