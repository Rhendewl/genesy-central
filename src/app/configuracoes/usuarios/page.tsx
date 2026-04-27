"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Search, Users, UserCheck, Mail, ShieldCheck,
  MoreHorizontal, Pencil, Lock, Power, KeyRound, Trash2, X,
  ChevronDown, UserX,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  useUsers,
  UserProfile,
  UserRole,
  ROLE_LABELS,
  ROLE_COLORS,
  CreateUserPayload,
  UpdateUserPayload,
} from "@/hooks/useUsers";
import { useModalOpen } from "@/hooks/useModalOpen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROLES: UserRole[] = ["admin", "comercial", "trafego", "financeiro", "operacional", "viewer"];

const STATUS_OPTIONS = [
  { value: "",       label: "Todos os status" },
  { value: "true",   label: "Ativo" },
  { value: "false",  label: "Inativo" },
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
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `hsl(${hue}, 60%, 72%)`,
      }}
    >
      {initials}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RoleBadge
// ─────────────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{
        background: `${ROLE_COLORS[role]}18`,
        color: ROLE_COLORS[role],
        border: `1px solid ${ROLE_COLORS[role]}30`,
      }}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusDot
// ─────────────────────────────────────────────────────────────────────────────

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: active ? "#34d399" : "rgba(255,255,255,0.3)" }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? "#34d399" : "rgba(255,255,255,0.2)" }} />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatsCard
// ─────────────────────────────────────────────────────────────────────────────

function StatsCard({
  icon: Icon,
  label,
  value,
  accent,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className="flex items-center gap-4 rounded-2xl p-4"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}18` }}>
        <Icon size={18} style={{ color: accent }} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-[22px] font-bold leading-none" style={{ color: "#ffffff" }}>{value}</p>
        <p className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RowActions dropdown
// ─────────────────────────────────────────────────────────────────────────────

function RowActions({
  profile,
  onEdit,
  onToggle,
  onReset,
  onDelete,
}: {
  profile: UserProfile;
  onEdit: () => void;
  onToggle: () => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  const actions = [
    { icon: Pencil,   label: "Editar",         action: onEdit,   color: "rgba(255,255,255,0.8)" },
    { icon: Lock,     label: "Permissões",      action: onEdit,   color: "rgba(255,255,255,0.8)" },
    {
      icon: Power,
      label: profile.is_active ? "Desativar" : "Ativar",
      action: onToggle,
      color: profile.is_active ? "#f87171" : "#34d399",
    },
    { icon: KeyRound, label: "Resetar senha",   action: onReset,  color: "rgba(255,255,255,0.8)" },
    { icon: Trash2,   label: "Remover",         action: onDelete, color: "#f87171" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
        style={{ color: "rgba(255,255,255,0.35)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#ffffff")}
        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
      >
        <MoreHorizontal size={15} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-8 z-20 min-w-[160px] rounded-xl py-1.5 shadow-2xl"
              style={{
                background: "rgba(18,18,18,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {actions.map(({ icon: ActionIcon, label, action, color }) => (
                <button
                  key={label}
                  onClick={() => { action(); setOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors"
                  style={{ color }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
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

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-9 appearance-none rounded-xl pl-3.5 pr-8 text-[13px] outline-none transition-all cursor-pointer"
        style={{
          background: "rgba(255,255,255,0.09)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.7)",
        }}
      >
        {children}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2.5" style={{ color: "rgba(255,255,255,0.35)" }} />
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
};

function UserModal({
  mode,
  initial,
  onClose,
  onSubmit,
  isLoading,
}: {
  mode: "create" | "edit";
  initial: CreateUserPayload | UpdateUserPayload;
  onClose: () => void;
  onSubmit: (data: CreateUserPayload | UpdateUserPayload) => Promise<void>;
  isLoading: boolean;
}) {
  useModalOpen(true);
  const [form, setForm] = useState<Record<string, unknown>>(initial as unknown as Record<string, unknown>);

  function field(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(form as unknown as CreateUserPayload);
  }

  const isCreate = mode === "create";
  const f = form;

  const inputStyle = {
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#ffffff",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="relative w-full max-w-lg rounded-2xl p-6"
        style={{
          background: "rgba(10,10,10,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-bold" style={{ color: "#ffffff" }}>
              {isCreate ? "Novo Usuário" : "Editar Usuário"}
            </h2>
            <p className="mt-0.5 text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              {isCreate ? "Adicione um membro à equipe" : "Atualize dados e permissões"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#ffffff")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
              Nome Completo *
            </label>
            <input
              required
              value={f.full_name as string}
              onChange={e => field("full_name", e.target.value)}
              placeholder="Ex.: Ana Lima"
              className="h-10 w-full rounded-xl px-3.5 text-[14px] outline-none transition-all"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(39,163,255,0.45)")}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          {/* Email (create only) */}
          {isCreate && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                E-mail *
              </label>
              <input
                required
                type="email"
                value={f.email as string}
                onChange={e => field("email", e.target.value)}
                placeholder="email@empresa.com.br"
                className="h-10 w-full rounded-xl px-3.5 text-[14px] outline-none transition-all"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(39,163,255,0.45)")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>
          )}

          {/* Cargo + Perfil (side by side) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                Cargo
              </label>
              <input
                value={f.job_title as string}
                onChange={e => field("job_title", e.target.value)}
                placeholder="Ex.: Analista"
                className="h-10 w-full rounded-xl px-3.5 text-[14px] outline-none transition-all"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(39,163,255,0.45)")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                Perfil de Acesso *
              </label>
              <div className="relative">
                <select
                  required
                  value={f.role as string}
                  onChange={e => field("role", e.target.value)}
                  className="h-10 w-full appearance-none rounded-xl pl-3.5 pr-8 text-[14px] outline-none transition-all cursor-pointer"
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(39,163,255,0.45)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r} style={{ background: "#111" }}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Toggle
              label="Usuário ativo"
              description="Permite acesso imediato à plataforma"
              checked={f.is_active as boolean}
              onChange={v => field("is_active", v)}
            />
            {isCreate && (
              <Toggle
                label="Enviar convite por e-mail"
                description="Registra convite pendente (envio via servidor)"
                checked={f.send_invite as boolean}
                onChange={v => field("send_invite", v)}
              />
            )}
          </div>

          {/* Permissions reference */}
          <div className="rounded-xl p-3.5" style={{ background: "rgba(39,163,255,0.06)", border: "1px solid rgba(39,163,255,0.15)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "rgba(39,163,255,0.8)" }}>
              Permissões do perfil: {ROLE_LABELS[f.role as UserRole]}
            </p>
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
              {ROLE_PERMISSIONS[f.role as UserRole]}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-xl px-5 text-[13px] transition-colors"
              style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.08)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
            >
              Cancelar
            </button>
            <PrimaryButton type="submit" disabled={isLoading} className="h-9 px-6 text-[13px]">
              {isLoading ? "Salvando…" : isCreate ? "Criar Usuário" : "Salvar Alterações"}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle
// ─────────────────────────────────────────────────────────────────────────────

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>{label}</p>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-5 w-9 shrink-0 rounded-full transition-all duration-200"
        style={{ background: checked ? "#27a3ff" : "rgba(255,255,255,0.12)" }}
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
// DeleteConfirm
// ─────────────────────────────────────────────────────────────────────────────

function DeleteConfirm({
  name,
  onClose,
  onConfirm,
  isLoading,
}: {
  name: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}) {
  useModalOpen(true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-sm rounded-2xl p-6 text-center"
        style={{ background: "rgba(10,10,10,0.97)", border: "1px solid rgba(248,113,113,0.25)", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgba(248,113,113,0.12)" }}>
          <UserX size={22} style={{ color: "#f87171" }} />
        </div>
        <h3 className="text-[16px] font-bold" style={{ color: "#ffffff" }}>Remover usuário?</h3>
        <p className="mt-1.5 text-[13px]" style={{ color: "rgba(255,255,255,0.45)" }}>
          <strong style={{ color: "rgba(255,255,255,0.75)" }}>{name}</strong> será removido permanentemente. Esta ação não pode ser desfeita.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="h-9 rounded-xl px-5 text-[13px]"
            style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.08)" }}
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
// Permissions reference
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, string> = {
  admin:       "Acesso total à plataforma, configurações e dados.",
  comercial:   "Acesso ao CRM, leads e pipeline comercial.",
  trafego:     "Acesso ao módulo de tráfego pago e campanhas.",
  financeiro:  "Acesso ao módulo financeiro, receitas e despesas.",
  operacional: "Visualização ampla sem acesso a áreas críticas.",
  viewer:      "Apenas consulta. Sem capacidade de edição.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 rounded-xl px-4 py-3.5" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-8 w-8 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="h-2.5 w-48 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>
          <div className="h-5 w-20 rounded-full" style={{ background: "rgba(255,255,255,0.09)" }} />
          <div className="h-5 w-14 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
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
  const {
    profiles, invites, isLoading, stats,
    createUser, updateUser, toggleActive, deleteUser,
    revokeInvite, resetPassword,
  } = useUsers();

  const [modal, setModal] = useState<ModalState>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRole, setFilterRole] = useState("");

  const filtered = useMemo(() => {
    return profiles.filter(p => {
      const q = search.toLowerCase();
      if (q && !p.full_name.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q)) return false;
      if (filterStatus !== "" && String(p.is_active) !== filterStatus) return false;
      if (filterRole && p.role !== filterRole) return false;
      return true;
    });
  }, [profiles, search, filterStatus, filterRole]);

  async function handleCreate(data: CreateUserPayload | UpdateUserPayload) {
    setSaving(true);
    const { error } = await createUser(data as CreateUserPayload);
    setSaving(false);
    if (error) { toast.error("Erro ao criar usuário", { description: error }); return; }
    toast.success("Usuário criado com sucesso");
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
    { icon: Users,      label: "Total de usuários",  value: stats.total,   accent: "#27a3ff" },
    { icon: UserCheck,  label: "Usuários ativos",     value: stats.active,  accent: "#34d399" },
    { icon: Mail,       label: "Convites pendentes",  value: stats.pending, accent: "#facc15" },
    { icon: ShieldCheck,label: "Administradores",     value: stats.admins,  accent: "#a78bfa" },
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
            style={{ color: "rgba(255,255,255,0.35)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
          >
            <ArrowLeft size={13} />
            Configurações
          </Link>
          <h1 className="text-xl font-bold sm:text-2xl" style={{ color: "#ffffff", letterSpacing: "-0.02em" }}>
            Usuários e Permissões
          </h1>
          <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.38)" }}>
            Gerencie equipe, acessos e níveis de controle
          </p>
        </div>

        <PrimaryButton
          onClick={() => setModal({ type: "create" })}
          className="flex items-center gap-2 px-5 py-2.5 text-[13px]"
        >
          <Plus size={14} />
          Novo Usuário
        </PrimaryButton>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <StatsCard key={s.label} {...s} delay={0.05 + i * 0.06} />
        ))}
      </div>

      {/* Search + Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="h-9 w-full rounded-xl pl-9 pr-3.5 text-[13px] outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.09)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#ffffff",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "rgba(39,163,255,0.35)")}
            onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
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
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Table header */}
        <div
          className="hidden grid-cols-[auto_1fr_1fr_120px_100px_80px_32px] items-center gap-4 px-5 py-3 md:grid"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          {["", "Nome", "E-mail / Cargo", "Perfil", "Status", "Criado em", ""].map((h, i) => (
            <span key={i} className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.3)" }}>
              {h}
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="p-4"><Skeleton /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Users size={32} style={{ color: "rgba(255,255,255,0.1)" }} />
            <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              {search || filterStatus || filterRole ? "Nenhum usuário encontrado com os filtros aplicados" : "Nenhum usuário cadastrado ainda"}
            </p>
            {!search && !filterStatus && !filterRole && (
              <PrimaryButton onClick={() => setModal({ type: "create" })} className="mt-1 flex items-center gap-2 px-5 py-2 text-[13px]">
                <Plus size={13} />
                Adicionar primeiro usuário
              </PrimaryButton>
            )}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {filtered.map(profile => (
              <motion.div
                key={profile.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group flex flex-col gap-3 px-5 py-4 transition-colors md:grid md:grid-cols-[auto_1fr_1fr_120px_100px_80px_32px] md:items-center md:gap-4"
                style={{ background: "transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* Avatar */}
                <Avatar name={profile.full_name} url={profile.avatar_url} size={32} />

                {/* Name */}
                <div>
                  <p className="text-[14px] font-medium" style={{ color: "#ffffff" }}>{profile.full_name}</p>
                </div>

                {/* Email / Cargo */}
                <div>
                  <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.5)" }}>{profile.email}</p>
                  {profile.job_title && (
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>{profile.job_title}</p>
                  )}
                </div>

                {/* Role */}
                <RoleBadge role={profile.role} />

                {/* Status */}
                <StatusDot active={profile.is_active} />

                {/* Created */}
                <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {new Date(profile.created_at).toLocaleDateString("pt-BR")}
                </span>

                {/* Actions */}
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
            style={{ background: "rgba(250,204,21,0.04)", border: "1px solid rgba(250,204,21,0.15)" }}
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
                      <p className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>{invite.email}</p>
                      <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                        Expira em {new Date(invite.expires_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <RoleBadge role={invite.role} />
                    <button
                      onClick={() => handleRevokeInvite(invite.id)}
                      className="text-[12px] transition-colors"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
                    >
                      Revogar
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
          />
        )}
        {modal?.type === "edit" && (
          <UserModal
            mode="edit"
            initial={{
              full_name: modal.profile.full_name,
              role:      modal.profile.role,
              job_title: modal.profile.job_title ?? "",
              is_active: modal.profile.is_active,
            }}
            onClose={() => setModal(null)}
            onSubmit={handleEdit}
            isLoading={saving}
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
