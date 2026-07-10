"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, Wallet, Building2, CreditCard, CheckCircle2,
  AlertTriangle, XCircle, Loader2, Clock, WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortalAccountBalance } from "@/types";
import { META_BR_TAX_RATE } from "@/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtCurrency(v: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

// ── Account status helpers ────────────────────────────────────────────────────

function getStatusConfig(status: number) {
  if (status === 1) return {
    label: "Ativa",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.25)",
    color: "#22c55e",
    Icon: CheckCircle2,
  };
  if (status === 2) return {
    label: "Desativada",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.22)",
    color: "#ef4444",
    Icon: XCircle,
  };
  if (status === 0) return {
    label: "Erro",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.22)",
    color: "#ef4444",
    Icon: AlertTriangle,
  };
  return {
    label: "Pendente",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.22)",
    color: "#f59e0b",
    Icon: Clock,
  };
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry, loading }: {
  message: string;
  onRetry: () => void;
  loading: boolean;
}) {
  return (
    <div className="lc-portal-card rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-4">
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
      >
        <WifiOff size={18} className="text-red-400" strokeWidth={1.6} />
      </div>
      <div className="flex-1 text-center sm:text-left">
        <p className="text-[color-mix(in_srgb,var(--text-title)_70%,transparent)] text-sm font-medium">{message}</p>
        <p className="text-[color-mix(in_srgb,var(--text-title)_30%,transparent)] text-xs mt-0.5">Verifique a conexão com a conta Meta.</p>
      </div>
      <RefreshButton loading={loading} onClick={onRetry} />
    </div>
  );
}

// ── Refresh button ────────────────────────────────────────────────────────────

function RefreshButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0",
        "disabled:opacity-40 disabled:cursor-not-allowed"
      )}
      style={{
        background: loading
          ? "var(--shimmer-base)"
          : "rgba(39,163,255,0.12)",
        border: "1px solid rgba(39,163,255,0.22)",
        color: "#27a3ff",
      }}
      onMouseEnter={e => {
        if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(39,163,255,0.2)";
      }}
      onMouseLeave={e => {
        if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(39,163,255,0.12)";
      }}
    >
      {loading
        ? <Loader2 size={13} className="animate-spin" />
        : <RefreshCw size={13} />
      }
      {loading ? "Atualizando..." : "Atualizar saldo"}
    </button>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="lc-portal-card rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Icon placeholder */}
        <div className="w-12 h-12 rounded-2xl bg-[var(--shimmer-light)] animate-pulse shrink-0" />
        {/* Text placeholders */}
        <div className="flex-1 space-y-2.5">
          <div className="h-3.5 bg-[var(--shimmer-base)] rounded-full animate-pulse w-40" />
          <div className="h-2.5 bg-[var(--shimmer-light)] rounded-full animate-pulse w-28" />
        </div>
        {/* Balance placeholder */}
        <div className="space-y-1.5 text-right">
          <div className="h-7 bg-[var(--shimmer-base)] rounded-full animate-pulse w-32" />
          <div className="h-2.5 bg-[var(--shimmer-light)] rounded-full animate-pulse w-24 ml-auto" />
        </div>
      </div>
    </div>
  );
}

// ── Account balance card ──────────────────────────────────────────────────────

function AccountCard({ bal, index }: { bal: PortalAccountBalance; index: number }) {
  const statusCfg = getStatusConfig(bal.account_status);
  const isError = bal.account_status === 0;
  const taxPct = (META_BR_TAX_RATE * 100).toFixed(2);
  const fetchedTime = format(new Date(bal.fetched_at), "HH:mm:ss", { locale: ptBR });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="lc-portal-card rounded-3xl overflow-hidden"
    >
      {/* Top accent line if active */}
      {bal.account_status === 1 && (
        <div
          className="h-px w-full"
          style={{ background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.4), transparent)" }}
        />
      )}

      <div className="p-5 sm:p-6">
        {/* ── Row 1: account info + balance ──────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">

          {/* Left: icon + names */}
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: isError ? "rgba(239,68,68,0.1)" : "rgba(39,163,255,0.1)",
                border: isError ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(39,163,255,0.18)",
              }}
            >
              <Building2
                size={18}
                style={{ color: isError ? "#ef4444" : "#27a3ff" }}
                strokeWidth={1.6}
              />
            </div>

            <div className="min-w-0">
              <p className="text-[var(--text-title)] text-sm font-semibold leading-tight truncate">
                {bal.account_name}
              </p>
              <p className="text-[color-mix(in_srgb,var(--text-title)_35%,transparent)] text-[11px] mt-0.5 font-mono">
                {bal.account_id}
              </p>
            </div>
          </div>

          {/* Right: main balance display */}
          {!isError ? (
            <div className="sm:text-right">
              <div className="flex sm:flex-col sm:items-end gap-2 sm:gap-0.5">
                {/* Net balance — hero number */}
                <div>
                  <p className="text-[10px] text-[color-mix(in_srgb,var(--text-title)_30%,transparent)] uppercase tracking-wider mb-0.5 hidden sm:block">
                    Saldo disponível
                  </p>
                  <p
                    className={cn(
                      "text-2xl sm:text-3xl font-black tabular-nums leading-none",
                      bal.balance_net > 0 ? "text-emerald-400" : "text-[color-mix(in_srgb,var(--text-title)_50%,transparent)]"
                    )}
                    style={{
                      textShadow: bal.balance_net > 0 ? "0 0 20px rgba(34,197,94,0.3)" : "none",
                    }}
                  >
                    {fmtCurrency(bal.balance_net, bal.currency)}
                  </p>
                </div>

                {/* Gross in parens */}
                {bal.is_prepay && (
                  <p className="text-[color-mix(in_srgb,var(--text-title)_28%,transparent)] text-xs">
                    <span className="text-[color-mix(in_srgb,var(--text-title)_20%,transparent)]">(Bruto: </span>
                    {fmtCurrency(bal.balance_gross, bal.currency)}
                    <span className="text-[color-mix(in_srgb,var(--text-title)_20%,transparent)]">)</span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="sm:text-right">
              <p className="text-red-400/70 text-sm font-medium">Saldo indisponível</p>
              <p className="text-[color-mix(in_srgb,var(--text-title)_25%,transparent)] text-xs mt-0.5">Erro ao consultar a API</p>
            </div>
          )}
        </div>

        {/* ── Divider ──────────────────────────────────────────── */}
        <div className="h-px bg-[color-mix(in_srgb,var(--text-title)_6%,transparent)] my-4" />

        {/* ── Row 2: badges + meta info ────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          {/* Left badges */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status badge */}
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold"
              style={{
                background: statusCfg.bg,
                border: `1px solid ${statusCfg.border}`,
                color: statusCfg.color,
              }}
            >
              <statusCfg.Icon size={10} strokeWidth={2.2} />
              {statusCfg.label}
            </span>

            {/* Funding type badge */}
            {bal.funding_type && (
              <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium"
                style={{
                  background: "var(--shimmer-base)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--icon)",
                }}
              >
                <CreditCard size={10} strokeWidth={1.8} />
                {bal.funding_type}
              </span>
            )}

            {/* Currency badge */}
            <span
              className="px-2.5 py-1 rounded-xl text-[11px] font-mono font-medium"
              style={{
                background: "var(--shimmer-light)",
                border: "1px solid var(--glass-border)",
                color: "var(--icon)",
              }}
            >
              {bal.currency}
            </span>
          </div>

          {/* Fetch time */}
          <span className="text-[color-mix(in_srgb,var(--text-title)_20%,transparent)] text-[10px] flex items-center gap-1">
            <Clock size={9} />
            Consultado às {fetchedTime}
          </span>
        </div>

        {/* ── Tax note (only for BRL + prepay + active) ──────── */}
        {bal.is_prepay && bal.currency === "BRL" && bal.account_status === 1 && bal.balance_gross > 0 && (
          <p className="text-[color-mix(in_srgb,var(--text-title)_22%,transparent)] text-[10px] mt-3 leading-relaxed">
            Valor líquido já com desconto de {taxPct}% de impostos da Meta (IOF + taxa de serviço).
          </p>
        )}

        {/* ── Amount spent (if available) ──────────────────────── */}
        {bal.amount_spent > 0 && !isError && (
          <div
            className="flex items-center justify-between mt-3 pt-3"
            style={{ borderTop: "1px solid var(--border-color)" }}
          >
            <span className="text-[color-mix(in_srgb,var(--text-title)_30%,transparent)] text-[11px] flex items-center gap-1.5">
              <Wallet size={10} />
              Total gasto (período)
            </span>
            <span className="text-[color-mix(in_srgb,var(--text-title)_50%,transparent)] text-[11px] font-semibold tabular-nums">
              {fmtCurrency(bal.amount_spent, bal.currency)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface SaldoContaMetaProps { slug: string }

export function SaldoContaMeta({ slug }: SaldoContaMetaProps) {
  const [balances, setBalances]  = useState<PortalAccountBalance[]>([]);
  const [loading,  setLoading]   = useState(true);
  const [error,    setError]     = useState<string | null>(null);
  const [fetching, setFetching]  = useState(false);

  const fetchBalance = useCallback(async (isRefresh = false) => {
    if (isRefresh) setFetching(true);
    else setLoading(true);
    setError(null);

    try {
      // nc param busts any edge/CDN cache on refresh
      const nc = isRefresh ? `&nc=${Date.now()}` : "";
      const res = await fetch(`/api/portal/${slug}/balance?${nc}`);
      const json = await res.json() as { balances: PortalAccountBalance[]; error?: string };

      if (json.error && !json.balances?.length) {
        setError(json.error);
      } else {
        setBalances(json.balances ?? []);
      }
    } catch {
      setError("Erro de conexão ao consultar saldo");
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [slug]);

  useEffect(() => { fetchBalance(false); }, [fetchBalance]);

  const isLoading = loading || fetching;

  return (
    <section>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[var(--text-title)] font-semibold text-sm">Saldo da Conta</h3>
          <p className="text-[color-mix(in_srgb,var(--text-title)_35%,transparent)] text-xs mt-0.5">
            Saldo em tempo real da conta de anúncios Meta.
          </p>
        </div>
        {/* Show button only after initial load */}
        {!loading && (
          <RefreshButton loading={fetching} onClick={() => fetchBalance(true)} />
        )}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Skeleton />
          </motion.div>
        ) : error ? (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ErrorState
              message={error}
              onRetry={() => fetchBalance(true)}
              loading={fetching}
            />
          </motion.div>
        ) : balances.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="lc-portal-card rounded-3xl p-8 text-center">
              <Wallet size={24} className="text-[color-mix(in_srgb,var(--text-title)_15%,transparent)] mx-auto mb-3" strokeWidth={1.3} />
              <p className="text-[color-mix(in_srgb,var(--text-title)_30%,transparent)] text-sm">Nenhuma conta Meta conectada.</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="data"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              balances.length === 1
                ? ""
                : "grid grid-cols-1 sm:grid-cols-2 gap-4"
            )}
          >
            {balances.map((bal, i) => (
              <AccountCard key={bal.account_id} bal={bal} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
