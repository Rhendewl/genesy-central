"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plug, Webhook, CheckCircle2, XCircle, Clock,
  Copy, Check, Zap, ExternalLink, Loader2, AlertTriangle,
  FileText, RefreshCw, X, Globe, Key, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { useCrmIntegrations } from "@/hooks/useCrmIntegrations";
import type { AdPlatformAccount } from "@/types";
import type { MetaPageSub, CrmLeadSnippet } from "@/hooks/useCrmIntegrations";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtRelative = (iso: string | null): string => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "agora";
  if (mins < 60)  return `há ${mins}min`;
  if (hours < 24) return `há ${hours}h`;
  return `há ${days}d`;
};

const fmtDateTime = (iso: string | null): string => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
};

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copiado para a área de transferência");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
      style={{
        background: copied ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.06)",
        border:     copied ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.1)",
        color:      copied ? "#10b981" : "#c7e5ff",
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copiado!" : label}
    </button>
  );
}

// ── Meta Ads Card ─────────────────────────────────────────────────────────────

interface MetaCardProps {
  connections:  AdPlatformAccount[];
  pages:        MetaPageSub[];
  lastLead:     CrmLeadSnippet | null;
  onConnect:    () => void;
  onDisconnect: (id: string) => Promise<{ error: string | null }>;
}

function MetaAdsCard({ connections, pages, lastLead, onConnect, onDisconnect }: MetaCardProps) {
  const [disconnecting, setDisconnecting] = useState<Record<string, boolean>>({});

  const connected = connections.filter(c => c.status === "connected");
  const isConnected = connected.length > 0;

  const handleDisconnect = async (id: string) => {
    setDisconnecting(p => ({ ...p, [id]: true }));
    const { error } = await onDisconnect(id);
    if (error) toast.error(error);
    setDisconnecting(p => ({ ...p, [id]: false }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="rounded-3xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(14,22,34,0.9) 0%, rgba(10,16,26,0.95) 100%)",
        border: "1px solid rgba(74,143,212,0.2)",
        boxShadow: isConnected
          ? "0 0 40px rgba(74,143,212,0.08), 0 4px 24px rgba(0,0,0,0.3)"
          : "0 4px 24px rgba(0,0,0,0.25)",
      }}
    >
      {/* Glow strip */}
      <div
        className="h-0.5 w-full"
        style={{
          background: isConnected
            ? "linear-gradient(90deg, transparent, #4a8fd4, transparent)"
            : "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
        }}
      />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, #1877F2, #0d5fc9)",
                boxShadow: "0 4px 16px rgba(24,119,242,0.3)",
              }}
            >
              {/* Meta "M" logo */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-base leading-tight">Meta Ads</h3>
              <p className="text-[#6b8fa8] text-xs mt-0.5">Lead Ads · Facebook &amp; Instagram</p>
            </div>
          </div>

          {/* Status */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isConnected
                ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/25"
                : "text-[#6b8fa8] bg-white/5 border-white/10"
            }`}
          >
            {isConnected ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
            {isConnected ? "Conectado" : "Não conectado"}
          </div>
        </div>

        {/* Description */}
        <p className="text-[#8ba5bb] text-sm mb-5 leading-relaxed">
          Receba leads de formulários do Facebook e Instagram em tempo real, diretamente no CRM.
        </p>

        {/* Stats */}
        <div
          className="grid grid-cols-3 gap-3 mb-5 p-4 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="text-center">
            <p className="text-xl font-bold text-white">{connected.length}</p>
            <p className="text-[10px] text-[#6b8fa8] mt-0.5 leading-tight">Contas</p>
          </div>
          <div className="text-center border-x" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-xl font-bold text-white">{pages.length}</p>
            <p className="text-[10px] text-[#6b8fa8] mt-0.5 leading-tight">Páginas</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#c7e5ff] truncate">
              {lastLead ? fmtRelative(lastLead.created_at) : "—"}
            </p>
            <p className="text-[10px] text-[#6b8fa8] mt-0.5 leading-tight">Último lead</p>
          </div>
        </div>

        {/* Connected pages list */}
        {pages.length > 0 && (
          <div className="mb-5 space-y-1.5">
            <p className="text-[11px] text-[#6b8fa8] uppercase tracking-wider font-medium mb-2">
              Páginas conectadas
            </p>
            {pages.slice(0, 3).map(p => (
              <div
                key={p.page_id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                style={{ background: "rgba(74,143,212,0.06)", border: "1px solid rgba(74,143,212,0.12)" }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[#c7e5ff] truncate">{p.page_name || p.page_id}</span>
              </div>
            ))}
            {pages.length > 3 && (
              <p className="text-[11px] text-[#6b8fa8] px-3">+{pages.length - 3} mais</p>
            )}
          </div>
        )}

        {/* Last lead */}
        {lastLead && (
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-5 text-xs"
            style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}
          >
            <Activity size={12} className="text-emerald-400 shrink-0" />
            <span className="text-[#8ba5bb]">Último lead:</span>
            <span className="text-white font-medium truncate">{lastLead.name}</span>
            <span className="text-[#6b8fa8] ml-auto shrink-0">{fmtDateTime(lastLead.created_at)}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {!isConnected ? (
            <button
              onClick={onConnect}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #1877F2, #0d5fc9)",
                boxShadow: "0 4px 16px rgba(24,119,242,0.25)",
                color: "white",
              }}
            >
              <Plug size={14} />
              Conectar Meta
            </button>
          ) : (
            <>
              <a
                href="/crm/integracoes/meta-leads"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-95"
                style={{
                  background: "rgba(74,143,212,0.12)",
                  border: "1px solid rgba(74,143,212,0.25)",
                  color: "#4a8fd4",
                }}
              >
                <ExternalLink size={13} />
                Gerenciar
              </a>

              {connected.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => handleDisconnect(acc.id)}
                  disabled={disconnecting[acc.id]}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "#f87171",
                  }}
                >
                  {disconnecting[acc.id]
                    ? <Loader2 size={13} className="animate-spin" />
                    : <XCircle size={13} />}
                  Desconectar
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Webhook Logs Modal ────────────────────────────────────────────────────────

function WebhookLogsModal({
  lastLead,
  count,
  onClose,
}: {
  lastLead: CrmLeadSnippet | null;
  count: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18 }}
        className="relative w-full max-w-md z-10 rounded-2xl p-6"
        style={{
          background: "rgba(10,16,26,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          backdropFilter: "blur(24px)",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <FileText size={15} className="text-[#4a8fd4]" />
            Logs de Webhook
          </h3>
          <button onClick={onClose} className="text-[#6b8fa8] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div
          className="rounded-2xl p-4 mb-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#6b8fa8] text-sm">Total recebido</span>
            <span className="text-white font-bold text-lg">{count}</span>
          </div>
          {lastLead && (
            <div className="flex items-center justify-between">
              <span className="text-[#6b8fa8] text-sm">Último</span>
              <div className="text-right">
                <p className="text-white text-sm font-medium">{lastLead.name}</p>
                <p className="text-[#6b8fa8] text-xs">{fmtDateTime(lastLead.created_at)}</p>
              </div>
            </div>
          )}
        </div>

        {count === 0 && (
          <p className="text-[#6b8fa8] text-sm text-center py-4">
            Nenhum lead recebido via webhook ainda.
          </p>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-[#8ba5bb] hover:text-white transition-colors"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          Fechar
        </button>
      </motion.div>
    </div>
  );
}

// ── Test Webhook Modal ────────────────────────────────────────────────────────

function TestWebhookModal({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const endpoint = `${appUrl}/api/leads`;

  const curlExample = `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: ${apiKey}" \\
  -d '{
    "name": "João Silva",
    "phone": "11999999999",
    "email": "joao@email.com"
  }'`;

  const [testing, setTesting] = useState(false);
  const [result,  setResult]  = useState<"success" | "error" | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({ name: "Lead Teste", phone: "00000000000", source: "teste_webhook" }),
      });
      setResult(res.ok ? "success" : "error");
      if (res.ok) toast.success("Lead de teste salvo no CRM!");
      else toast.error("Teste falhou — verifique as credenciais");
    } catch {
      setResult("error");
      toast.error("Erro de conexão");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18 }}
        className="relative w-full max-w-lg z-10 rounded-2xl p-6"
        style={{
          background: "rgba(10,16,26,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          backdropFilter: "blur(24px)",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Zap size={15} className="text-[#4a8fd4]" />
            Testar Webhook
          </h3>
          <button onClick={onClose} className="text-[#6b8fa8] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-[#8ba5bb] text-sm mb-4">
          Use o comando abaixo para enviar um lead de qualquer sistema externo:
        </p>

        {/* Code block */}
        <div
          className="relative rounded-xl p-4 mb-4 font-mono text-xs overflow-x-auto"
          style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <pre className="text-[#c7e5ff] whitespace-pre-wrap break-all leading-relaxed">
            {curlExample}
          </pre>
          <div className="absolute top-3 right-3">
            <CopyButton text={curlExample} label="Copiar" />
          </div>
        </div>

        {/* Payload fields */}
        <div
          className="rounded-xl p-4 mb-5 text-xs space-y-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-[#6b8fa8] font-medium uppercase tracking-wider text-[10px] mb-3">Campos aceitos</p>
          {[
            ["name",   "string", "obrigatório", "Nome completo do lead"],
            ["phone",  "string", "phone ou email obrigatório", "Telefone"],
            ["email",  "string", "phone ou email obrigatório", "E-mail"],
            ["source", "string", "opcional", "Origem (ex: landing_page)"],
            ["notes",  "string", "opcional", "Observações"],
          ].map(([field, type, req, desc]) => (
            <div key={field} className="flex items-start gap-3">
              <code className="text-[#4a8fd4] w-16 shrink-0">{field}</code>
              <span className="text-[#6b8fa8] w-12 shrink-0">{type}</span>
              <span
                className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${
                  req === "obrigatório"
                    ? "bg-red-400/10 text-red-400"
                    : req.includes("obrigatório")
                    ? "bg-amber-400/10 text-amber-400"
                    : "bg-white/5 text-[#6b8fa8]"
                }`}
              >
                {req}
              </span>
              <span className="text-[#8ba5bb]">{desc}</span>
            </div>
          ))}
        </div>

        {/* Live test */}
        <div className="flex gap-2">
          <button
            onClick={runTest}
            disabled={testing}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
            style={{
              background: result === "success"
                ? "rgba(16,185,129,0.15)"
                : result === "error"
                ? "rgba(239,68,68,0.15)"
                : "rgba(74,143,212,0.15)",
              border: result === "success"
                ? "1px solid rgba(16,185,129,0.3)"
                : result === "error"
                ? "1px solid rgba(239,68,68,0.3)"
                : "1px solid rgba(74,143,212,0.3)",
              color: result === "success" ? "#10b981" : result === "error" ? "#f87171" : "#4a8fd4",
            }}
          >
            {testing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : result === "success" ? (
              <CheckCircle2 size={14} />
            ) : result === "error" ? (
              <AlertTriangle size={14} />
            ) : (
              <Zap size={14} />
            )}
            {testing ? "Enviando…" : result === "success" ? "Sucesso!" : result === "error" ? "Falhou" : "Enviar lead de teste"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm text-[#8ba5bb] hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Webhooks Card ─────────────────────────────────────────────────────────────

interface WebhookCardProps {
  userId:    string | null;
  count:     number;
  lastLead:  CrmLeadSnippet | null;
}

function WebhookCard({ userId, count, lastLead }: WebhookCardProps) {
  const [showLogs, setShowLogs]   = useState(false);
  const [showTest, setShowTest]   = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);

  const appUrl   = typeof window !== "undefined" ? window.location.origin : "https://seuapp.com";
  const endpoint = `${appUrl}/api/leads`;
  const apiKey   = userId ?? "—";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(14,22,34,0.9) 0%, rgba(10,16,26,0.95) 100%)",
          border: "1px solid rgba(74,143,212,0.15)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
        }}
      >
        {/* Glow strip */}
        <div
          className="h-0.5 w-full"
          style={{
            background: count > 0
              ? "linear-gradient(90deg, transparent, #10b981, transparent)"
              : "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
          }}
        />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(74,143,212,0.3), rgba(74,143,212,0.15))",
                  border: "1px solid rgba(74,143,212,0.3)",
                }}
              >
                <Webhook size={20} className="text-[#4a8fd4]" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base leading-tight">Webhooks</h3>
                <p className="text-[#6b8fa8] text-xs mt-0.5">Endpoint HTTP · JSON</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border text-[#4a8fd4] bg-[#4a8fd4]/10 border-[#4a8fd4]/25">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4a8fd4] animate-pulse" />
              Ativo
            </div>
          </div>

          {/* Description */}
          <p className="text-[#8ba5bb] text-sm mb-5 leading-relaxed">
            Receba leads de landing pages, formulários externos e qualquer sistema via HTTP.
          </p>

          {/* Endpoint display */}
          <div
            className="rounded-2xl p-4 mb-4"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-[10px] text-[#6b8fa8] uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
              <Globe size={10} />
              Endpoint
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="px-2 py-1 rounded-lg text-xs font-bold"
                style={{ background: "rgba(74,143,212,0.15)", color: "#4a8fd4" }}
              >
                POST
              </span>
              <code className="text-[#c7e5ff] text-xs font-mono break-all flex-1">{endpoint}</code>
              <CopyButton text={endpoint} />
            </div>
          </div>

          {/* API Key display */}
          <div
            className="rounded-2xl p-4 mb-5"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-[10px] text-[#6b8fa8] uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
              <Key size={10} />
              API Key  <span className="normal-case text-[#6b8fa8] font-normal">(header: X-Api-Key)</span>
            </p>
            <div className="flex items-center gap-2">
              <code className="text-[#c7e5ff] text-xs font-mono flex-1 break-all">
                {keyVisible ? apiKey : apiKey !== "—" ? "••••••••••••••••••••••••••••••••" : "—"}
              </code>
              <button
                onClick={() => setKeyVisible(v => !v)}
                className="text-[#6b8fa8] hover:text-white transition-colors text-xs px-2 py-1 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                {keyVisible ? "Ocultar" : "Mostrar"}
              </button>
              {userId && <CopyButton text={apiKey} />}
            </div>
          </div>

          {/* Stats */}
          <div
            className="grid grid-cols-2 gap-3 mb-5 p-4 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div>
              <p className="text-xl font-bold text-white">{count}</p>
              <p className="text-[10px] text-[#6b8fa8] mt-0.5">Leads recebidos</p>
            </div>
            <div className="border-l pl-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <p className="text-sm font-semibold text-[#c7e5ff]">
                {lastLead ? fmtRelative(lastLead.created_at) : "—"}
              </p>
              <p className="text-[10px] text-[#6b8fa8] mt-0.5">Último envio</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowTest(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, rgba(74,143,212,0.2), rgba(74,143,212,0.1))",
                border: "1px solid rgba(74,143,212,0.3)",
                color: "#4a8fd4",
                boxShadow: "0 2px 12px rgba(74,143,212,0.1)",
              }}
            >
              <Zap size={14} />
              Testar
            </button>

            <button
              onClick={() => setShowLogs(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-95"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#8ba5bb",
              }}
            >
              <FileText size={14} />
              Ver Logs
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showLogs && (
          <WebhookLogsModal
            lastLead={lastLead}
            count={count}
            onClose={() => setShowLogs(false)}
          />
        )}
        {showTest && userId && (
          <TestWebhookModal
            apiKey={userId}
            onClose={() => setShowTest(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Account Picker (OAuth return) ─────────────────────────────────────────────

function OAuthPendingBanner({
  pendingId,
  onDismiss,
}: {
  pendingId: string;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-4 rounded-2xl text-sm mb-2"
      style={{
        background: "rgba(74,143,212,0.1)",
        border: "1px solid rgba(74,143,212,0.25)",
        color: "#4a8fd4",
      }}
    >
      <Clock size={14} className="shrink-0" />
      <span>
        Autorização Meta recebida. Para finalizar a conexão, acesse{" "}
        <a href={`/trafego?tab=integracoes&meta_pending=${pendingId}`} className="underline font-medium">
          Tráfego → Integrações
        </a>
        {" "}e selecione a conta de anúncios.
      </span>
      <button onClick={onDismiss} className="ml-auto shrink-0 hover:opacity-70 transition-opacity">
        <X size={14} />
      </button>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CrmIntegracoes() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const pendingId    = searchParams.get("meta_pending");
  const hasError     = searchParams.get("meta_error");

  const [dismissedPending, setDismissedPending] = useState(false);

  const {
    userId, metaConnections, metaPages,
    lastMetaLead, webhookLeadCount, lastWebhookLead,
    isLoading, error, refetch, disconnectMeta, initiateMetaOAuth,
  } = useCrmIntegrations();

  return (
    <div className="px-4 sm:px-6 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between py-6 border-b mb-8"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Plug size={18} className="text-[#4a8fd4]" />
            Integrações CRM
          </h1>
          <p className="text-[#6b8fa8] text-sm mt-1">
            Conecte canais para receber leads automaticamente
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refetch}
            disabled={isLoading}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#6b8fa8] hover:text-white transition-all"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => router.push("/crm")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-95"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#8ba5bb",
            }}
          >
            <ArrowLeft size={14} />
            Voltar ao CRM
          </button>
        </div>
      </div>

      {/* OAuth pending banner */}
      {pendingId && !dismissedPending && (
        <OAuthPendingBanner pendingId={pendingId} onDismiss={() => setDismissedPending(true)} />
      )}

      {/* Error banner */}
      {hasError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-4 rounded-2xl mb-6 text-red-400 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <AlertTriangle size={14} />
          Falha na autenticação com o Meta. Tente novamente.
        </motion.div>
      )}

      {/* Global error */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl mb-6 text-red-400 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#4a8fd4]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <MetaAdsCard
            connections={metaConnections}
            pages={metaPages}
            lastLead={lastMetaLead}
            onConnect={initiateMetaOAuth}
            onDisconnect={disconnectMeta}
          />
          <WebhookCard
            userId={userId}
            count={webhookLeadCount}
            lastLead={lastWebhookLead}
          />
        </div>
      )}

      {/* Tip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 flex items-start gap-3 p-4 rounded-2xl text-xs text-[#6b8fa8]"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <Zap size={13} className="text-[#4a8fd4] shrink-0 mt-0.5" />
        <p>
          Leads recebidos via Meta Lead Ads ou Webhook chegam automaticamente na coluna{" "}
          <strong className="text-[#8ba5bb]">Abordados</strong> do funil e disparam uma notificação em tempo real.
        </p>
      </motion.div>
    </div>
  );
}
