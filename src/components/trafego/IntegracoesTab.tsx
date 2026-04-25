"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plug, RefreshCw, Unplug, CheckCircle2, XCircle, Clock,
  AlertTriangle, ChevronDown, X, Loader2, Zap, ShieldCheck,
  BarChart2, Users,
} from "lucide-react";
import { useMetaIntegrations } from "@/hooks/useMetaIntegrations";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import { cn } from "@/lib/utils";
import type { AdPlatformAccount, MetaAdAccount, MetaSyncLog } from "@/types";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";

// ── Formatters ─────────────────────────────────────────────────────────────────

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
};

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  connected:    { label: "Conectado",    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25", icon: <CheckCircle2 size={12} /> },
  disconnected: { label: "Desconectado", color: "text-[#b4b4b4] bg-[#b4b4b4]/10 border-[#b4b4b4]/25",    icon: <Unplug size={12} /> },
  pending:      { label: "Pendente",     color: "text-amber-400 bg-amber-400/10 border-amber-400/25",     icon: <Clock size={12} /> },
  error:        { label: "Erro",         color: "text-red-400 bg-red-400/10 border-red-400/25",           icon: <XCircle size={12} /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", cfg.color)}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Account Picker Modal ───────────────────────────────────────────────────────

interface AccountPickerProps {
  pendingId: string;
  defaultClientId: string | null;
  onClose: () => void;
  onConnect: (params: {
    pendingId: string;
    adAccountId: string;
    adAccountName: string;
    clientId?: string | null;
  }) => Promise<{ error: string | null }>;
  fetchPending: (id: string) => Promise<MetaAdAccount[]>;
  clients: Array<{ id: string; name: string }>;
}

function AccountPickerModal({
  pendingId, defaultClientId, onClose, onConnect, fetchPending, clients,
}: AccountPickerProps) {
  useModalOpen(true);
  const [accounts, setAccounts]   = useState<MetaAdAccount[]>([]);
  const [selected, setSelected]   = useState<string>("");
  const [clientId, setClientId]   = useState<string>(defaultClientId ?? "");
  const [search, setSearch]       = useState<string>("");
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [fetchErr, setFetchErr]   = useState<string | null>(null);
  const [saveErr, setSaveErr]     = useState<string | null>(null);

  useEffect(() => {
    fetchPending(pendingId)
      .then(accs => { setAccounts(accs); if (accs.length === 1) setSelected(accs[0].id); })
      .catch(e => setFetchErr(String(e)))
      .finally(() => setLoading(false));
  }, [pendingId, fetchPending]);

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleConnect = async () => {
    if (!selected) return;
    const acc = accounts.find(a => a.id === selected);
    if (!acc) return;
    setSaving(true);
    setSaveErr(null);
    const { error } = await onConnect({
      pendingId,
      adAccountId:   acc.id,
      adAccountName: acc.name,
      clientId:      clientId || null,
    });
    if (error) { setSaveErr(error); setSaving(false); }
    else onClose();
  };

  const selectedAcc = accounts.find(a => a.id === selected);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full sm:max-w-lg z-10 flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "rgba(12,12,14,0.07)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "none",
          maxHeight: "90dvh",
        }}
      >
        {/* ── Fixed Header ─────────────────────────────────── */}
        <div className="shrink-0 px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-white font-semibold text-base leading-tight">Selecionar conta de anúncio</h3>
              <p className="text-[#b4b4b4] text-xs mt-1">Escolha a conta Meta Ads para conectar ao dashboard</p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 text-[#b4b4b4] hover:text-white transition-colors mt-0.5"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search */}
          {!loading && !fetchErr && accounts.length > 3 && (
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar conta por nome ou ID…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white placeholder-[#5a5a5a] outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a5a]"
                width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5a5a] hover:text-[#b4b4b4] transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Scrollable Body ───────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto px-5 py-3 space-y-4 picker-scroll"
          style={{ minHeight: 0 }}
        >
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={24} className="animate-spin text-[#4a8fd4]" />
              <p className="text-[#b4b4b4] text-xs">Carregando contas…</p>
            </div>
          )}

          {/* Fetch error */}
          {!loading && fetchErr && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
              <AlertTriangle size={14} className="shrink-0" />
              {fetchErr}
            </div>
          )}

          {/* Account list */}
          {!loading && !fetchErr && (
            <>
              {/* Ad account cards */}
              <div>
                <label className="block text-[10px] font-semibold text-[#5a5a5a] uppercase tracking-widest mb-2.5">
                  {accounts.length} conta{accounts.length !== 1 ? "s" : ""} disponíve{accounts.length !== 1 ? "is" : "l"}
                </label>
                <div className="space-y-2">
                  {filtered.map(acc => {
                    const isSelected = selected === acc.id;
                    const statusOk = acc.account_status === 1;
                    return (
                      <button
                        key={acc.id}
                        onClick={() => setSelected(acc.id)}
                        className={cn(
                          "group w-full flex items-center gap-3.5 p-3.5 rounded-xl text-left transition-all duration-150 relative overflow-hidden",
                          isSelected
                            ? "text-white"
                            : "text-[#b4b4b4] hover:text-white"
                        )}
                        style={{
                          background: isSelected
                            ? "rgba(74,143,212,0.12)"
                            : "rgba(255,255,255,0.03)",
                          border: isSelected
                            ? "1px solid rgba(74,143,212,0.40)"
                            : "1px solid rgba(255,255,255,0.07)",
                          boxShadow: isSelected
                            ? "0 0 0 1px rgba(74,143,212,0.15), inset 0 1px 0 rgba(255,255,255,0.05)"
                            : "none",
                        }}
                      >
                        {/* Glow on selected */}
                        {isSelected && (
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: "radial-gradient(ellipse at 20% 50%, rgba(74,143,212,0.08) 0%, transparent 70%)",
                            }}
                          />
                        )}

                        {/* Radio indicator */}
                        <div className="relative shrink-0 flex items-center justify-center w-5 h-5 rounded-full transition-all duration-150"
                          style={{
                            border: isSelected ? "2px solid #4a8fd4" : "2px solid rgba(255,255,255,0.20)",
                            background: isSelected ? "rgba(74,143,212,0.15)" : "transparent",
                          }}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full" style={{ background: "#4a8fd4" }} />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-medium text-sm truncate leading-tight", isSelected ? "text-white" : "text-[#d4d4d4] group-hover:text-white")}>
                            {acc.name}
                          </p>
                          <p className="text-[11px] text-[#5a5a5a] mt-0.5 font-mono">{acc.id}</p>
                        </div>

                        {/* Status pill */}
                        <div className={cn(
                          "shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                          statusOk
                            ? "bg-emerald-400/10 text-emerald-400"
                            : "bg-[#b4b4b4]/10 text-[#b4b4b4]"
                        )}>
                          <div className={cn("w-1.5 h-1.5 rounded-full", statusOk ? "bg-emerald-400" : "bg-[#b4b4b4]")} />
                          {statusOk ? "Ativa" : "Inativa"}
                        </div>

                        {/* Check icon on selected */}
                        {isSelected && (
                          <CheckCircle2 size={15} className="shrink-0 text-[#4a8fd4]" />
                        )}
                      </button>
                    );
                  })}

                  {filtered.length === 0 && accounts.length > 0 && (
                    <div className="flex flex-col items-center py-8 gap-2 text-[#5a5a5a]">
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                      </svg>
                      <p className="text-sm">Nenhuma conta encontrada para &ldquo;{search}&rdquo;</p>
                    </div>
                  )}

                  {accounts.length === 0 && (
                    <div className="flex flex-col items-center py-8 gap-2 text-[#5a5a5a]">
                      <Users size={20} />
                      <p className="text-sm">Nenhuma conta ativa encontrada</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Client link */}
              {clients.length > 0 && (
                <div>
                  <label className="block text-[10px] font-semibold text-[#5a5a5a] uppercase tracking-widest mb-2.5">
                    Vincular ao cliente (opcional)
                  </label>
                  <div className="relative">
                    <select
                      value={clientId}
                      onChange={e => setClientId(e.target.value)}
                      className="w-full appearance-none px-3 py-2.5 rounded-xl text-sm text-white outline-none pr-8 transition-colors"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <option value="">Sem vínculo</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5a5a] pointer-events-none" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Fixed Footer ──────────────────────────────────── */}
        {!loading && !fetchErr && (
          <div
            className="shrink-0 px-5 py-4 space-y-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.15)" }}
          >
            {saveErr && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
                <AlertTriangle size={14} className="shrink-0" />
                {saveErr}
              </div>
            )}

            {/* Selected account preview */}
            {selectedAcc && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(74,143,212,0.08)", border: "1px solid rgba(74,143,212,0.15)" }}>
                <CheckCircle2 size={13} className="text-[#4a8fd4] shrink-0" />
                <p className="text-xs text-[#b4b4b4] truncate">
                  <span className="text-white font-medium">{selectedAcc.name}</span>
                  <span className="ml-1.5 font-mono text-[#5a5a5a]">{selectedAcc.id}</span>
                </p>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#b4b4b4] hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Cancelar
              </button>
              <PrimaryButton
                onClick={handleConnect}
                disabled={!selected || saving}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                {saving ? "Conectando…" : "Confirmar seleção"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </motion.div>

      {/* Custom scrollbar styles */}
      <style>{`
        .picker-scroll::-webkit-scrollbar { width: 4px; }
        .picker-scroll::-webkit-scrollbar-track { background: transparent; }
        .picker-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 99px; }
        .picker-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
        .picker-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.10) transparent; }
      `}</style>
    </div>
  );
}

// ── Single Meta account row ────────────────────────────────────────────────────

interface MetaAccountRowProps {
  account:      AdPlatformAccount;
  lastLog:      MetaSyncLog | null;
  isSyncing:    boolean;
  isDisconnecting: boolean;
  onSync:       () => void;
  onReconnect:  () => void;
  onDisconnect: () => void;
  index:        number;
}

function MetaAccountRow({
  account, lastLog, isSyncing, isDisconnecting, onSync, onReconnect, onDisconnect, index,
}: MetaAccountRowProps) {
  const isConnected = account.status === "connected";
  const hasError    = account.status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="rounded-xl p-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: hasError
          ? "1px solid rgba(239,68,68,0.20)"
          : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Meta icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
          style={{ background: "linear-gradient(135deg, #0081fb 0%, #0064e0 100%)" }}
        >
          M
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-medium text-sm truncate">{account.account_name}</p>
            <StatusBadge status={account.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-[#5a5a5a] flex-wrap">
            <span className="font-mono">{account.account_id ?? "—"}</span>
            {account.client && (
              <span className="flex items-center gap-1">
                <Users size={9} />
                {account.client.name}
              </span>
            )}
            {account.last_sync_at && (
              <span>Sync: {fmtDate(account.last_sync_at)}</span>
            )}
          </div>

          {/* Last log info */}
          {lastLog && (
            <div className="flex items-center gap-3 mt-1.5 text-[11px]">
              {lastLog.status === "success" && (
                <>
                  <span className="flex items-center gap-1 text-emerald-400/70">
                    <Zap size={9} /> {lastLog.campaigns_synced} camp.
                  </span>
                  <span className="flex items-center gap-1 text-[#4a8fd4]/70">
                    <BarChart2 size={9} /> {lastLog.metrics_synced} métr.
                  </span>
                </>
              )}
              {lastLog.status === "error" && (
                <span className="text-red-400/80 truncate max-w-[200px]">
                  {lastLog.error_message}
                </span>
              )}
            </div>
          )}

          {hasError && (
            <div className="flex items-center gap-1.5 mt-2 text-red-400 text-[11px]">
              <AlertTriangle size={10} />
              Token expirado ou erro. Reconecte a conta.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {(isConnected || hasError) && (
            <button
              onClick={onSync}
              disabled={isSyncing || isDisconnecting}
              title="Sincronizar agora"
              className="p-1.5 rounded-lg text-[#4a8fd4] hover:bg-[#4a8fd4]/10 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
            </button>
          )}
          {hasError && (
            <button
              onClick={onReconnect}
              disabled={isDisconnecting}
              title="Reconectar conta"
              className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-40"
            >
              <Plug size={13} />
            </button>
          )}
          <button
            onClick={onDisconnect}
            disabled={isDisconnecting}
            title="Desconectar conta"
            className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
          >
            {isDisconnecting ? <Loader2 size={13} className="animate-spin" /> : <Unplug size={13} />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Meta Ads section (all accounts) ───────────────────────────────────────────

interface MetaSectionProps {
  accounts:         AdPlatformAccount[];
  syncLogs:         MetaSyncLog[];
  syncing:          Record<string, boolean>;
  disconnecting:    Record<string, boolean>;
  onAddAccount:     () => void;
  onSync:           (id: string) => void;
  onReconnect:      () => void;
  onDisconnect:     (id: string) => void;
}

function MetaAdsSection({
  accounts, syncLogs, syncing, disconnecting,
  onAddAccount, onSync, onReconnect, onDisconnect,
}: MetaSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "rgba(14,22,34,0.7)", border: "none" }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #0081fb 0%, #0064e0 100%)" }}
          >
            M
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Meta Ads</p>
            <p className="text-[#b4b4b4] text-xs">
              {accounts.length === 0
                ? "Nenhuma conta conectada"
                : `${accounts.length} conta${accounts.length !== 1 ? "s" : ""} conectada${accounts.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {/* Add account button */}
        <button
          onClick={onAddAccount}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-[#4a8fd4] hover:bg-[#4a8fd4]/10 transition-all"
          style={{ border: "1px solid rgba(74,143,212,0.25)" }}
        >
          <Plug size={13} />
          {accounts.length === 0 ? "Conectar" : "Adicionar conta"}
        </button>
      </div>

      {/* Account rows */}
      {accounts.length > 0 && (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {accounts.map((acc, i) => {
              const lastLog = syncLogs.find(l => l.platform_account_id === acc.id) ?? null;
              return (
                <MetaAccountRow
                  key={acc.id}
                  account={acc}
                  lastLog={lastLog}
                  isSyncing={syncing[acc.id] ?? false}
                  isDisconnecting={disconnecting[acc.id] ?? false}
                  onSync={() => onSync(acc.id)}
                  onReconnect={onReconnect}
                  onDisconnect={() => onDisconnect(acc.id)}
                  index={i}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {accounts.length === 0 && (
        <div className="flex flex-col items-center py-6 gap-2 text-[#5a5a5a]">
          <Plug size={20} />
          <p className="text-sm">Conecte uma conta Meta Ads para importar campanhas e métricas</p>
        </div>
      )}
    </motion.div>
  );
}


// ── Sync Log Table ─────────────────────────────────────────────────────────────

function SyncHistory({ logs }: { logs: MetaSyncLog[] }) {
  if (logs.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="rounded-2xl p-5"
      style={{ background: "rgba(14,22,34,0.7)", border: "none" }}
    >
      <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
        <Clock size={14} className="text-[#4a8fd4]" />
        Histórico de sincronizações
      </h3>
      <div className="space-y-2">
        {logs.slice(0, 8).map(log => (
          <div key={log.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 min-w-0">
              {log.status === "success" && <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />}
              {log.status === "running" && <Loader2 size={12} className="animate-spin text-[#4a8fd4] shrink-0" />}
              {log.status === "error"   && <XCircle size={12} className="text-red-400 shrink-0" />}
              <span className="text-[#c7e5ff] text-xs">{fmtDate(log.started_at)}</span>
              {log.status === "error" && (
                <span className="text-red-400 text-xs truncate">{log.error_message}</span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 text-xs text-[#b4b4b4]">
              <span>{log.campaigns_synced}c</span>
              <span>{log.metrics_synced}m</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function IntegracoesTab() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const {
    connections, syncLogs, isLoading, syncing, error,
    initiateOAuth, connectAccount, syncAccount, disconnect, fetchPendingAccounts,
  } = useMetaIntegrations();

  const { clients } = useAgencyClients();

  // Detect OAuth return with pending connection
  const pendingId      = searchParams.get("meta_pending");
  const defaultClient  = searchParams.get("meta_client");
  const hasError       = searchParams.get("meta_error");

  const [showPicker, setShowPicker]         = useState(!!pendingId);
  const [disconnecting, setDisconnecting]   = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (pendingId) setShowPicker(true);
  }, [pendingId]);

  const closePicker = useCallback(() => {
    setShowPicker(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("meta_pending");
    url.searchParams.delete("meta_client");
    url.searchParams.delete("meta_error");
    router.replace(url.pathname + "?" + url.searchParams.toString());
  }, [router]);

  const handleDisconnect = useCallback(async (id: string) => {
    setDisconnecting(prev => ({ ...prev, [id]: true }));
    await disconnect(id);
    setDisconnecting(prev => ({ ...prev, [id]: false }));
  }, [disconnect]);

  // All connected Meta accounts
  const metaAccounts = connections.filter(c => c.platform === "meta");

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between"
        >
          <div>
            <h2 className="text-white font-semibold text-base flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#4a8fd4]" />
              Integrações de Tráfego
            </h2>
            <p className="text-[#b4b4b4] text-xs mt-1">
              Conecte suas contas de mídia para importar dados automaticamente
            </p>
          </div>
        </motion.div>

        {/* OAuth error banner */}
        {hasError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-4 rounded-2xl bg-red-400/10 border border-red-400/25 text-red-400 text-sm"
          >
            <AlertTriangle size={15} />
            Falha na autenticação com o Meta. Tente novamente.
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#4a8fd4]" />
          </div>
        ) : (
          <>
            {/* Platform integrations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
              {/* Meta Ads — multi-account section */}
              <div className="lg:col-span-2">
                <MetaAdsSection
                  accounts={metaAccounts}
                  syncLogs={syncLogs}
                  syncing={syncing}
                  disconnecting={disconnecting}
                  onAddAccount={() => initiateOAuth(defaultClient)}
                  onSync={(id) => syncAccount(id)}
                  onReconnect={() => initiateOAuth(defaultClient)}
                  onDisconnect={handleDisconnect}
                />
              </div>

            </div>

            {/* Sync history */}
            <SyncHistory logs={syncLogs} />
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-400/10 border border-red-400/25 text-red-400 text-sm">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}
      </div>

      {/* Account picker modal */}
      <AnimatePresence>
        {showPicker && pendingId && (
          <AccountPickerModal
            pendingId={pendingId}
            defaultClientId={defaultClient}
            onClose={closePicker}
            onConnect={async (params) => {
              const result = await connectAccount(params);
              if (!result.error) closePicker();
              return result;
            }}
            fetchPending={fetchPendingAccounts}
            clients={clients.map(c => ({ id: c.id, name: c.name }))}
          />
        )}
      </AnimatePresence>
    </>
  );
}
