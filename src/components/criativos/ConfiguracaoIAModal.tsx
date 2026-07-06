"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  X, Eye, EyeOff, CheckCircle2, Circle,
  ExternalLink, Loader2, Save, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface AIConfigStatus {
  configured: boolean;
  openai_configured: boolean;
  gemini_configured: boolean;
  openai_masked: string | null;
  gemini_masked: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

// ── Providers ─────────────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    key: "openai" as const,
    name: "OpenAI",
    model: "GPT-4o + DALL-E 3",
    uso: "Geração de imagens (obrigatório) e copy",
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    docsLabel: "platform.openai.com",
    color: "#10B981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.25)",
  },
  {
    key: "gemini" as const,
    name: "Google Gemini",
    model: "Gemini 2.0 Flash",
    uso: "Alternativa para geração de copy",
    placeholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    docsLabel: "aistudio.google.com",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.25)",
  },
] as const;

type ProviderKey = typeof PROVIDERS[number]["key"];

// ── Campo de API Key ──────────────────────────────────────────────────────────

function APIKeyField({
  provider,
  value,
  maskedValue,
  isConfigured,
  isEditing,
  onEdit,
  onCancel,
  onChange,
}: {
  provider: typeof PROVIDERS[number];
  value: string;
  maskedValue: string | null;
  isConfigured: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="rounded-xl border p-4 transition-all"
      style={{
        borderColor: isConfigured && !isEditing ? provider.border : "var(--border)",
        background:  isConfigured && !isEditing ? provider.bg    : "transparent",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: isConfigured ? provider.color : "var(--muted-foreground)" }}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
                {provider.name}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: "var(--accent)", color: "var(--muted-foreground)" }}
              >
                {provider.model}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {provider.uso}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isConfigured && !isEditing
            ? <><CheckCircle2 size={14} color={provider.color} /><span className="text-xs font-medium" style={{ color: provider.color }}>Configurado</span></>
            : <><Circle size={14} style={{ color: "var(--muted-foreground)" }} /><span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Não configurado</span></>
          }
        </div>
      </div>

      <div className="flex gap-2">
        {isConfigured && !isEditing ? (
          <>
            <div
              className="flex-1 px-3 py-2 rounded-lg border text-xs font-mono"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              {maskedValue}
            </div>
            <button
              onClick={onEdit}
              className="px-3 py-2 rounded-lg border text-xs transition-all hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              Alterar
            </button>
          </>
        ) : (
          <>
            <div className="relative flex-1">
              <input
                type={show ? "text" : "password"}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={provider.placeholder}
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2 rounded-lg border text-xs font-mono pr-9 outline-none focus:ring-1"
                style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text-title)" }}
              />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
              >
                {show
                  ? <EyeOff size={13} style={{ color: "var(--muted-foreground)" }} />
                  : <Eye size={13} style={{ color: "var(--muted-foreground)" }} />
                }
              </button>
            </div>
            {isEditing && (
              <button
                onClick={onCancel}
                className="px-3 py-2 rounded-lg border text-xs transition-all hover:bg-white/5"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                Cancelar
              </button>
            )}
          </>
        )}
      </div>

      {(!isConfigured || isEditing) && (
        <a
          href={provider.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs hover:opacity-80 transition-opacity"
          style={{ color: provider.color }}
        >
          <ExternalLink size={11} />
          Obter chave em {provider.docsLabel}
        </a>
      )}
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────

export function ConfiguracaoIAModal({ open, onClose, onSaved }: Props) {
  const [status, setStatus] = useState<AIConfigStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  // Valor atual de cada campo (string vazia = não preenchido)
  const [keys, setKeys]     = useState<Record<ProviderKey, string>>({ openai: "", gemini: "" });
  // Rastreia se o usuário clicou em "Alterar" para cada campo
  const [editing, setEditing] = useState<Record<ProviderKey, boolean>>({ openai: false, gemini: false });

  const loadConfig = useCallback(async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch("/api/criativos/config");
      const data = await res.json();
      setStatus(data);
    } catch {
      toast.error("Erro ao carregar configurações.");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setKeys({ openai: "", gemini: "" });
      setEditing({ openai: false, gemini: false });
      loadConfig();
    }
  }, [open, loadConfig]);

  const handleSave = async () => {
    // Só pode salvar se há algo novo para salvar
    const hasChanges = PROVIDERS.some(p => {
      if (editing[p.key]) return true;       // usuário está editando (pode querer salvar vazio = limpar)
      if (keys[p.key].trim()) return true;   // digitou uma chave nova
      return false;
    });

    if (!hasChanges) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }

    setSaving(true);
    try {
      // Monta o body com PATCH semântico:
      // — campo presente = atualizar (string vazia = limpar)
      // — campo ausente  = manter existente no banco
      const body: Record<string, string> = {};
      for (const p of PROVIDERS) {
        if (editing[p.key] || keys[p.key].trim()) {
          body[`${p.key}_api_key`] = keys[p.key].trim();
        }
      }

      const res = await fetch("/api/criativos/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Erro ao salvar.");
        return;
      }

      toast.success("Configurações salvas com sucesso!");
      setKeys({ openai: "", gemini: "" });
      setEditing({ openai: false, gemini: false });
      await loadConfig();
      onSaved?.();
    } catch {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h2 className="font-semibold text-sm" style={{ color: "var(--text-title)" }}>
              Configurar IAs
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              Suas chaves ficam armazenadas com segurança e nunca são compartilhadas
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={16} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-xs"
            style={{ background: "rgba(234,179,8,0.06)", borderColor: "rgba(234,179,8,0.2)", color: "var(--muted-foreground)" }}
          >
            <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: "#EAB308" }} />
            <span>
              As chaves são armazenadas de forma segura no banco de dados, protegidas por autenticação.
              Nunca são expostas no código do cliente.
            </span>
          </div>

          {loadingStatus ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
            </div>
          ) : (
            PROVIDERS.map(provider => (
              <APIKeyField
                key={provider.key}
                provider={provider}
                value={keys[provider.key]}
                maskedValue={status?.[`${provider.key}_masked` as "openai_masked" | "gemini_masked"] ?? null}
                isConfigured={status?.[`${provider.key}_configured` as "openai_configured" | "gemini_configured"] ?? false}
                isEditing={editing[provider.key]}
                onEdit={() => setEditing(e => ({ ...e, [provider.key]: true }))}
                onCancel={() => {
                  setEditing(e => ({ ...e, [provider.key]: false }));
                  setKeys(k => ({ ...k, [provider.key]: "" }));
                }}
                onChange={v => setKeys(k => ({ ...k, [provider.key]: v }))}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-4 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm transition-all hover:bg-white/5"
            style={{ color: "var(--muted-foreground)" }}
          >
            Fechar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "#b0b8c1", color: "#000000" }}
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" />Salvando...</>
              : <><Save size={14} />Salvar configurações</>
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
}
