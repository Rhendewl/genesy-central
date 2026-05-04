"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, Loader2,
  FileText, AlertTriangle, Activity, ChevronRight, Zap, Users,
  Terminal, Play, CheckCheck, SkipForward,
} from "lucide-react";
import { useMetaLeadsManager } from "@/hooks/useMetaLeadsManager";
import type { PageItem, FormItem, WebhookStatus, WebhookLogItem, TestResult } from "@/hooks/useMetaLeadsManager";
import type { Lead } from "@/types";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtRelative = (iso: string | null): string => {
  if (!iso) return "—";
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "agora";
  if (mins  < 60) return `há ${mins}min`;
  if (hours < 24) return `há ${hours}h`;
  return `há ${days}d`;
};

// ── Webhook status badge ──────────────────────────────────────────────────────

function WebhookBadge({ status }: { status: WebhookStatus }) {
  const cfg = {
    active:  { label: "Webhook ativo",     dot: "#10b981", text: "text-emerald-400", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.2)"  },
    error:   { label: "Erro no webhook",   dot: "#f87171", text: "text-red-400",     bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.2)"   },
    waiting: { label: "Aguardando evento", dot: "#fbbf24", text: "text-amber-400",   bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.2)"  },
  }[status];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${cfg.text}`}
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: cfg.dot, boxShadow: status === "active" ? `0 0 6px ${cfg.dot}` : undefined }}
      />
      {cfg.label}
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  loading,
  onChange,
}: {
  checked: boolean;
  loading?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={loading}
      className="relative w-10 h-5 rounded-full transition-all shrink-0 disabled:opacity-60"
      style={{
        background: checked ? "linear-gradient(90deg, #4a8fd4, #3a7fc4)" : "rgba(255,255,255,0.12)",
        boxShadow: checked ? "0 0 10px rgba(74,143,212,0.35)" : undefined,
      }}
    >
      {loading ? (
        <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-white" />
      ) : (
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow-sm"
          style={{ left: checked ? "calc(100% - 18px)" : "2px" }}
        />
      )}
    </button>
  );
}

// ── Section A: Pages panel ────────────────────────────────────────────────────

function PagesPanel({
  pages,
  selectedPageId,
  isLoading,
  isSyncing,
  error,
  onSelect,
  onSync,
}: {
  pages:          PageItem[];
  selectedPageId: string | null;
  isLoading:      boolean;
  isSyncing:      boolean;
  error:          string | null;
  onSelect:       (id: string) => void;
  onSync:         () => void;
}) {
  return (
    <div
      className="rounded-3xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(0,0,0,0.10)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div
        className="px-5 py-4 flex items-center justify-between border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div>
          <h3 className="text-white font-semibold text-sm">Páginas</h3>
          <p className="text-[#6b8fa8] text-xs mt-0.5">Páginas Facebook conectadas</p>
        </div>
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
          style={{ background: "rgba(74,143,212,0.1)", border: "1px solid rgba(74,143,212,0.2)", color: "#4a8fd4" }}
        >
          <RefreshCw size={11} className={isSyncing ? "animate-spin" : ""} />
          {isSyncing ? "Sincronizando…" : "Sincronizar"}
        </button>
      </div>

      <div className="flex-1 p-3">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl mb-3 text-xs text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <AlertTriangle size={12} />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-[#4a8fd4]" />
          </div>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: "rgba(74,143,212,0.08)", border: "1px solid rgba(74,143,212,0.15)" }}
            >
              <Users size={20} className="text-[#4a8fd4]" />
            </div>
            <p className="text-[#8ba5bb] text-sm font-medium mb-1">Nenhuma página encontrada</p>
            <p className="text-[#6b8fa8] text-xs mb-4 max-w-[200px]">
              Clique em "Sincronizar" para buscar páginas da sua conta Meta.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {pages.map(page => {
              const isSelected = selectedPageId === page.page_id;
              return (
                <button
                  key={page.id}
                  onClick={() => onSelect(page.page_id)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all"
                  style={{
                    background: isSelected
                      ? "linear-gradient(90deg, rgba(74,143,212,0.15), rgba(74,143,212,0.08))"
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isSelected ? "rgba(74,143,212,0.35)" : "rgba(255,255,255,0.06)"}`,
                    boxShadow: isSelected ? "0 0 16px rgba(74,143,212,0.08)" : undefined,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{
                      background: isSelected ? "linear-gradient(135deg, #1877F2, #0d5fc9)" : "rgba(255,255,255,0.06)",
                      color: isSelected ? "white" : "#6b8fa8",
                    }}
                  >
                    {(page.page_name ?? "P")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? "text-white" : "text-[#c7e5ff]"}`}>
                      {page.page_name ?? page.page_id}
                    </p>
                    <p className="text-[10px] text-[#6b8fa8] truncate font-mono">{page.page_id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: page.is_active ? "#10b981" : "#6b8fa8" }} />
                    <ChevronRight size={13} className={isSelected ? "text-[#4a8fd4]" : "text-[#4a5568]"} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section B: Forms panel ────────────────────────────────────────────────────

function FormsPanel({
  selectedPage,
  forms,
  isLoading,
  error,
  togglingForms,
  onToggle,
}: {
  selectedPage:  PageItem | null;
  forms:         FormItem[];
  isLoading:     boolean;
  error:         string | null;
  togglingForms: Record<string, boolean>;
  onToggle:      (pageId: string, formId: string, formName: string, active: boolean) => void;
}) {
  if (!selectedPage) {
    return (
      <div
        className="rounded-3xl flex flex-col items-center justify-center py-16 text-center"
        style={{
          background: "rgba(0,0,0,0.10)",
          border: "1px dashed rgba(255,255,255,0.10)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "rgba(74,143,212,0.06)", border: "1px solid rgba(74,143,212,0.12)" }}
        >
          <FileText size={22} className="text-[#4a8fd4]" />
        </div>
        <p className="text-[#8ba5bb] text-sm font-medium mb-1">Selecione uma página</p>
        <p className="text-[#6b8fa8] text-xs max-w-[200px]">
          Escolha uma página à esquerda para ver e configurar seus formulários Lead Ads.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-3xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(0,0,0,0.10)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <h3 className="text-white font-semibold text-sm truncate">
          Formulários — {selectedPage.page_name ?? selectedPage.page_id}
        </h3>
        <p className="text-[#6b8fa8] text-xs mt-0.5">
          Ative os formulários cujos leads devem chegar no CRM
        </p>
      </div>

      <div className="flex-1 p-3">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl mb-3 text-xs text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-[#4a8fd4]" />
          </div>
        ) : forms.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-[#8ba5bb] text-sm font-medium mb-1">Nenhum formulário encontrado</p>
            <p className="text-[#6b8fa8] text-xs max-w-[220px]">
              Crie formulários Lead Ads no Gerenciador de Anúncios do Facebook.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {forms.map(form => (
              <motion.div
                key={form.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all"
                style={{
                  background: form.is_subscribed ? "rgba(74,143,212,0.06)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${form.is_subscribed ? "rgba(74,143,212,0.2)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-[#c7e5ff] truncate">{form.name}</p>
                    <span
                      className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                      style={{
                        background: form.status === "ACTIVE" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
                        color: form.status === "ACTIVE" ? "#10b981" : "#6b8fa8",
                        border: `1px solid ${form.status === "ACTIVE" ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)"}`,
                      }}
                    >
                      {form.status === "ACTIVE" ? "ativo" : "arquivado"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#6b8fa8]">
                    <span>{form.leads_count} leads</span>
                    {form.last_lead_at && (
                      <>
                        <span>·</span>
                        <span>último: {fmtRelative(form.last_lead_at)}</span>
                      </>
                    )}
                  </div>
                </div>
                <Toggle
                  checked={form.is_subscribed}
                  loading={togglingForms[form.id]}
                  onChange={v => onToggle(selectedPage.page_id, form.id, form.name, v)}
                />
              </motion.div>
            ))}
          </div>
        )}

        {forms.length > 0 && !forms.some(f => f.is_subscribed) && (
          <div
            className="mt-3 flex items-start gap-2 p-3 rounded-xl text-xs text-[#6b8fa8]"
            style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.12)" }}
          >
            <Zap size={11} className="text-amber-400 shrink-0 mt-0.5" />
            <span>
              Nenhum formulário ativado. Todos os leads desta página serão capturados
              até que você ative ao menos um formulário específico.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section C: Recent leads ───────────────────────────────────────────────────

function RecentLeads({ leads }: { leads: Lead[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-3xl overflow-hidden mb-5"
      style={{
        background: "rgba(0,0,0,0.10)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div
        className="px-5 py-4 flex items-center gap-2 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <Activity size={14} className="text-[#4a8fd4]" />
        <h3 className="text-white font-semibold text-sm">Leads Recentes via Meta</h3>
        {leads.length > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: "rgba(74,143,212,0.12)", color: "#4a8fd4" }}>
            {leads.length}
          </span>
        )}
      </div>

      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-[#6b8fa8] text-sm">
            Nenhum lead recebido ainda. Quando um formulário for preenchido, ele aparece aqui.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {leads.map(lead => (
            <div key={lead.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(24,119,242,0.2), rgba(24,119,242,0.1))",
                  border: "1px solid rgba(24,119,242,0.2)",
                  color: "#4a8fd4",
                }}
              >
                {lead.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{lead.name}</p>
                <p className="text-xs text-[#6b8fa8] truncate">{lead.contact || lead.email || "—"}</p>
              </div>
              {lead.form_name && (
                <div
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs shrink-0"
                  style={{ background: "rgba(74,143,212,0.08)", color: "#8ba5bb" }}
                >
                  <FileText size={10} />
                  <span className="max-w-[140px] truncate">{lead.form_name}</span>
                </div>
              )}
              <p className="text-xs text-[#4a5568] shrink-0">{fmtRelative(lead.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Section D: Webhook logs + test ────────────────────────────────────────────

const LOG_STATUS_CFG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  processed: { label: "Salvo",       icon: <CheckCheck size={11} />, color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
  duplicate: { label: "Duplicado",   icon: <SkipForward size={11} />, color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  skipped:   { label: "Ignorado",    icon: <SkipForward size={11} />, color: "#6b8fa8", bg: "rgba(255,255,255,0.05)"},
  error:     { label: "Erro",        icon: <XCircle size={11} />,    color: "#f87171", bg: "rgba(239,68,68,0.1)"   },
  received:  { label: "Processando", icon: <Loader2 size={11} className="animate-spin" />, color: "#4a8fd4", bg: "rgba(74,143,212,0.08)" },
};

function WebhookLogs({
  logs,
  isTesting,
  testResult,
  onTest,
}: {
  logs:       WebhookLogItem[];
  isTesting:  boolean;
  testResult: TestResult | null;
  onTest:     () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-3xl overflow-hidden"
      style={{
        background: "rgba(0,0,0,0.10)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[#4a8fd4]" />
          <h3 className="text-white font-semibold text-sm">Logs do Webhook</h3>
          {logs.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: "rgba(74,143,212,0.12)", color: "#4a8fd4" }}>
              {logs.length}
            </span>
          )}
        </div>

        {/* Test button */}
        <button
          onClick={onTest}
          disabled={isTesting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
          style={{ background: "rgba(74,143,212,0.1)", border: "1px solid rgba(74,143,212,0.2)", color: "#4a8fd4" }}
        >
          {isTesting ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
          {isTesting ? "Testando…" : "Testar integração"}
        </button>
      </div>

      {/* Test result */}
      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="mx-4 mt-3 p-3 rounded-xl text-xs"
              style={{
                background: testResult.ok ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                border: `1px solid ${testResult.ok ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}
            >
              <div className="flex items-start gap-2">
                {testResult.ok
                  ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                  : <XCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                }
                <div className="flex-1 min-w-0">
                  <p className={`font-medium mb-0.5 ${testResult.ok ? "text-emerald-400" : "text-red-400"}`}>
                    {testResult.ok ? testResult.message : testResult.error}
                  </p>
                  {testResult.hint && <p className="text-[#6b8fa8]">{testResult.hint}</p>}
                  {testResult.note && <p className="text-[#6b8fa8] mt-0.5">{testResult.note}</p>}
                  {testResult.page && (
                    <p className="text-[#4a8fa8] mt-1 font-mono text-[10px]">
                      Página: {testResult.page.name} ({testResult.page.id})
                    </p>
                  )}
                  {testResult.lead && (
                    <p className="text-[#4a8fa8] mt-0.5 font-mono text-[10px]">
                      Lead: {testResult.lead.name} — {testResult.lead.phone ?? testResult.lead.email ?? "—"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logs list */}
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Clock size={18} className="text-[#4a5568] mb-2" />
          <p className="text-[#6b8fa8] text-sm">
            Nenhum evento recebido ainda.
          </p>
          <p className="text-[#4a5568] text-xs mt-1 max-w-[260px]">
            Quando a Meta enviar um leadgen, aparece aqui com status detalhado.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {logs.map(log => {
            const cfg = LOG_STATUS_CFG[log.status] ?? LOG_STATUS_CFG.received;
            return (
              <div key={log.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-3">
                  {/* Status badge */}
                  <div
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 mt-0.5"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    {log.error_message ? (
                      <p className="text-xs text-red-400 leading-relaxed">{log.error_message}</p>
                    ) : (
                      <p className="text-xs text-[#8ba5bb]">
                        {log.status === "processed" && "Lead salvo no CRM — coluna Abordados"}
                        {log.status === "duplicate" && "Leadgen já processado anteriormente"}
                        {log.status === "skipped"  && (log.step ?? "Formulário não está ativo")}
                        {log.status === "received" && `Etapa: ${log.step ?? "processando…"}`}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-[#4a5568] font-mono">
                      {log.leadgen_id && <span>leadgen: {log.leadgen_id.slice(-8)}</span>}
                      {log.form_id    && <span>form: {log.form_id.slice(-8)}</span>}
                    </div>
                  </div>

                  {/* Time */}
                  <p className="text-[10px] text-[#4a5568] shrink-0 mt-0.5">
                    {fmtRelative(log.received_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MetaLeadsManager() {
  const router = useRouter();

  const {
    pages, hasMetaAccount, selectedPageId, selectedPage,
    forms, recentLeads, webhookLogs, webhookStatus,
    isLoadingPages, isLoadingForms,
    isSyncing, isTesting, testResult,
    togglingForms, error, formsError,
    handleSelectPage, syncPages, toggleForm, testWebhook, refetch,
  } = useMetaLeadsManager();

  return (
    <div className="px-4 sm:px-6 pb-12">

      {/* Header */}
      <div
        className="flex items-center justify-between py-6 mb-8 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg, #1877F2, #0d5fc9)" }}
            >
              f
            </span>
            Meta Leads
          </h1>
          <p className="text-[#6b8fa8] text-sm mt-1">
            Gerencie páginas e formulários para captação automática de leads no CRM
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          <WebhookBadge status={webhookStatus} />
          <button
            onClick={refetch}
            disabled={isLoadingPages}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#6b8fa8] hover:text-white transition-all"
            style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <RefreshCw size={14} className={isLoadingPages ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => router.push("/crm/integracoes")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.1)", color: "#8ba5bb" }}
          >
            <ArrowLeft size={14} />
            Voltar
          </button>
        </div>
      </div>

      {/* How it works strip */}
      <div
        className="flex items-center gap-0 mb-8 rounded-2xl overflow-hidden text-xs"
        style={{
          background: "rgba(0,0,0,0.10)",
          border: "1px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {[
          { icon: <CheckCircle2 size={12} className="text-emerald-400" />, label: "1. Conta Meta conectada" },
          { icon: <ChevronRight size={12} className="text-[#4a5568]" />, label: null },
          { icon: <Users size={12} className="text-[#4a8fd4]" />, label: "2. Sincronize as páginas" },
          { icon: <ChevronRight size={12} className="text-[#4a5568]" />, label: null },
          { icon: <FileText size={12} className="text-[#4a8fd4]" />, label: "3. Ative os formulários" },
          { icon: <ChevronRight size={12} className="text-[#4a5568]" />, label: null },
          { icon: <Zap size={12} className="text-emerald-400" />, label: "4. Leads entram no CRM" },
        ].map((step, i) =>
          step.label ? (
            <div key={i} className="flex items-center gap-1.5 px-4 py-3 text-[#8ba5bb]">
              {step.icon}
              <span>{step.label}</span>
            </div>
          ) : (
            <span key={i} className="text-[#2a3a4a]">{step.icon}</span>
          )
        )}
      </div>

      {/* Global error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 p-4 rounded-2xl mb-6 text-red-400 text-sm"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <AlertTriangle size={14} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sections A + B */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <PagesPanel
          pages={pages}
          selectedPageId={selectedPageId}
          isLoading={isLoadingPages}
          isSyncing={isSyncing}
          error={null}
          onSelect={handleSelectPage}
          onSync={syncPages}
        />
        <FormsPanel
          selectedPage={selectedPage}
          forms={forms}
          isLoading={isLoadingForms}
          error={formsError}
          togglingForms={togglingForms}
          onToggle={toggleForm}
        />
      </div>

      {/* Section C: Recent leads */}
      <RecentLeads leads={recentLeads} />

      {/* Section D: Webhook logs + test button */}
      <WebhookLogs
        logs={webhookLogs}
        isTesting={isTesting}
        testResult={testResult}
        onTest={testWebhook}
      />

      {/* No Meta account warning */}
      {!isLoadingPages && hasMetaAccount === false && pages.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 flex items-start gap-3 p-4 rounded-2xl text-sm"
          style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}
        >
          <Clock size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-medium mb-1">Conta Meta não conectada</p>
            <p className="text-[#8ba5bb] text-xs">
              Primeiro conecte sua conta Meta em{" "}
              <a href="/trafego?tab=integracoes" className="text-[#4a8fd4] underline">
                Tráfego → Integrações
              </a>
              {" "}e depois retorne aqui para sincronizar as páginas.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
