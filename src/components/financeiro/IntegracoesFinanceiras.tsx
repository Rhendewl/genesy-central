"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plug2, Unplug, CheckCircle2, XCircle, Clock,
  AlertTriangle, X, Loader2, ShieldCheck, Settings,
  Building2, CreditCard, BarChart3, Users, Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAsaasIntegration, type AsaasEnv } from "@/hooks/useAsaasIntegration";

// ─── Status badge ─────────────────────────────────────────────────────────────

type BadgeStatus = "disconnected" | "connected" | "error" | "idle";

const STATUS_CFG: Record<BadgeStatus, { label: string; color: string; icon: React.ReactNode }> = {
  idle:         { label: "Verificando…",  color: "text-[#b4b4b4] bg-[#b4b4b4]/10 border-[#b4b4b4]/25",    icon: <Loader2 size={12} className="animate-spin" /> },
  disconnected: { label: "Não conectado", color: "text-[#b4b4b4] bg-[#b4b4b4]/10 border-[#b4b4b4]/25",    icon: <Unplug size={12} /> },
  connected:    { label: "Conectado",     color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25", icon: <CheckCircle2 size={12} /> },
  error:        { label: "Erro",          color: "text-red-400 bg-red-400/10 border-red-400/25",            icon: <XCircle size={12} /> },
};

function StatusBadge({ status }: { status: BadgeStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
      cfg.color,
    )}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Connect Modal ────────────────────────────────────────────────────────────

interface ConnectModalProps {
  isConnecting: boolean;
  connectError: string | null;
  onClose:      () => void;
  onConnect:    (apiKey: string, env: AsaasEnv) => Promise<{ error: string | null }>;
}

function ConnectModal({ isConnecting, connectError, onClose, onConnect }: ConnectModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [env, setEnv]       = useState<AsaasEnv>("sandbox");

  const handleSubmit = async () => {
    if (!apiKey.trim() || isConnecting) return;
    const { error } = await onConnect(apiKey.trim(), env);
    if (!error) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!isConnecting ? onClose : undefined} />

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full sm:max-w-md z-10 rounded-t-2xl sm:rounded-2xl lc-modal-panel overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-white text-sm"
                style={{
                  background: "linear-gradient(135deg, #00c2ff 0%, #0070ff 100%)",
                  boxShadow: "0 4px 12px rgba(0,112,255,0.30)",
                }}
              >
                A
              </div>
              <div>
                <h3 className="text-white font-semibold text-base">Conectar Asaas</h3>
                <p className="text-[#b4b4b4] text-xs mt-0.5">Configure sua integração de pagamentos</p>
              </div>
            </div>
            <button
              onClick={!isConnecting ? onClose : undefined}
              disabled={isConnecting}
              className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-white/8 transition-colors disabled:opacity-40"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* API Key */}
          <div>
            <label className="block text-[10px] font-semibold text-[#5a5a5a] uppercase tracking-widest mb-2">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="$aact_…"
              disabled={isConnecting}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-[#5a5a5a] outline-none lc-filter-control disabled:opacity-50"
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
            />
          </div>

          {/* Environment */}
          <div>
            <label className="block text-[10px] font-semibold text-[#5a5a5a] uppercase tracking-widest mb-2">
              Ambiente
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["sandbox", "production"] as const).map(e => (
                <button
                  key={e}
                  onClick={() => setEnv(e)}
                  disabled={isConnecting}
                  className={cn(
                    "py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50",
                    env === e ? "text-white" : "text-[#b4b4b4] hover:text-white",
                  )}
                  style={{
                    background: env === e ? "rgba(74,143,212,0.15)" : "rgba(255,255,255,0.04)",
                    border: env === e
                      ? "1px solid rgba(74,143,212,0.40)"
                      : "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  {e === "sandbox" ? "Sandbox" : "Produção"}
                </button>
              ))}
            </div>
          </div>

          {/* Error feedback */}
          {connectError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 p-3.5 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-sm"
            >
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {connectError}
            </motion.div>
          )}

          {/* Security note */}
          <div
            className="flex items-start gap-2.5 p-3.5 rounded-xl"
            style={{ background: "rgba(74,143,212,0.06)", border: "1px solid rgba(74,143,212,0.15)" }}
          >
            <ShieldCheck size={14} className="text-[#4a8fd4] shrink-0 mt-0.5" />
            <p className="text-xs text-[#b4b4b4]">
              Sua chave é armazenada de forma segura e usada apenas no servidor.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 pb-6 pt-5 flex gap-2.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={onClose}
            disabled={isConnecting}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#b4b4b4] hover:text-white transition-colors disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Cancelar
          </button>
          <PrimaryButton
            onClick={handleSubmit}
            disabled={!apiKey.trim() || isConnecting}
            className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm"
          >
            {isConnecting ? <Loader2 size={14} className="animate-spin" /> : <Plug2 size={14} />}
            {isConnecting ? "Ativando integração…" : "Ativar integração"}
          </PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Coming-soon card ─────────────────────────────────────────────────────────

interface ComingSoonCardProps {
  name:   string;
  icon:   React.ReactNode;
  desc:   string;
  delay?: number;
}

function ComingSoonCard({ name, icon, desc, delay = 0 }: ComingSoonCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="relative rounded-2xl p-4 flex items-center gap-4 overflow-hidden"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 opacity-35"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#5a5a5a] font-medium text-sm">{name}</p>
        <p className="text-[#3a3a3a] text-xs mt-0.5">{desc}</p>
      </div>
      <span
        className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold text-[#4a4a4a] uppercase tracking-widest"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        Em breve
      </span>
    </motion.div>
  );
}

// ─── Stat mini-card ───────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <p className="text-[#5a5a5a] text-[10px] font-semibold uppercase tracking-widest mb-1">{label}</p>
      <p className="text-white font-semibold text-sm truncate">{value}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IntegracoesFinanceiras() {
  const {
    integration,
    isLoading,
    isConnecting,
    isDisconnecting,
    connectError,
    connect,
    disconnect,
  } = useAsaasIntegration();

  const [showModal, setShowModal]         = useState(false);
  const [showSettings, setShowSettings]   = useState(false);

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  };

  const isConnected    = integration.status === "connected";
  const isDisconnected = integration.status === "disconnected";
  const hasError       = integration.status === "error";
  const badgeStatus: BadgeStatus =
    isLoading ? "idle" : isConnected ? "connected" : hasError ? "error" : "disconnected";

  return (
    <>
      <div className="space-y-8 pt-4">

        {/* ── Page header ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <h2 className="text-white font-bold text-xl tracking-tight">Integrações Financeiras</h2>
          <p className="text-[#b4b4b4] text-sm mt-1">
            Conecte plataformas para automatizar receitas, cobranças e métricas em tempo real.
          </p>
        </motion.div>

        {/* ── Asaas card ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.06 }}
          className="lc-card p-6 space-y-5"
        >
          {/* Top row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-bold text-white text-lg"
                style={{
                  background: "linear-gradient(135deg, #00c2ff 0%, #0070ff 100%)",
                  boxShadow: "0 4px 16px rgba(0,112,255,0.28)",
                }}
              >
                A
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-white font-semibold text-base">Asaas</p>
                  <StatusBadge status={badgeStatus} />
                </div>
                <p className="text-[#b4b4b4] text-xs mt-1">
                  Gateway de pagamentos, assinaturas e cobranças automáticas.
                  {isConnected && integration.accountName && (
                    <span className="ml-1.5 text-white/60">{integration.accountName}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Actions */}
            {!isLoading && (
              <div className="flex items-center gap-2 flex-wrap">
                {isDisconnected && (
                  <PrimaryButton
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm"
                  >
                    <Plug2 size={14} />
                    Conectar
                  </PrimaryButton>
                )}

                {(isConnected || hasError) && (
                  <>
                    <button
                      onClick={() => setShowSettings(s => !s)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                        showSettings
                          ? "text-white bg-white/8"
                          : "text-[#b4b4b4] hover:text-white hover:bg-white/5",
                      )}
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <Settings size={13} />
                      Configurações
                    </button>
                    <button
                      onClick={async () => { await disconnect(); setShowSettings(false); }}
                      disabled={isDisconnecting}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-[#b4b4b4] hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40"
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {isDisconnecting ? <Loader2 size={13} className="animate-spin" /> : <Unplug size={13} />}
                      Desconectar
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Error banner */}
          {hasError && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
              <AlertTriangle size={14} className="shrink-0" />
              Token inválido ou expirado. Reconecte para restaurar a integração.
            </div>
          )}

          {/* Connected stats */}
          <AnimatePresence>
            {isConnected && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatCard
                      label="Ambiente"
                      value={integration.environment === "production" ? "Produção" : "Sandbox"}
                    />
                    <StatCard
                      label="Conectado em"
                      value={fmtDate(integration.createdAt)}
                    />
                    <StatCard
                      label="Última verificação"
                      value={fmtDate(integration.lastSyncAt)}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Settings panel */}
          <AnimatePresence>
            {showSettings && isConnected && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px] font-semibold text-[#5a5a5a] uppercase tracking-widest flex items-center gap-2">
                    <Clock size={11} />
                    Configurações da integração
                  </p>
                  <div
                    className="flex items-center justify-between gap-4 p-3.5 rounded-xl flex-wrap"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div>
                      <p className="text-white text-sm font-medium">Trocar API Key</p>
                      <p className="text-[#5a5a5a] text-xs mt-0.5">Substitua a chave sem remover a integração</p>
                    </div>
                    <button
                      onClick={() => { setShowModal(true); setShowSettings(false); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-[#4a8fd4] hover:bg-[#4a8fd4]/10 transition-all"
                      style={{ border: "1px solid rgba(74,143,212,0.25)" }}
                    >
                      <Settings size={13} />
                      Atualizar chave
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Skeleton while loading */}
          {isLoading && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 size={14} className="animate-spin text-[#5a5a5a]" />
              <p className="text-[#5a5a5a] text-xs">Verificando integração…</p>
            </div>
          )}
        </motion.div>

        {/* ── Em breve ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.14 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3">
            <p className="text-[#5a5a5a] text-xs font-semibold uppercase tracking-widest whitespace-nowrap">
              Em breve
            </p>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ComingSoonCard
              name="Kommo"
              icon={<Users size={18} className="text-[#5a5a5a]" />}
              desc="CRM e automação de vendas"
              delay={0.18}
            />
            <ComingSoonCard
              name="Stripe"
              icon={<CreditCard size={18} className="text-[#5a5a5a]" />}
              desc="Pagamentos internacionais"
              delay={0.22}
            />
            <ComingSoonCard
              name="Mercado Pago"
              icon={<BarChart3 size={18} className="text-[#5a5a5a]" />}
              desc="Gateway brasileiro de pagamentos"
              delay={0.26}
            />
            <ComingSoonCard
              name="Conta bancária"
              icon={<Landmark size={18} className="text-[#5a5a5a]" />}
              desc="OFX, Open Finance e extrato automático"
              delay={0.30}
            />
            <ComingSoonCard
              name="ERP"
              icon={<Building2 size={18} className="text-[#5a5a5a]" />}
              desc="Importação de dados de sistemas ERP"
              delay={0.34}
            />
          </div>
        </motion.div>
      </div>

      {/* ── Connect modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <ConnectModal
            isConnecting={isConnecting}
            connectError={connectError}
            onClose={() => setShowModal(false)}
            onConnect={connect}
          />
        )}
      </AnimatePresence>
    </>
  );
}
