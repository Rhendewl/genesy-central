"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  NotepadText, Plus, MoreHorizontal, Trash2, Archive,
  Clock, Copy, EyeOff, X, Loader2, MessageSquare, ExternalLink, Link2,
  Folder, FolderPlus, Inbox, Pencil, Star, ArrowLeft,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useFormularios } from "@/hooks/useFormularios";
import { toast } from "sonner";
import type { Form, FormFolder, FormOrigin } from "@/types";
import { GlassFolderIcon } from "@/components/ui/GlassFolderIcon";
import { Button } from "@/components/ui/button";

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

const FOLDER_COLORS = ["#4a8fd4", "#7c6fe8", "#d65f8c", "#e39a3b", "#39a879", "#5ba8b5", "#9b70c9", "#75828e"];

// ── Card de formulário ─────────────────────────────────────────────────────────

function FormCard({
  form,
  onDelete,
  onArchive,
  onDuplicate,
  onToggleStatus,
  onMove,
  folders,
}: {
  form: Form;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onMove: (id: string, folderId: string | null) => void;
  folders: FormFolder[];
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const responseCount = form.response_count ?? 0;
  const publicPath = `/form/${form.slug}`;

  const openPublicForm = (event: React.MouseEvent) => {
    event.stopPropagation();
    window.open(publicPath, "_blank", "noopener,noreferrer");
  };

  const copyPublicLink = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
      toast.success("Link do formulário copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

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
        <NotepadText size={14} style={{ color: "var(--text-title)" }} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openPublicForm}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--hover)]"
            style={{ color: "var(--muted-foreground)" }}
            title="Abrir formulário em nova guia"
            aria-label="Abrir formulário em nova guia"
          >
            <ExternalLink size={13} />
          </button>
          <button
            type="button"
            onClick={copyPublicLink}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--hover)]"
            style={{ color: "var(--muted-foreground)" }}
            title="Copiar link público"
            aria-label="Copiar link público"
          >
            <Link2 size={13} />
          </button>
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
              className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--hover)]"
            >
              <MoreHorizontal size={14} style={{ color: "var(--muted-foreground)" }} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-6 z-20 w-44 rounded-lg border shadow-lg py-1"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
                onClick={e => e.stopPropagation()}
              >
                {form.origin !== "nps" && (
                  <button
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--hover)] transition-colors"
                    style={{ color: "var(--muted-foreground)" }}
                    onClick={() => { onDuplicate(form.id); setMenuOpen(false); }}
                  >
                    <Copy size={12} />
                    Duplicar
                  </button>
                )}
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--hover)] transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                  onClick={() => setMoveOpen((open) => !open)}
                >
                  <Folder size={12} />
                  Mover para pasta
                </button>
                {moveOpen && (
                  <div className="mx-2 mb-1 max-h-40 overflow-y-auto rounded-lg py-1" style={{ background: "var(--hover)" }}>
                    <button
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:opacity-70"
                      style={{ color: "var(--text-title)" }}
                      onClick={() => { onMove(form.id, null); setMoveOpen(false); setMenuOpen(false); }}
                    >
                      <Inbox size={11} /> Sem pasta
                    </button>
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:opacity-70"
                        style={{ color: form.folder_id === folder.id ? "var(--primary)" : "var(--text-title)" }}
                        onClick={() => { onMove(form.id, folder.id); setMoveOpen(false); setMenuOpen(false); }}
                      >
                        <Folder size={11} /> <span className="truncate">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--hover)] transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                  onClick={() => { onToggleStatus(form.id); setMenuOpen(false); }}
                >
                  <EyeOff size={12} />
                  {form.status === "disabled" ? "Ativar" : "Desativar"}
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--hover)] transition-colors"
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

      {form.origin === "nps" && (
        <div className="mb-3 flex items-center gap-1.5 text-[10px] font-medium" style={{ color: "#e0a344" }}>
          <Star size={11} fill="currentColor" /> Formulário NPS
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ background: "var(--glass-bg-soft)", color: "var(--muted-foreground)" }}
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
      <NotepadText size={28} className="mb-4" style={{ color: "#ffffff" }} />
      <h3 className="font-semibold text-base mb-1" style={{ color: "var(--text-title)" }}>
        Nenhum formulário criado
      </h3>
      <p className="text-sm mb-6 max-w-xs" style={{ color: "var(--muted-foreground)" }}>
        Crie seu primeiro formulário conversacional e comece a capturar leads de forma inteligente.
      </p>
      <Button
        onClick={onCreate}
        icon={<NotepadText size={15} />}
        signature
        size="medium"
      >
        Criar Formulário
      </Button>
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
        className="lc-modal-backdrop absolute inset-0" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="lc-modal-panel relative z-10 max-h-[calc(100dvh-1rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-sm" style={{ color: "var(--text-title)" }}>Novo Formulário</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              Configure as perguntas no editor após criar
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--hover)] transition-colors">
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
            style={{ background: "#b0b8c1", color: "#000000" }}
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

function FolderNameModal({ open, initialName = "", initialColor = "#4a8fd4", title, onClose, onSave }: {
  open: boolean; initialName?: string; initialColor?: string; title: string; onClose: () => void; onSave: (name: string, color: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div className="lc-modal-backdrop absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.form
        initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        onSubmit={async (event) => { event.preventDefault(); if (!name.trim()) return; setSaving(true); await onSave(name.trim(), color); setSaving(false); }}
        className="lc-modal-panel relative z-10 max-h-[calc(100dvh-1rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl p-5 sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>{title}</h3>
          <button type="button" onClick={onClose}><X size={15} style={{ color: "var(--muted-foreground)" }} /></button>
        </div>
        <div className="mb-3 flex justify-center rounded-2xl py-3" style={{ background: `radial-gradient(circle, ${color}22 0%, transparent 68%)` }}>
          <GlassFolderIcon color={color} className="h-24 w-28" />
        </div>
        <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Nome da pasta"
          className="mb-4 w-full rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--text-title)" }} />
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Cor da pasta</p>
        <div className="mb-5 grid grid-cols-8 gap-2">
          {FOLDER_COLORS.map((option) => (
            <button key={option} type="button" aria-label={`Usar cor ${option}`} onClick={() => setColor(option)}
              className="aspect-square rounded-full transition-transform hover:scale-110"
              style={{ background: option, boxShadow: color === option ? `0 0 0 2px var(--background), 0 0 0 4px ${option}` : "none", transform: color === option ? "scale(1.08)" : undefined }} />
          ))}
        </div>
        <button type="submit" disabled={!name.trim() || saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
          style={{ background: "#b0b8c1", color: "#000" }}>
          {saving && <Loader2 size={14} className="animate-spin" />} Salvar pasta
        </button>
      </motion.form>
    </div>
  );
}

type FolderSelection = "root" | "unfiled" | string;

function FolderNavigation({ folders, forms, onSelect, onRename, onDelete }: {
  folders: FormFolder[]; forms: Form[]; onSelect: (id: FolderSelection) => void;
  onRename: (folder: FormFolder) => void; onDelete: (folder: FormFolder) => void;
}) {
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null);
  const unfiled = forms.filter((form) => !form.folder_id).length;
  const folderCard = (id: FolderSelection, name: string, count: number, color: string, system = false) => (
    <motion.button key={id} type="button" onClick={() => onSelect(id)} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}
      className="glass-folder-card group relative aspect-square w-full overflow-hidden rounded-[20px] border p-3 text-left transition-all"
      style={{ "--folder-color": color } as React.CSSProperties}>
      <div className="glass-folder-glow pointer-events-none absolute inset-0 opacity-70" style={{ "--folder-color": color } as React.CSSProperties} />
      <div className="relative flex h-full flex-col items-center justify-center gap-1">
        <GlassFolderIcon color={color} className="h-16 w-[4.5rem] sm:h-20 sm:w-24" />
        <div className="w-full text-center">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>{name}</p>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{count} {count === 1 ? "formulário" : "formulários"}</p>
        </div>
        {system && <span className="absolute right-0 top-0 rounded-full px-1.5 py-0.5 text-[8px] uppercase tracking-wide backdrop-blur-md" style={{ background: "var(--hover)", color: "var(--muted-foreground)" }}>Sistema</span>}
      </div>
    </motion.button>
  );
  return (
    <section className="mb-7">
      <div className="mb-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Pastas</h2>
          <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>Organize os formulários por cliente ou projeto</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(132px,210px))] sm:gap-5">
        {unfiled > 0 && folderCard("unfiled", "Sem pasta", unfiled, "#75828e", true)}
        {folders.map((folder) => {
          const count = forms.filter((form) => form.folder_id === folder.id).length;
          const color = folder.color || "#4a8fd4";
          return (
            <div key={folder.id} className="group/folder relative aspect-square min-w-0">
              {folderCard(folder.id, folder.name, count, color)}
              <button type="button"
                onClick={(event) => { event.stopPropagation(); setOpenFolderMenuId((current) => current === folder.id ? null : folder.id); }}
                className="absolute right-2.5 top-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-lg border backdrop-blur-xl transition-colors hover:bg-[var(--hover)]"
                style={{ background: "color-mix(in srgb, var(--card) 68%, transparent)", borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                aria-label={`Opções da pasta ${folder.name}`} aria-expanded={openFolderMenuId === folder.id}>
                <MoreHorizontal size={13} />
              </button>
              {openFolderMenuId === folder.id && (
                <div className="absolute right-2.5 top-11 z-30 w-32 overflow-hidden rounded-xl border py-1 text-left shadow-2xl backdrop-blur-xl"
                  style={{ background: "color-mix(in srgb, var(--card) 92%, transparent)", borderColor: "var(--border)" }}>
                  <button type="button" onClick={() => { setOpenFolderMenuId(null); onRename(folder); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--hover)]" style={{ color: "var(--text-title)" }}>
                    <Pencil size={12} /> Editar
                  </button>
                  <button type="button" onClick={() => { setOpenFolderMenuId(null); onDelete(folder); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-red-500/10" style={{ color: "#ef4444" }}>
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {folders.length === 0 && unfiled === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed py-16 text-center" style={{ borderColor: "var(--border)" }}>
          <GlassFolderIcon color="#75828e" className="h-28 w-32 opacity-70" />
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--text-title)" }}>Nenhuma pasta criada</p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>Crie a primeira pasta para organizar seus formulários.</p>
        </div>
      )}
    </section>
  );
}

export default function FormulariosPage() {
  const router = useRouter();
  const {
    formularios, folders, isLoading, createFormulario, deleteFormulario, updateStatus, duplicarFormulario,
    moveFormulario, createFolder, renameFolder, deleteFolder,
  } = useFormularios();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeOrigin, setActiveOrigin] = useState<FormOrigin>("standard");
  const [selectedFolder, setSelectedFolder] = useState<FolderSelection>("root");
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FormFolder | null>(null);

  const handleCreate = async (name: string) => {
    const folderId = selectedFolder !== "root" && selectedFolder !== "unfiled" ? selectedFolder : null;
    const { data, error } = await createFormulario({ name, slug: "", description: null, folder_id: folderId });
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

  const handleMove = async (id: string, folderId: string | null) => {
    const { error } = await moveFormulario(id, folderId);
    if (error) toast.error("Erro ao mover formulário", { description: error });
    else toast.success(folderId ? "Formulário movido" : "Formulário removido da pasta");
  };

  const handleFolderSave = async (name: string, color: string) => {
    if (editingFolder) {
      const { error } = await renameFolder(editingFolder.id, name, color);
      if (error) { toast.error(error); return; }
      toast.success("Pasta renomeada");
    } else {
      const { data, error } = await createFolder(name, color);
      if (error || !data) { toast.error(error ?? "Erro ao criar pasta"); return; }
      setSelectedFolder(data.id);
      toast.success("Pasta criada");
    }
    setFolderModalOpen(false);
    setEditingFolder(null);
  };

  const handleFolderDelete = async (folder: FormFolder) => {
    if (!window.confirm(`Excluir a pasta "${folder.name}"? Os formulários ficarão em Sem pasta.`)) return;
    const { error } = await deleteFolder(folder.id);
    if (error) { toast.error(error); return; }
    if (selectedFolder === folder.id) setSelectedFolder("root");
    toast.success("Pasta excluída");
  };

  const originForms = formularios.filter((form) => (form.origin ?? "standard") === activeOrigin);
  const visibleFolderIds = new Set(originForms.map((form) => form.folder_id).filter(Boolean));
  const visibleFolders = folders.filter((folder) =>
    visibleFolderIds.has(folder.id)
    || folder.id === selectedFolder
    || (activeOrigin === "nps" ? !!folder.client_id : !folder.client_id)
  );
  const selectedFolderRecord = selectedFolder !== "root" && selectedFolder !== "unfiled"
    ? visibleFolders.find((folder) => folder.id === selectedFolder) ?? null
    : null;
  const isFolderRoot = selectedFolder === "root";
  const filteredForms = originForms.filter((form) =>
    !isFolderRoot
    && (selectedFolder === "unfiled" ? !form.folder_id : form.folder_id === selectedFolder)
  );
  const ativos = filteredForms.filter((form) => form.status !== "archived");
  const arquivados = filteredForms.filter((form) => form.status === "archived");
  const standardCount = formularios.filter((form) => (form.origin ?? "standard") === "standard" && form.status !== "archived").length;
  const npsCount = formularios.filter((form) => form.origin === "nps" && form.status !== "archived").length;

  return (
    <div
      className="flex flex-col pb-24"
      style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
    >
      <Header
        title="Formulários"
        subtitle="Crie formulários conversacionais para capturar leads"
      />

      <div className="px-4 sm:px-6 pt-2 pb-4">
        <div className="mb-6 flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
          {([
            { id: "standard" as const, label: "Formulários", count: standardCount, icon: <NotepadText size={14} /> },
            { id: "nps" as const, label: "NPS", count: npsCount, icon: <Star size={14} /> },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveOrigin(tab.id); setSelectedFolder("root"); }}
              className="relative flex items-center gap-2 px-4 py-3 text-sm font-medium"
              style={{ color: activeOrigin === tab.id ? "var(--text-title)" : "var(--muted-foreground)" }}
            >
              {tab.icon}{tab.label}<span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "var(--hover)" }}>{tab.count}</span>
              {activeOrigin === tab.id && <motion.span layoutId="form-origin-tab" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full" style={{ background: "var(--text-title)" }} />}
            </button>
          ))}
        </div>

        {/* Barra de ações */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <NotepadText size={13} style={{ color: "var(--muted-foreground)" }} />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {isFolderRoot
                ? `${visibleFolders.length} ${visibleFolders.length === 1 ? "pasta" : "pastas"}`
                : `${filteredForms.length} ${filteredForms.length === 1 ? "formulário" : "formulários"}`}
            </span>
          </div>
          <Button
            onClick={() => {
              if (activeOrigin === "nps") { router.push("/clientes"); return; }
              if (isFolderRoot) { setEditingFolder(null); setFolderModalOpen(true); return; }
              setModalOpen(true);
            }}
            icon={activeOrigin === "nps" ? <Star size={15} /> : isFolderRoot ? <FolderPlus size={15} /> : <NotepadText size={15} />}
            signature
            size="medium"
          >
            {activeOrigin === "nps" ? "Gerenciar NPS em Clientes" : isFolderRoot ? "Nova Pasta" : "Novo Formulário"}
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          {!isLoading && isFolderRoot && (
            <FolderNavigation
              folders={visibleFolders}
              forms={originForms}
              onSelect={setSelectedFolder}
              onRename={(folder) => { setEditingFolder(folder); setFolderModalOpen(true); }}
              onDelete={handleFolderDelete}
            />
          )}

          {!isLoading && !isFolderRoot && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
              style={{ background: "color-mix(in srgb, var(--card) 78%, transparent)", borderColor: "var(--border)", backdropFilter: "blur(18px)" }}>
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={() => setSelectedFolder("root")}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-[var(--hover)]"
                  style={{ color: "var(--muted-foreground)" }} title="Voltar para pastas">
                  <ArrowLeft size={17} />
                </button>
                <GlassFolderIcon color={selectedFolderRecord?.color ?? "#75828e"} className="h-14 w-16 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>Dentro da pasta</p>
                  <h2 className="truncate text-base font-semibold" style={{ color: "var(--text-title)" }}>
                    {selectedFolder === "unfiled" ? "Sem pasta" : selectedFolderRecord?.name ?? "Pasta"}
                  </h2>
                </div>
              </div>
              {selectedFolderRecord && (
                <button type="button" onClick={() => { setEditingFolder(selectedFolderRecord); setFolderModalOpen(true); }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium hover:bg-[var(--hover)]"
                  style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                  <Pencil size={13} /> Editar pasta
                </button>
              )}
            </div>
          )}

          <div className="min-w-0">
          {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
        {!isLoading && !isFolderRoot && filteredForms.length === 0 && activeOrigin === "standard" && (
          <EmptyState onCreate={() => setModalOpen(true)} />
        )}
        {!isLoading && !isFolderRoot && filteredForms.length === 0 && activeOrigin === "nps" && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Star size={28} className="mb-4" style={{ color: "#e0a344" }} />
            <h3 className="mb-1 text-base font-semibold" style={{ color: "var(--text-title)" }}>Nenhum formulário NPS nesta pasta</h3>
            <p className="mb-6 max-w-sm text-sm" style={{ color: "var(--muted-foreground)" }}>Crie e vincule formulários NPS diretamente no módulo de Clientes.</p>
            <button onClick={() => router.push("/clientes")} className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: "#b0b8c1", color: "#000" }}>Abrir Clientes</button>
          </div>
        )}

        {/* Grid de ativos */}
        {!isLoading && !isFolderRoot && ativos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {ativos.map(form => (
              <FormCard
                key={form.id}
                form={form}
                onDelete={handleDelete}
                onArchive={handleArchive}
                onDuplicate={handleDuplicate}
                onToggleStatus={handleToggleStatus}
                onMove={handleMove}
                folders={folders}
              />
            ))}
          </div>
        )}

        {/* Arquivados */}
        {!isLoading && !isFolderRoot && arquivados.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-3" style={{ color: "var(--muted-foreground)" }}>
              ARQUIVADOS ({arquivados.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 opacity-50">
              {arquivados.map(form => (
                <FormCard
                  key={form.id}
                  form={form}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                  onDuplicate={handleDuplicate}
                  onToggleStatus={handleToggleStatus}
                  onMove={handleMove}
                  folders={folders}
                />
              ))}
            </div>
          </div>
        )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <NovoFormularioModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onCreate={handleCreate}
          />
        )}
        {folderModalOpen && (
          <FolderNameModal
            key={editingFolder?.id ?? "new-folder"}
            open={folderModalOpen}
            initialName={editingFolder?.name ?? ""}
            initialColor={editingFolder?.color ?? "#4a8fd4"}
            title={editingFolder ? "Renomear pasta" : "Nova pasta"}
            onClose={() => { setFolderModalOpen(false); setEditingFolder(null); }}
            onSave={handleFolderSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
