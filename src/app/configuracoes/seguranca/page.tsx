"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Shield, Lock, Eye, EyeOff, Monitor, Smartphone,
  Globe, LogOut, Bell, Key, ShieldCheck, ShieldAlert, Clock,
  AlertTriangle, CheckCircle2, Activity, RefreshCw, Fingerprint,
  X, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useSecurity } from "@/hooks/useSecurity";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)         score++;
  if (pw.length >= 12)        score++;
  if (/[A-Z]/.test(pw))      score++;
  if (/[a-z]/.test(pw))      score++;
  if (/[0-9]/.test(pw))      score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Muito fraca",  color: "#f87171" };
  if (score === 2) return { score, label: "Fraca",        color: "#fb923c" };
  if (score === 3) return { score, label: "Moderada",     color: "#facc15" };
  if (score === 4) return { score, label: "Forte",        color: "#34d399" };
  return               { score, label: "Muito forte",  color: "#a78bfa" };
}

function formatLogMetadata(action: string, metadata: Record<string, unknown>): string {
  if (action === "settings_changed" && Array.isArray(metadata.changed)) {
    const map: Record<string, string> = {
      notify_new_login:        "Notificar novo login",
      notify_suspicious:       "Notificar tentativa suspeita",
      require_strong_password: "Exigir senha forte",
      auto_logout:             "Logout automático",
    };
    return (metadata.changed as string[]).map(k => map[k] ?? k).join(", ");
  }
  if (action === "sessions_terminated") return "Escopo: outras sessões";
  if (action === "password_changed")    return "Senha atualizada com sucesso";
  return "";
}

const LOG_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  password_changed:    { label: "Senha alterada",          icon: Key,           color: "#a78bfa" },
  sessions_terminated: { label: "Sessões encerradas",      icon: LogOut,        color: "#f87171" },
  login:               { label: "Login realizado",          icon: CheckCircle2,  color: "#34d399" },
  logout:              { label: "Logout",                   icon: LogOut,        color: "rgba(255,255,255,0.4)" },
  failed_login:        { label: "Tentativa de acesso",     icon: AlertTriangle, color: "#fb923c" },
  "2fa_enabled":       { label: "2FA ativado",             icon: ShieldCheck,   color: "#34d399" },
  "2fa_disabled":      { label: "2FA desativado",          icon: ShieldAlert,   color: "#f87171" },
  settings_changed:    { label: "Preferências alteradas",  icon: Activity,      color: "#27a3ff" },
};

function getLogMeta(action: string) {
  return LOG_META[action] ?? { label: action, icon: Activity, color: "rgba(255,255,255,0.4)" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const sectionStyle = {
  background: "rgba(255,255,255,0.02)",
  border:     "1px solid rgba(255,255,255,0.06)",
};

const inputBase = {
  background: "rgba(255,255,255,0.09)",
  border:     "1px solid rgba(255,255,255,0.08)",
  color:      "#ffffff",
};

const focusStyle  = { borderColor: "rgba(167,139,250,0.45)", background: "rgba(255,255,255,0.07)" };
const blurStyle   = { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.09)" };

// ─────────────────────────────────────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, accent, delay,
}: {
  icon: React.ElementType; label: string; value: string; accent: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className="flex items-center gap-3.5 rounded-2xl p-4"
      style={sectionStyle}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}18` }}>
        <Icon size={17} style={{ color: accent }} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold leading-none" style={{ color: "#ffffff" }}>{value}</p>
        <p className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>{label}</p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon, title, accent, action,
}: {
  icon: React.ElementType; title: string; accent: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-center gap-2.5">
        <Icon size={15} style={{ color: accent }} strokeWidth={1.75} />
        <span className="text-[13px] font-semibold" style={{ color: "#ffffff" }}>{title}</span>
      </div>
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PasswordInput
// ─────────────────────────────────────────────────────────────────────────────

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  showStrength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  showStrength?: boolean;
}) {
  const [show, setShow] = useState(false);
  const strength = useMemo(() => passwordStrength(value), [value]);

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.38)" }}>
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-xl pl-3.5 pr-10 text-[14px] outline-none transition-all"
          style={inputBase}
          onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
          onBlur={e  => Object.assign(e.currentTarget.style, blurStyle)}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {showStrength && value.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map(b => (
              <div
                key={b}
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{ background: b <= strength.score ? strength.color : "rgba(255,255,255,0.08)" }}
              />
            ))}
          </div>
          <p className="text-[11px]" style={{ color: strength.color }}>{strength.label}</p>
        </motion.div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle
// ─────────────────────────────────────────────────────────────────────────────

function Toggle({
  label, description, checked, onChange, disabled = false,
}: {
  label: string; description: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div>
        <p className="text-[13px] font-medium" style={{ color: disabled ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)" }}>{label}</p>
        <p className="mt-0.5 text-[11px]" style={{ color: "rgba(255,255,255,0.32)" }}>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative h-5 w-9 shrink-0 rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: checked ? "#a78bfa" : "rgba(255,255,255,0.12)" }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ left: checked ? "calc(100% - 18px)" : "2px" }}
        />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SessionRow
// ─────────────────────────────────────────────────────────────────────────────

function SessionRow({
  session, onRevoke,
}: {
  session: { id: string; device: string; browser: string; location: string; last_seen: string; is_current: boolean };
  onRevoke?: () => void;
}) {
  const DeviceIcon = session.device === "Mobile" ? Smartphone : Monitor;

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 transition-colors"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.09)" }}>
        <DeviceIcon size={16} style={{ color: "rgba(255,255,255,0.5)" }} strokeWidth={1.5} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium" style={{ color: "#ffffff" }}>
            {session.device} · {session.browser}
          </p>
          {session.is_current && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
              Esta sessão
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          <span className="flex items-center gap-1"><Globe size={10} />{session.location}</span>
          <span className="flex items-center gap-1"><Clock size={10} />{fmtDate(session.last_seen)}</span>
        </div>
      </div>

      {!session.is_current && onRevoke && (
        <button
          onClick={onRevoke}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] transition-all"
          style={{ color: "#f87171", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.12)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(248,113,113,0.06)"; }}
        >
          <X size={11} />
          Encerrar
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4">
          <div className="h-9 w-9 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-40 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="h-2.5 w-56 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function SegurancaPage() {
  const {
    settings, logs, currentSession, lastLogin, isLoading, loadError,
    updatePassword, updateSettings, signOutOtherSessions,
  } = useSecurity();

  // password
  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPw,   setSavingPw]   = useState(false);

  // prefs
  const [savingPrefs, setSavingPrefs] = useState(false);

  // sessions
  const [signingOut,  setSigningOut]  = useState(false);

  const pwStrength = useMemo(() => passwordStrength(newPw), [newPw]);
  const pwMatch    = newPw.length > 0 && newPw === confirmPw;
  const pwMismatch = confirmPw.length > 0 && newPw !== confirmPw;

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwMismatch || !pwMatch) { toast.error("As senhas não coincidem"); return; }
    if (pwStrength.score < 3)   { toast.error("Senha muito fraca", { description: "Use letras maiúsculas, números e símbolos." }); return; }

    setSavingPw(true);
    const { error } = await updatePassword(currentPw, newPw);
    setSavingPw(false);

    if (error) {
      toast.error("Erro ao atualizar senha", { description: error });
      return;
    }
    toast.success("Senha atualizada com sucesso");
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
  }

  const handleToggle = useCallback(async (
    key: "notify_new_login" | "notify_suspicious" | "require_strong_password" | "auto_logout",
    value: boolean,
  ) => {
    setSavingPrefs(true);
    const { error } = await updateSettings({ [key]: value });
    setSavingPrefs(false);
    if (error) toast.error("Erro ao salvar preferência", { description: error });
    else       toast.success("Preferência salva");
  }, [updateSettings]);

  async function handleSignOutAll() {
    setSigningOut(true);
    const { error } = await signOutOtherSessions();
    setSigningOut(false);
    if (error) toast.error("Erro ao encerrar sessões", { description: error });
    else       toast.success("Todas as outras sessões foram encerradas");
  }

  const STATS = [
    { icon: Monitor,     label: "Sessões ativas",     value: "1 sessão",                                     accent: "#27a3ff" },
    { icon: Clock,       label: "Último login",        value: lastLogin ? fmtDateShort(lastLogin) : "—",      accent: "#34d399" },
    { icon: Fingerprint, label: "Autenticação 2FA",    value: "Não ativado",                                  accent: "#facc15" },
    { icon: ShieldAlert, label: "Alertas",             value: "Nenhum",                                       accent: "#a78bfa" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-32 sm:px-6">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-0.5 pt-5"
      >
        <Link
          href="/configuracoes"
          className="inline-flex items-center gap-1.5 text-[12px] transition-colors"
          style={{ color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
        >
          <ArrowLeft size={13} />
          Configurações
        </Link>
        <h1 className="text-xl font-bold sm:text-2xl" style={{ color: "#ffffff", letterSpacing: "-0.02em" }}>
          Segurança
        </h1>
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.38)" }}>
          Proteção de acesso, sessões e controles da plataforma
        </p>
      </motion.div>

      {/* ── Erro de carregamento ── */}
      <AnimatePresence>
        {loadError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}
          >
            <AlertCircle size={14} style={{ color: "#f87171" }} />
            <p className="text-[13px]" style={{ color: "#f87171" }}>{loadError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <StatCard key={s.label} {...s} delay={0.05 + i * 0.06} />
        ))}
      </div>

      {/* ── Alterar Senha ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="rounded-2xl"
        style={sectionStyle}
      >
        <SectionHeader icon={Lock} title="Alterar Senha" accent="#a78bfa" />

        <form onSubmit={handlePasswordSubmit} className="space-y-4 p-5">
          <PasswordInput
            label="Senha atual"
            value={currentPw}
            onChange={setCurrentPw}
            placeholder="••••••••"
          />

          <PasswordInput
            label="Nova senha"
            value={newPw}
            onChange={setNewPw}
            placeholder="Mínimo 8 caracteres"
            showStrength
          />

          {/* Confirmar senha — campo simples sem double-label */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.38)" }}>
              Confirmar nova senha
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repita a nova senha"
                className="h-10 w-full rounded-xl pl-3.5 pr-10 text-[14px] outline-none transition-all"
                style={{
                  ...inputBase,
                  borderColor: pwMismatch ? "rgba(248,113,113,0.5)" : pwMatch ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.08)",
                }}
                onFocus={e => { if (!pwMismatch && !pwMatch) Object.assign(e.currentTarget.style, focusStyle); }}
                onBlur={e  => { if (!pwMismatch && !pwMatch) Object.assign(e.currentTarget.style, blurStyle); }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "rgba(255,255,255,0.3)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
              >
                {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <AnimatePresence>
              {confirmPw.length > 0 && (
                <motion.p
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[11px]"
                  style={{ color: pwMatch ? "#34d399" : "#f87171" }}
                >
                  {pwMatch ? "✓ Senhas coincidem" : "✗ Senhas não coincidem"}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="flex justify-end pt-1">
            <PrimaryButton
              type="submit"
              disabled={savingPw || !currentPw || !newPw || !confirmPw || pwMismatch}
              className="h-9 px-6 text-[13px]"
            >
              {savingPw ? "Atualizando…" : "Atualizar Senha"}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>

      {/* ── Sessões Ativas ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="rounded-2xl"
        style={sectionStyle}
      >
        <SectionHeader
          icon={Monitor}
          title="Sessões Ativas"
          accent="#27a3ff"
          action={
            <button
              onClick={handleSignOutAll}
              disabled={signingOut}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] transition-all disabled:opacity-50"
              style={{ color: "#f87171", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(248,113,113,0.06)"; }}
            >
              <LogOut size={11} />
              {signingOut ? "Encerrando…" : "Encerrar outras"}
            </button>
          }
        />

        {isLoading ? (
          <Skeleton rows={1} />
        ) : currentSession ? (
          <SessionRow session={currentSession} />
        ) : (
          <p className="px-5 py-4 text-[13px]" style={{ color: "rgba(255,255,255,0.3)" }}>
            Nenhuma sessão ativa encontrada.
          </p>
        )}

        <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.22)" }}>
            Ao encerrar outras sessões, todos os dispositivos (exceto este) serão desconectados imediatamente.
          </p>
        </div>
      </motion.div>

      {/* ── 2FA ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
        className="rounded-2xl"
        style={sectionStyle}
      >
        <SectionHeader icon={ShieldCheck} title="Autenticação em Dois Fatores" accent="#34d399" />

        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium" style={{ color: "#ffffff" }}>Status:</span>
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>
                Não ativado
              </span>
            </div>
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.38)" }}>
              Adicione uma camada extra com autenticador TOTP (Google Authenticator, Authy).
            </p>
          </div>

          <button
            disabled
            className="h-9 rounded-xl px-5 text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}
            title="Em breve"
          >
            Ativar 2FA
          </button>
        </div>

        <div className="mx-5 mb-5 rounded-xl p-3.5" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.12)" }}>
          <p className="text-[11px]" style={{ color: "rgba(167,139,250,0.8)" }}>
            Suporte a 2FA via TOTP estará disponível em breve. A estrutura está preparada para integração com Supabase Auth MFA.
          </p>
        </div>
      </motion.div>

      {/* ── Preferências de Segurança ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
        className="rounded-2xl"
        style={sectionStyle}
      >
        <SectionHeader
          icon={Bell}
          title="Preferências de Segurança"
          accent="#facc15"
          action={
            savingPrefs
              ? <RefreshCw size={13} className="animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
              : undefined
          }
        />

        <div className="px-5 pb-1">
          {isLoading || !settings ? (
            <Skeleton rows={4} />
          ) : (
            <>
              <Toggle
                label="Notificar novo login"
                description="Alerta quando um novo acesso for detectado"
                checked={settings.notify_new_login}
                onChange={v => handleToggle("notify_new_login", v)}
                disabled={savingPrefs}
              />
              <Toggle
                label="Notificar tentativa suspeita"
                description="Alerta em caso de tentativas de acesso com falha"
                checked={settings.notify_suspicious}
                onChange={v => handleToggle("notify_suspicious", v)}
                disabled={savingPrefs}
              />
              <Toggle
                label="Exigir senha forte"
                description="Bloqueia senhas com menos de 3 critérios de segurança"
                checked={settings.require_strong_password}
                onChange={v => handleToggle("require_strong_password", v)}
                disabled={savingPrefs}
              />
              <div style={{ borderBottom: "none" }}>
                <Toggle
                  label="Logout automático por inatividade"
                  description="Encerrar sessão após 30 minutos sem uso"
                  checked={settings.auto_logout}
                  onChange={v => handleToggle("auto_logout", v)}
                  disabled={savingPrefs}
                />
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* ── Logs de Segurança ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.35 }}
        className="rounded-2xl"
        style={sectionStyle}
      >
        <SectionHeader icon={Activity} title="Logs de Segurança" accent="#27a3ff" />

        {isLoading ? (
          <Skeleton rows={4} />
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <Shield size={28} style={{ color: "rgba(255,255,255,0.1)" }} />
            <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              Nenhum evento registrado ainda
            </p>
          </div>
        ) : (
          <div>
            {logs.map((log, i) => {
              const meta    = getLogMeta(log.action);
              const LogIcon = meta.icon;
              const detail  = formatLogMetadata(log.action, log.metadata ?? {});

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors"
                  style={{ borderBottom: i < logs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${meta.color}14` }}
                  >
                    <LogIcon size={13} style={{ color: meta.color }} strokeWidth={1.75} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
                      {meta.label}
                    </p>
                    {detail && (
                      <p className="truncate text-[11px]" style={{ color: "rgba(255,255,255,0.32)" }}>
                        {detail}
                      </p>
                    )}
                  </div>

                  <span className="shrink-0 text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                    {fmtDate(log.created_at)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

    </div>
  );
}
