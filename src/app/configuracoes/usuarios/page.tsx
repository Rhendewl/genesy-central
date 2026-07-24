"use client";

import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Search, Users, UserCheck, Mail, ShieldCheck,
  MoreHorizontal, Pencil, Power, KeyRound, Trash2, X,
  ChevronDown, UserX, Check, Camera, Upload, Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  useUsers,
  UserProfile,
  UserRole,
  ROLE_LABELS,
  ROLE_COLORS,
  ROLE_DEFAULT_PERMISSIONS,
  ALL_MODULES,
  CreateUserPayload,
  UpdateUserPayload,
} from "@/hooks/useUsers";
import { useModalOpen } from "@/hooks/useModalOpen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { AdministrativeAccessGate } from "@/components/layout/AdministrativeAccessGate";
import { usePipelines } from "@/hooks/usePipelines";
import type { CrmPipelineWithStages } from "@/types/crm";
import { isAdministrativeMember } from "@/lib/user-access";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROLES: UserRole[] = ["admin", "comercial", "gestor_comercial", "trafego", "designer", "financeiro", "operacional", "viewer"];

const STATUS_OPTIONS = [
  { value: "",        label: "Todos os status" },
  { value: "true",    label: "Ativo" },
  { value: "false",   label: "Inativo" },
  { value: "pending", label: "Aguardando convite" },
];

const JOB_PROFILE_OPTIONS = [
  { value: "Sócio",             role: "admin" as UserRole },
  { value: "Gestor de Tráfego", role: "trafego" as UserRole },
  { value: "SDR",               role: "comercial" as UserRole },
  { value: "Closer",            role: "gestor_comercial" as UserRole },
  { value: "BDR",               role: "comercial" as UserRole },
  { value: "Designer",          role: "designer" as UserRole },
];

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  if (url) {
    return <img src={url} alt={name} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-black font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${hue}, 60%, 72%)` }}
    >
      {initials}
    </div>
  );
}

function AdminAvatarEditor({
  profile,
  onUpload,
  onRemove,
}: {
  profile: UserProfile;
  onUpload: (file: File) => Promise<{ error: string | null }>;
  onRemove: () => Promise<{ error: string | null }>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(profile.avatar_url);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Use uma imagem PNG, JPG ou WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB");
      return;
    }

    const previous = preview;
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
    setBusy(true);
    const result = await onUpload(file);
    setBusy(false);
    if (result.error) {
      setPreview(previous);
      toast.error("Erro ao atualizar foto", { description: result.error });
      return;
    }
    toast.success("Foto do usuário atualizada");
  }

  async function handleRemove() {
    setBusy(true);
    const result = await onRemove();
    setBusy(false);
    if (result.error) {
      toast.error("Erro ao remover foto", { description: result.error });
      return;
    }
    setPreview(null);
    toast.success("Foto do usuário removida");
  }

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "color-mix(in srgb, var(--text-title) 40%, transparent)" }}>
        Foto de perfil
      </label>
      <div className="flex items-center gap-4 rounded-xl p-3" style={{ background: "var(--hover)", border: "1px solid var(--border)" }}>
        <div className="relative">
          <Avatar name={profile.full_name} url={preview} size={56} />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
            <Camera size={11} />
          </span>
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
              <Loader2 size={18} className="animate-spin text-white" />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>PNG, JPG ou WebP · máximo 5 MB</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <Upload size={12} />
              {preview ? "Trocar foto" : "Adicionar foto"}
            </button>
            {preview && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRemove()}
                className="rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
                style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}
              >
                Remover
              </button>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RoleBadge / StatusDot
// ─────────────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{ background: `${ROLE_COLORS[role]}18`, color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}30` }}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: active ? "#34d399" : "var(--icon)" }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? "#34d399" : "var(--icon)" }} />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatsCard
// ─────────────────────────────────────────────────────────────────────────────

function StatsCard({ icon: Icon, label, value, accent, delay }: {
  icon: React.ElementType; label: string; value: number; accent: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className="flex items-center gap-4 rounded-2xl p-4"
      style={{ background: "var(--hover)", border: "1px solid var(--border)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}18` }}>
        <Icon size={18} style={{ color: accent }} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-[22px] font-bold leading-none" style={{ color: "var(--text-title)" }}>{value}</p>
        <p className="mt-1 text-[11px]" style={{ color: "color-mix(in srgb, var(--text-title) 40%, transparent)" }}>{label}</p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RowActions
// ─────────────────────────────────────────────────────────────────────────────

function RowActions({ profile, onEdit, onToggle, onReset, onDelete }: {
  profile: UserProfile; onEdit: () => void; onToggle: () => void; onReset: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleToggleOpen() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setOpenUp(window.innerHeight - rect.bottom < 180);
    }
    setOpen(v => !v);
  }

  const actions = [
    { icon: Pencil,   label: "Editar / Permissões", action: onEdit,   color: "color-mix(in srgb, var(--text-title) 80%, transparent)" },
    { icon: Power,    label: profile.is_active ? "Desativar" : "Ativar", action: onToggle, color: profile.is_active ? "#f87171" : "#34d399" },
    { icon: KeyRound, label: "Resetar senha",        action: onReset,  color: "color-mix(in srgb, var(--text-title) 80%, transparent)" },
    { icon: Trash2,   label: "Remover",              action: onDelete, color: "#f87171" },
  ];
  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleToggleOpen}
        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
        style={{ color: "color-mix(in srgb, var(--text-title) 35%, transparent)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--text-title)")}
        onMouseLeave={e => (e.currentTarget.style.color = "color-mix(in srgb, var(--text-title) 35%, transparent)")}
      >
        <MoreHorizontal size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: openUp ? 4 : -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: openUp ? 4 : -4 }}
              transition={{ duration: 0.15 }}
              className={`lc-modal-panel absolute right-0 z-20 min-w-[180px] overflow-hidden rounded-xl py-1.5 shadow-2xl ${openUp ? "bottom-8" : "top-8"}`}
            >
              {actions.map(({ icon: ActionIcon, label, action, color }) => (
                <button
                  key={label}
                  onClick={() => { action(); setOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors"
                  style={{ color }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <ActionIcon size={13} />
                  {label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilterSelect
// ─────────────────────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative flex items-center">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-9 appearance-none rounded-xl pl-3.5 pr-8 text-[13px] outline-none transition-all cursor-pointer"
        style={{ background: "var(--hover)", border: "1px solid var(--border)", color: "color-mix(in srgb, var(--text-title) 70%, transparent)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
      >
        {children}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2.5" style={{ color: "color-mix(in srgb, var(--text-title) 35%, transparent)" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle
// ─────────────────────────────────────────────────────────────────────────────

function Toggle({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[13px] font-medium" style={{ color: "color-mix(in srgb, var(--text-title) 80%, transparent)" }}>{label}</p>
        <p className="text-[11px]" style={{ color: "color-mix(in srgb, var(--text-title) 30%, transparent)" }}>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-5 w-9 shrink-0 rounded-full transition-all duration-200"
        style={{ background: checked ? "#27a3ff" : "var(--border)" }}
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
// PermissionsGrid — checkboxes de módulos
// ─────────────────────────────────────────────────────────────────────────────

function PermissionsGrid({
  permissions,
  onChange,
}: {
  permissions: string[];
  onChange: (perms: string[]) => void;
}) {
  function toggle(key: string) {
    onChange(
      permissions.includes(key)
        ? permissions.filter((k) => k !== key)
        : [...permissions, key]
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {ALL_MODULES.map(({ key, label }) => {
        const active = permissions.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium transition-all"
            style={{
              background: active ? "rgba(39,163,255,0.1)" : "var(--hover)",
              border: active ? "1px solid rgba(39,163,255,0.3)" : "1px solid var(--glass-border)",
              color: active ? "#27a3ff" : "var(--icon)",
            }}
          >
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
              style={{
                background: active ? "#27a3ff" : "var(--hover)",
                border: active ? "none" : "1px solid var(--glass-border)",
              }}
            >
              {active && <Check size={10} color="#000" strokeWidth={3} />}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UserModal (create + edit)
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_CREATE: CreateUserPayload = {
  full_name:   "",
  email:       "",
  role:        "viewer",
  job_title:   "",
  is_active:   true,
  send_invite: false,
  permissions: ROLE_DEFAULT_PERMISSIONS["viewer"],
  crm_pipeline_id: null,
};

function UserModal({
  mode,
  initial,
  onClose,
  onSubmit,
  isLoading,
  pipelines,
  profile,
  onAvatarUpload,
  onAvatarRemove,
}: {
  mode: "create" | "edit";
  initial: CreateUserPayload | UpdateUserPayload;
  onClose: () => void;
  onSubmit: (data: CreateUserPayload | UpdateUserPayload) => Promise<void>;
  isLoading: boolean;
  pipelines: CrmPipelineWithStages[];
  profile?: UserProfile;
  onAvatarUpload?: (file: File) => Promise<{ error: string | null }>;
  onAvatarRemove?: () => Promise<{ error: string | null }>;
}) {
  useModalOpen(true);

  type FormState = {
    full_name: string;
    email: string;
    role: UserRole;
    job_title: string;
    is_active: boolean;
    send_invite: boolean;
    permissions: string[];
    crm_pipeline_id: string | null;
  };

  const [form, setForm] = useState<FormState>({
    full_name:   (initial as CreateUserPayload).full_name ?? "",
    email:       (initial as CreateUserPayload).email ?? "",
    role:        initial.role as UserRole,
    job_title:   initial.job_title ?? "",
    is_active:   initial.is_active,
    send_invite: (initial as CreateUserPayload).send_invite ?? false,
    permissions: initial.permissions ?? ROLE_DEFAULT_PERMISSIONS[initial.role as UserRole],
    crm_pipeline_id: initial.crm_pipeline_id ?? null,
  });

  const isCreate = mode === "create";
  const inputStyle = {
    background: "var(--hover)",
    border: "1px solid var(--border)",
    color: "var(--text-title)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  };

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // Ao mudar de perfil, sugere permissões padrão mas não sobrescreve customizações
  function handleRoleChange(role: UserRole) {
    setForm(prev => ({
      ...prev,
      role,
      permissions: ROLE_DEFAULT_PERMISSIONS[role],
      ...(role === "admin" ? { crm_pipeline_id: null } : {}),
    }));
  }

  function handleJobProfileChange(jobTitle: string) {
    const preset = JOB_PROFILE_OPTIONS.find((option) => option.value === jobTitle);
    setForm(prev => ({
      ...prev,
      job_title: jobTitle,
      ...(preset ? {
        role: preset.role,
        permissions: ROLE_DEFAULT_PERMISSIONS[preset.role],
        ...(preset.role === "admin" ? { crm_pipeline_id: null } : {}),
      } : undefined),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdministrativeMember(form) && !form.crm_pipeline_id) return;
    await onSubmit(form as unknown as CreateUserPayload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="lc-modal-backdrop absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ backdropFilter: "blur(6px)", background: "rgba(0,0,0,0.4)" }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="lc-modal-panel relative w-full max-w-lg rounded-2xl"
        style={{
          background: "var(--bg-modal)",
          border: "1px solid var(--border-modal)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          boxShadow: "0 24px 64px var(--shadow-modal)",
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-[17px] font-bold" style={{ color: "var(--text-title)" }}>
                {isCreate ? "Novo Usuário" : "Editar Usuário"}
              </h2>
              <p className="mt-0.5 text-[12px]" style={{ color: "color-mix(in srgb, var(--text-title) 40%, transparent)" }}>
                {isCreate ? "Adicione um membro à equipe" : "Atualize dados e permissões"}
              </p>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
              style={{ color: "color-mix(in srgb, var(--text-title) 40%, transparent)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text-title)")}
              onMouseLeave={e => (e.currentTarget.style.color = "color-mix(in srgb, var(--text-title) 40%, transparent)")}
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isCreate && profile && onAvatarUpload && onAvatarRemove && (
              <AdminAvatarEditor profile={profile} onUpload={onAvatarUpload} onRemove={onAvatarRemove} />
            )}

            {/* Nome */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "color-mix(in srgb, var(--text-title) 40%, transparent)" }}>
                Nome Completo *
              </label>
              <input
                required
                value={form.full_name}
                onChange={e => setField("full_name", e.target.value)}
                placeholder="Ex.: Ana Lima"
                className="h-10 w-full rounded-xl px-3.5 text-[14px] outline-none transition-all"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--accent-blue)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--glass-border)")}
              />
            </div>

            {/* Email (create only) */}
            {isCreate && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "color-mix(in srgb, var(--text-title) 40%, transparent)" }}>
                  E-mail *
                </label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setField("email", e.target.value)}
                  placeholder="email@empresa.com.br"
                  className="h-10 w-full rounded-xl px-3.5 text-[14px] outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--accent-blue)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--glass-border)")}
                />
              </div>
            )}

            {/* Cargo + Perfil */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "color-mix(in srgb, var(--text-title) 40%, transparent)" }}>
                  Cargo
                </label>
                <div className="relative">
                  <select
                    value={form.job_title}
                    onChange={e => handleJobProfileChange(e.target.value)}
                    className="h-10 w-full appearance-none rounded-xl pl-3.5 pr-8 text-[14px] outline-none transition-all cursor-pointer"
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--accent-blue)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "var(--glass-border)")}
                  >
                    <option value="" style={{ background: "#111" }}>Selecionar cargo...</option>
                    {JOB_PROFILE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} style={{ background: "#111" }}>
                        {option.value}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "color-mix(in srgb, var(--text-title) 35%, transparent)" }} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "color-mix(in srgb, var(--text-title) 40%, transparent)" }}>
                  Perfil *
                </label>
                <div className="relative">
                  <select
                    required
                    value={form.role}
                    onChange={e => handleRoleChange(e.target.value as UserRole)}
                    className="h-10 w-full appearance-none rounded-xl pl-3.5 pr-8 text-[14px] outline-none transition-all cursor-pointer"
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--accent-blue)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "var(--glass-border)")}
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r} style={{ background: "#111" }}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "color-mix(in srgb, var(--text-title) 35%, transparent)" }} />
                </div>
              </div>
            </div>

            {!isAdministrativeMember(form) && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "color-mix(in srgb, var(--text-title) 40%, transparent)" }}>
                  Pipeline do CRM *
                </label>
                <div className="relative">
                  <select
                    required
                    value={form.crm_pipeline_id ?? ""}
                    onChange={e => setField("crm_pipeline_id", e.target.value || null)}
                    className="h-10 w-full appearance-none rounded-xl pl-3.5 pr-8 text-[14px] outline-none transition-all cursor-pointer"
                    style={inputStyle}
                  >
                    <option value="" style={{ background: "#111" }}>Selecionar pipeline...</option>
                    {pipelines.filter(p => p.is_active).map(pipeline => (
                      <option key={pipeline.id} value={pipeline.id} style={{ background: "#111" }}>
                        {pipeline.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "color-mix(in srgb, var(--text-title) 35%, transparent)" }} />
                </div>
                <p className="text-[11px]" style={{ color: "color-mix(in srgb, var(--text-title) 30%, transparent)" }}>
                  O colaborador verá somente esta pipeline no CRM.
                </p>
              </div>
            )}

            {/* Módulos disponíveis */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "color-mix(in srgb, var(--text-title) 40%, transparent)" }}>
                  Módulos disponíveis
                </label>
                <span className="text-[11px]" style={{ color: "color-mix(in srgb, var(--text-title) 25%, transparent)" }}>
                  {form.permissions.length} de {ALL_MODULES.length} ativos
                </span>
              </div>
              <PermissionsGrid
                permissions={form.permissions}
                onChange={(perms) => setField("permissions", perms)}
              />
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-3 rounded-xl p-4" style={{ background: "var(--hover)", border: "1px solid var(--border)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
              <Toggle
                label="Usuário ativo"
                description="Permite acesso imediato à plataforma"
                checked={form.is_active}
                onChange={v => setField("is_active", v)}
              />
              {isCreate && (
                <Toggle
                  label="Enviar convite por e-mail"
                  description="Envia link para o usuário criar sua senha"
                  checked={form.send_invite}
                  onChange={v => setField("send_invite", v)}
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-xl px-5 text-[13px] transition-colors"
                style={{ color: "color-mix(in srgb, var(--text-title) 50%, transparent)", background: "var(--hover)", border: "1px solid var(--border)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-title)")}
                onMouseLeave={e => (e.currentTarget.style.color = "color-mix(in srgb, var(--text-title) 50%, transparent)")}
              >
                Cancelar
              </button>
              <PrimaryButton type="submit" disabled={isLoading} className="h-9 px-6 text-[13px]">
                {isLoading ? "Salvando…" : isCreate ? "Criar Usuário" : "Salvar Alterações"}
              </PrimaryButton>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DeleteConfirm
// ─────────────────────────────────────────────────────────────────────────────

function DeleteConfirm({ name, onClose, onConfirm, isLoading }: {
  name: string; onClose: () => void; onConfirm: () => Promise<void>; isLoading: boolean;
}) {
  useModalOpen(true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="lc-modal-backdrop absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ backdropFilter: "blur(6px)", background: "rgba(0,0,0,0.4)" }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 8 }}
        transition={{ duration: 0.2 }}
        className="lc-modal-panel relative w-full max-w-sm rounded-2xl p-6 text-center"
        style={{ background: "var(--bg-modal)", border: "1px solid rgba(248,113,113,0.25)", boxShadow: "0 24px 64px var(--shadow-modal)" }}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgba(248,113,113,0.12)" }}>
          <UserX size={22} style={{ color: "#f87171" }} />
        </div>
        <h3 className="text-[16px] font-bold" style={{ color: "var(--text-title)" }}>Remover usuário?</h3>
        <p className="mt-1.5 text-[13px]" style={{ color: "color-mix(in srgb, var(--text-title) 45%, transparent)" }}>
          <strong style={{ color: "color-mix(in srgb, var(--text-title) 75%, transparent)" }}>{name}</strong> será removido permanentemente.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="h-9 rounded-xl px-5 text-[13px]"
            style={{ color: "color-mix(in srgb, var(--text-title) 50%, transparent)", background: "var(--hover)", border: "1px solid var(--border)" }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="h-9 rounded-xl px-5 text-[13px] font-semibold transition-all disabled:opacity-50"
            style={{ background: "#f87171", color: "#000000" }}
          >
            {isLoading ? "Removendo…" : "Remover"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 rounded-xl px-4 py-3.5" style={{ background: "var(--hover)" }}>
          <div className="h-8 w-8 rounded-full" style={{ background: "var(--hover)" }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 rounded" style={{ background: "var(--hover)" }} />
            <div className="h-2.5 w-48 rounded" style={{ background: "var(--hover)" }} />
          </div>
          <div className="h-5 w-20 rounded-full" style={{ background: "var(--hover)" }} />
          <div className="h-5 w-14 rounded-full" style={{ background: "var(--hover)" }} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type ModalState =
  | { type: "create" }
  | { type: "edit"; profile: UserProfile }
  | { type: "delete"; profile: UserProfile }
  | null;

export default function UsuariosPage() {
  return (
    <AdministrativeAccessGate>
      <UsuariosContent />
    </AdministrativeAccessGate>
  );
}

function UsuariosContent() {
  const {
    profiles, invites, isLoading, stats,
    createUser, updateUser, toggleActive, deleteUser,
    revokeInvite, resetPassword, uploadUserAvatar, removeUserAvatar,
  } = useUsers();
  const { pipelines } = usePipelines();

  const [modal, setModal] = useState<ModalState>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRole, setFilterRole] = useState("");

  const filtered = useMemo(() => {
    return profiles.filter(p => {
      const q = search.toLowerCase();
      if (q && !p.full_name.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q)) return false;
      if (filterStatus === "pending") {
        if (p.auth_user_id != null) return false;
      } else if (filterStatus !== "") {
        if (p.auth_user_id == null) return false;
        if (String(p.is_active) !== filterStatus) return false;
      }
      if (filterRole && p.role !== filterRole) return false;
      return true;
    });
  }, [profiles, search, filterStatus, filterRole]);

  async function handleCreate(data: CreateUserPayload | UpdateUserPayload) {
    setSaving(true);
    const payload = data as CreateUserPayload;
    const { error } = await createUser(payload);
    setSaving(false);
    if (error) { toast.error("Erro ao criar usuário", { description: error }); return; }
    if (payload.send_invite) {
      toast.success("Usuário criado e convite enviado por e-mail");
    } else {
      toast.success("Usuário criado com sucesso");
    }
    setModal(null);
  }

  async function handleEdit(data: CreateUserPayload | UpdateUserPayload) {
    if (modal?.type !== "edit") return;
    setSaving(true);
    const { error } = await updateUser(modal.profile.id, data as UpdateUserPayload);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar", { description: error }); return; }
    toast.success("Usuário atualizado");
    setModal(null);
  }

  async function handleToggle(p: UserProfile) {
    const { error } = await toggleActive(p.id, p.is_active);
    if (error) toast.error("Erro ao alterar status", { description: error });
    else toast.success(p.is_active ? "Usuário desativado" : "Usuário ativado");
  }

  async function handleReset(p: UserProfile) {
    const { error } = await resetPassword(p.email);
    if (error) toast.error("Erro ao enviar reset", { description: error });
    else toast.success("E-mail de redefinição enviado para " + p.email);
  }

  async function handleDelete() {
    if (modal?.type !== "delete") return;
    setSaving(true);
    const { error } = await deleteUser(modal.profile.id);
    setSaving(false);
    if (error) { toast.error("Erro ao remover", { description: error }); return; }
    toast.success("Usuário removido");
    setModal(null);
  }

  async function handleRevokeInvite(id: string) {
    const { error } = await revokeInvite(id);
    if (error) toast.error("Erro ao revogar convite", { description: error });
    else toast.success("Convite revogado");
  }

  const STATS = [
    { icon: Users,       label: "Total de usuários",  value: stats.total,   accent: "#27a3ff" },
    { icon: UserCheck,   label: "Usuários ativos",     value: stats.active,  accent: "#34d399" },
    { icon: Mail,        label: "Convites pendentes",  value: stats.pending, accent: "#facc15" },
    { icon: ShieldCheck, label: "Administradores",     value: stats.admins,  accent: "#a78bfa" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-32 sm:px-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between pt-5"
      >
        <div className="space-y-0.5">
          <Link
            href="/configuracoes"
            className="inline-flex items-center gap-1.5 text-[12px] transition-colors duration-150"
            style={{ color: "color-mix(in srgb, var(--text-title) 35%, transparent)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "color-mix(in srgb, var(--text-title) 70%, transparent)")}
            onMouseLeave={e => (e.currentTarget.style.color = "color-mix(in srgb, var(--text-title) 35%, transparent)")}
          >
            <ArrowLeft size={13} />
            Configurações
          </Link>
          <h1 className="text-xl font-bold sm:text-2xl" style={{ color: "var(--text-title)", letterSpacing: "-0.02em" }}>
            Usuários e Permissões
          </h1>
          <p className="text-[13px]" style={{ color: "color-mix(in srgb, var(--text-title) 38%, transparent)" }}>
            Gerencie equipe, acessos e módulos disponíveis
          </p>
        </div>
        <PrimaryButton
          onClick={() => setModal({ type: "create" })}
          signature
          size="medium"
        >
          <UserCheck size={14} />
          Novo Usuário
        </PrimaryButton>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s, i) => <StatsCard key={s.label} {...s} delay={0.05 + i * 0.06} />)}
      </div>

      {/* Search + Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "color-mix(in srgb, var(--text-title) 30%, transparent)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="h-9 w-full rounded-xl pl-9 pr-3.5 text-[13px] outline-none transition-all"
            style={{ background: "var(--hover)", border: "1px solid var(--border)", color: "var(--text-title)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
            onFocus={e => (e.currentTarget.style.borderColor = "var(--accent-blue)")}
            onBlur={e => (e.currentTarget.style.borderColor = "var(--glass-border)")}
          />
        </div>
        <FilterSelect value={filterStatus} onChange={setFilterStatus}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: "#111" }}>{o.label}</option>)}
        </FilterSelect>
        <FilterSelect value={filterRole} onChange={setFilterRole}>
          <option value="" style={{ background: "#111" }}>Todos os perfis</option>
          {ROLES.map(r => <option key={r} value={r} style={{ background: "#111" }}>{ROLE_LABELS[r]}</option>)}
        </FilterSelect>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
        className="rounded-2xl"
        style={{ background: "var(--hover)", border: "1px solid var(--border)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
      >
        <div
          className="hidden grid-cols-[auto_1fr_1fr_120px_100px_80px_32px] items-center gap-4 px-5 py-3 md:grid"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {["", "Nome", "E-mail / Cargo", "Perfil", "Status", "Criado em", ""].map((h, i) => (
            <span key={i} className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "color-mix(in srgb, var(--text-title) 30%, transparent)" }}>
              {h}
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="p-4"><Skeleton /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Users size={32} style={{ color: "color-mix(in srgb, var(--text-title) 10%, transparent)" }} />
            <p className="text-[13px]" style={{ color: "color-mix(in srgb, var(--text-title) 30%, transparent)" }}>
              {search || filterStatus || filterRole ? "Nenhum usuário encontrado com os filtros" : "Nenhum usuário cadastrado ainda"}
            </p>
            {!search && !filterStatus && !filterRole && (
              <PrimaryButton onClick={() => setModal({ type: "create" })} signature size="medium">
                <UserCheck size={13} />
                Adicionar primeiro usuário
              </PrimaryButton>
            )}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {filtered.map(profile => (
              <motion.div
                key={profile.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group flex flex-col gap-3 px-5 py-4 transition-colors md:grid md:grid-cols-[auto_1fr_1fr_120px_100px_80px_32px] md:items-center md:gap-4"
                style={{ background: "transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <Avatar name={profile.full_name} url={profile.avatar_url} size={32} />
                <div>
                  <p className="text-[14px] font-medium" style={{ color: "var(--text-title)" }}>{profile.full_name}</p>
                  {/* Mini permissões */}
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {profile.permissions.slice(0, 4).map(p => (
                      <span key={p} className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide" style={{ background: "var(--hover)", color: "color-mix(in srgb, var(--text-title) 30%, transparent)" }}>
                        {p}
                      </span>
                    ))}
                    {profile.permissions.length > 4 && (
                      <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ color: "color-mix(in srgb, var(--text-title) 20%, transparent)" }}>
                        +{profile.permissions.length - 4}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[13px]" style={{ color: "color-mix(in srgb, var(--text-title) 50%, transparent)" }}>{profile.email}</p>
                  {profile.job_title && (
                    <p className="text-[11px]" style={{ color: "color-mix(in srgb, var(--text-title) 30%, transparent)" }}>{profile.job_title}</p>
                  )}
                </div>
                <RoleBadge role={profile.role} />
                {profile.auth_user_id == null ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "#facc15" }}>
                    <Mail size={12} style={{ color: "#facc15" }} />
                    Convite enviado
                  </span>
                ) : (
                  <StatusDot active={profile.is_active} />
                )}
                <span className="text-[12px]" style={{ color: "color-mix(in srgb, var(--text-title) 30%, transparent)" }}>
                  {new Date(profile.created_at).toLocaleDateString("pt-BR")}
                </span>
                <RowActions
                  profile={profile}
                  onEdit={() => setModal({ type: "edit", profile })}
                  onToggle={() => handleToggle(profile)}
                  onReset={() => handleReset(profile)}
                  onDelete={() => setModal({ type: "delete", profile })}
                />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Pending invites */}
      <AnimatePresence>
        {invites.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--hover)", border: "1px solid var(--border)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
          >
            <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid rgba(250,204,21,0.1)" }}>
              <Mail size={14} style={{ color: "#facc15" }} />
              <span className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "#facc15" }}>
                Convites Pendentes ({invites.length})
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(250,204,21,0.08)" }}>
              {invites.map(invite => (
                <div key={invite.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "rgba(250,204,21,0.12)" }}>
                      <Mail size={14} style={{ color: "#facc15" }} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: "color-mix(in srgb, var(--text-title) 80%, transparent)" }}>{invite.email}</p>
                      <p className="text-[11px]" style={{ color: "color-mix(in srgb, var(--text-title) 35%, transparent)" }}>
                        Expira em {new Date(invite.expires_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <RoleBadge role={invite.role} />
                    <button
                      onClick={() => handleRevokeInvite(invite.id)}
                      title="Excluir convite"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all hover:scale-[1.02] active:scale-95"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
                    >
                      <Trash2 size={12} />
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {modal?.type === "create" && (
          <UserModal
            mode="create"
            initial={EMPTY_CREATE}
            onClose={() => setModal(null)}
            onSubmit={handleCreate}
            isLoading={saving}
            pipelines={pipelines}
          />
        )}
        {modal?.type === "edit" && (
          <UserModal
            mode="edit"
            initial={{
              full_name:   modal.profile.full_name,
              role:        modal.profile.role,
              job_title:   modal.profile.job_title ?? "",
              is_active:   modal.profile.is_active,
              permissions: modal.profile.permissions ?? ROLE_DEFAULT_PERMISSIONS[modal.profile.role],
              crm_pipeline_id: modal.profile.crm_pipeline_id,
            }}
            onClose={() => setModal(null)}
            onSubmit={handleEdit}
            isLoading={saving}
            pipelines={pipelines}
            profile={modal.profile}
            onAvatarUpload={(file) => uploadUserAvatar(modal.profile.id, file)}
            onAvatarRemove={() => removeUserAvatar(modal.profile.id)}
          />
        )}
        {modal?.type === "delete" && (
          <DeleteConfirm
            name={modal.profile.full_name}
            onClose={() => setModal(null)}
            onConfirm={handleDelete}
            isLoading={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
