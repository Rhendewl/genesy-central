"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Plus, Copy, Pencil, Pause, Play, Trash2, Check,
  ExternalLink, Clock, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NovoPortalModal } from "./NovoPortalModal";
import { usePortais } from "@/hooks/usePortais";
import type { Portal, NewPortal } from "@/types";

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atrás`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function StatusBadge({ status }: { status: "ativo" | "pausado" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        status === "ativo"
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: status === "ativo" ? "#22c55e" : "#f59e0b" }}
      />
      {status === "ativo" ? "Ativo" : "Pausado"}
    </span>
  );
}

function CopyButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/portal/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title="Copiar link"
      className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
        copied
          ? "bg-emerald-500/15 text-emerald-400"
          : "text-white/40 hover:text-white hover:bg-white/[0.07]"
      )}
    >
      {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
    </button>
  );
}

interface PortalRowProps {
  portal: Portal;
  onEdit: (p: Portal) => void;
  onToggleStatus: (id: string, status: "ativo" | "pausado") => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function PortalRow({ portal, onEdit, onToggleStatus, onDelete }: PortalRowProps) {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const accountCount = portal.portal_accounts?.length ?? 0;
  const publicUrl = `/portal/${portal.slug}`;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    const next = portal.status === "ativo" ? "pausado" : "ativo";
    await onToggleStatus(portal.id, next);
    setToggling(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Excluir o portal "${portal.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    await onDelete(portal.id);
  };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="group border-b border-white/[0.05] hover:bg-white/[0.025] transition-colors"
    >
      {/* Cliente + Nome */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(39,163,255,0.09)", border: "1px solid rgba(39,163,255,0.18)" }}
          >
            <Globe size={14} style={{ color: "#27a3ff" }} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-white font-medium text-sm leading-tight">{portal.name}</p>
            <p className="text-white/40 text-xs mt-0.5">
              {(portal.client as { name?: string } | null | undefined)?.name ?? "Sem cliente"}
            </p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-5 py-4">
        <StatusBadge status={portal.status} />
      </td>

      {/* Contas vinculadas */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5 text-white/50 text-sm">
          <Layers size={13} className="text-white/30" />
          <span>{accountCount} conta{accountCount !== 1 ? "s" : ""}</span>
        </div>
      </td>

      {/* Última atualização */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5 text-white/40 text-xs">
          <Clock size={12} />
          <span>{formatRelativeDate(portal.updated_at)}</span>
        </div>
      </td>

      {/* Link público */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[#27a3ff]/60 text-xs font-mono truncate max-w-[140px]">
            {publicUrl}
          </span>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-white/25 hover:text-[#27a3ff] transition-colors"
            title="Abrir portal"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </td>

      {/* Ações */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-1">
          <CopyButton slug={portal.slug} />

          <button
            onClick={e => { e.stopPropagation(); onEdit(portal); }}
            title="Editar"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.07] transition-all"
          >
            <Pencil size={13} />
          </button>

          <button
            onClick={handleToggle}
            disabled={toggling}
            title={portal.status === "ativo" ? "Pausar" : "Ativar"}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.07] transition-all disabled:opacity-40"
          >
            {portal.status === "ativo" ? <Pause size={13} /> : <Play size={13} />}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Excluir"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/[0.07] transition-all disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: "rgba(39,163,255,0.08)", border: "1px solid rgba(39,163,255,0.15)" }}
      >
        <Globe size={28} style={{ color: "rgba(39,163,255,0.6)" }} strokeWidth={1.4} />
      </div>
      <h3 className="text-white/80 font-semibold text-base mb-2">Nenhum portal criado</h3>
      <p className="text-white/35 text-sm max-w-xs mb-8">
        Crie dashboards públicos para seus clientes acompanharem resultados das campanhas em tempo real.
      </p>
      <button
        onClick={onNew}
        className="lc-btn px-5 py-2.5 text-sm rounded-xl flex items-center gap-2"
      >
        <Plus size={15} />
        Criar primeiro portal
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PortaisList() {
  const { portals, isLoading, createPortal, updatePortal, deletePortal, toggleStatus } = usePortais();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPortal, setEditingPortal] = useState<Portal | null>(null);

  const openNew = () => { setEditingPortal(null); setModalOpen(true); };
  const openEdit = (p: Portal) => { setEditingPortal(p); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingPortal(null); };

  const handleToggle = async (id: string, status: "ativo" | "pausado") => {
    const { error } = await toggleStatus(id, status);
    if (error) toast.error(error);
  };

  const handleDelete = async (id: string) => {
    const { error } = await deletePortal(id);
    if (error) toast.error(error);
    else toast.success("Portal excluído");
  };

  const handleUpdate = async (id: string, data: Partial<NewPortal>) => {
    return updatePortal(id, data);
  };

  if (isLoading) {
    return (
      <div className="space-y-3 mt-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="lc-card h-16 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Globe size={18} style={{ color: "#27a3ff" }} strokeWidth={1.8} />
            <h2 className="text-white font-semibold text-lg">Portais</h2>
            {portals.length > 0 && (
              <span className="text-xs text-[#27a3ff]/70 bg-[#27a3ff]/10 px-2 py-0.5 rounded-full font-medium border border-[#27a3ff]/15">
                {portals.length}
              </span>
            )}
          </div>
          <p className="text-white/40 text-sm">Dashboards públicos de campanhas para clientes</p>
        </div>
        <button
          onClick={openNew}
          className="lc-btn px-4 py-2.5 text-sm rounded-xl flex items-center gap-2"
        >
          <Plus size={15} />
          Novo Portal
        </button>
      </div>

      {portals.length === 0 ? (
        <EmptyState onNew={openNew} />
      ) : (
        <div
          className="lc-card rounded-2xl overflow-hidden"
          style={{ padding: 0 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  {["Cliente / Portal", "Status", "Contas", "Atualizado", "Link público", "Ações"].map(col => (
                    <th
                      key={col}
                      className="px-5 py-3.5 text-left text-xs font-semibold text-white/40 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {portals.map(portal => (
                    <PortalRow
                      key={portal.id}
                      portal={portal}
                      onEdit={openEdit}
                      onToggleStatus={handleToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NovoPortalModal
        open={modalOpen}
        onClose={closeModal}
        onSave={createPortal}
        editingPortal={editingPortal}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
