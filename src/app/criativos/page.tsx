"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Plus, Folder, MoreHorizontal,
  Trash2, Archive, Image, Clock, Settings2, AlertTriangle,
  X, Loader2,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { ConfiguracaoIAModal } from "@/components/criativos/ConfiguracaoIAModal";
import { useProjetosCriativos } from "@/hooks/useProjetosCriativos";
import { toast } from "sonner";
import type { CriativoProjeto } from "@/types";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  arquivado: "Arquivado",
};

const STATUS_COLOR: Record<string, string> = {
  rascunho: "var(--muted-foreground)",
  ativo: "#22c55e",
  arquivado: "var(--muted-foreground)",
};

const SEGMENTO_LABEL: Record<string, string> = {
  imobiliario: "Imobiliário",
  varejo: "Varejo",
  servicos: "Serviços",
  saude: "Saúde",
  educacao: "Educação",
  outro: "Outro",
};

function ProjetoCard({
  projeto,
  onDelete,
  onArchive,
}: {
  projeto: CriativoProjeto;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="relative group rounded-xl border p-4 cursor-pointer transition-all"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
      onClick={() => router.push(`/criativos/${projeto.id}`)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="p-2 rounded-lg" style={{ background: "var(--accent)" }}>
          <Sparkles size={14} style={{ color: "var(--primary)" }} />
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: `${STATUS_COLOR[projeto.status]}20`,
              color: STATUS_COLOR[projeto.status],
            }}
          >
            {STATUS_LABEL[projeto.status]}
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
                className="absolute right-0 top-6 z-20 w-40 rounded-lg border shadow-lg py-1"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                  onClick={() => { onArchive(projeto.id); setMenuOpen(false); }}
                >
                  <Archive size={12} />
                  {projeto.status === "arquivado" ? "Restaurar" : "Arquivar"}
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-red-500/10 transition-colors"
                  style={{ color: "#ef4444" }}
                  onClick={() => { onDelete(projeto.id); setMenuOpen(false); }}
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
        {projeto.nome}
      </h3>

      {/* Objetivo */}
      <p className="text-xs line-clamp-2 mb-3" style={{ color: "var(--muted-foreground)" }}>
        {projeto.objetivo}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span
          className="text-xs px-2 py-0.5 rounded-full border"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          {SEGMENTO_LABEL[projeto.segmento] ?? projeto.segmento}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full border capitalize"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          {projeto.estilo_visual}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
          {projeto.agency_clients?.name ? (
            <span className="text-xs truncate max-w-[120px]">{projeto.agency_clients.name}</span>
          ) : (
            <span className="text-xs">Sem cliente</span>
          )}
        </div>
        <div className="flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
          <Clock size={10} />
          <span className="text-xs">{formatDate(projeto.created_at)}</span>
        </div>
      </div>
    </motion.div>
  );
}

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
        <Image size={28} style={{ color: "var(--primary)" }} />
      </div>
      <h3 className="font-semibold text-base mb-1" style={{ color: "var(--text-title)" }}>
        Nenhum projeto criado
      </h3>
      <p className="text-sm mb-6 max-w-xs" style={{ color: "var(--muted-foreground)" }}>
        Crie seu primeiro projeto e comece a gerar criativos com IA em segundos.
      </p>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
        style={{ background: "var(--primary)", color: "#fff" }}
      >
        <Plus size={15} />
        Criar Projeto
      </button>
    </motion.div>
  );
}

function QuickCreateModal({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  onCreate: (nome: string) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setNome(""); setTimeout(() => inputRef.current?.focus(), 60); }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);
    await onCreate(nome.trim());
    setSaving(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm rounded-2xl border p-6"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-sm" style={{ color: "var(--text-title)" }}>Novo Projeto</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              Configure o workflow visual depois no canvas
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={14} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>
              NOME DO PROJETO
            </label>
            <input
              ref={inputRef}
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Campanha Lançamento Março"
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
            disabled={!nome.trim() || saving}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {saving ? "Criando..." : "Criar e abrir canvas"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default function CriativosPage() {
  const router = useRouter();
  const { projetos, isLoading, createProjeto, updateProjeto, deleteProjeto } = useProjetosCriativos();
  const [modalOpen, setModalOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  // Verifica se há ao menos uma chave de IA configurada
  useEffect(() => {
    fetch("/api/criativos/config")
      .then(r => r.json())
      .then(d => setAiConfigured(d.configured ?? false))
      .catch(() => setAiConfigured(false));
  }, []);

  const handleCreate = async (nome: string) => {
    const { data, error } = await createProjeto({ nome });
    if (error || !data) {
      toast.error("Erro ao criar projeto", { description: error ?? undefined });
    } else {
      setModalOpen(false);
      router.push(`/criativos/${data.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteProjeto(id);
    if (error) {
      toast.error("Erro ao excluir projeto");
    } else {
      toast.success("Projeto excluído");
    }
  };

  const handleArchive = async (id: string) => {
    const projeto = projetos.find(p => p.id === id);
    if (!projeto) return;
    const novoStatus = projeto.status === "arquivado" ? "ativo" : "arquivado";
    const { error } = await updateProjeto(id, { status: novoStatus });
    if (error) {
      toast.error("Erro ao atualizar projeto");
    } else {
      toast.success(novoStatus === "arquivado" ? "Projeto arquivado" : "Projeto restaurado");
    }
  };

  const ativos = projetos.filter(p => p.status !== "arquivado");
  const arquivados = projetos.filter(p => p.status === "arquivado");

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ background: "var(--background)" }}>
      <Header
        title="Criativos IA"
        subtitle="Gere anúncios publicitários com inteligência artificial"
      />

      <div className="px-4 sm:px-6 pt-2 pb-4">
        {/* Banner de aviso quando nenhuma IA está configurada */}
        {aiConfigured === false && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border mb-4"
            style={{ background: "rgba(234,179,8,0.06)", borderColor: "rgba(234,179,8,0.2)" }}
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={15} style={{ color: "#EAB308" }} />
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Nenhuma chave de IA configurada. Configure para começar a gerar criativos.
              </p>
            </div>
            <button
              onClick={() => setConfigOpen(true)}
              className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
              style={{ background: "#EAB308", color: "#000" }}
            >
              Configurar agora
            </button>
          </motion.div>
        )}

        {/* Actions bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <Folder size={13} style={{ color: "var(--muted-foreground)" }} />
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {ativos.length} projeto{ativos.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfigOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              title="Configurar chaves de IA"
            >
              <Settings2 size={14} />
              <span className="hidden sm:inline">Configurar IAs</span>
              {aiConfigured === true && (
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 active:scale-95"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              <Plus size={15} />
              Novo Projeto
            </button>
          </div>
        </div>

        {/* Loading */}
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
        {!isLoading && projetos.length === 0 && (
          <EmptyState onCreate={() => setModalOpen(true)} />
        )}

        {/* Grid de projetos ativos */}
        {!isLoading && ativos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {ativos.map(projeto => (
              <ProjetoCard
                key={projeto.id}
                projeto={projeto}
                onDelete={handleDelete}
                onArchive={handleArchive}
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
              {arquivados.map(projeto => (
                <ProjetoCard
                  key={projeto.id}
                  projeto={projeto}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <QuickCreateModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onCreate={handleCreate}
          />
        )}
      </AnimatePresence>

      <ConfiguracaoIAModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={() => setAiConfigured(true)}
      />
    </div>
  );
}
