"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, UserRound, Save, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useMyProfile } from "@/hooks/useMyProfile";
import { ROLE_LABELS, ROLE_COLORS, type UserRole } from "@/lib/roles";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

// ─────────────────────────────────────────────────────────────────────────────
// ProfileInput
// ─────────────────────────────────────────────────────────────────────────────

function ProfileInput({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.45)" }}>
        {label}
      </label>
      <input
        {...props}
        className="h-10 w-full rounded-xl px-3.5 text-[14px] outline-none transition-all duration-200"
        style={{
          background: "rgba(255,255,255,0.09)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#ffffff",
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = "rgba(39,163,255,0.45)";
          e.currentTarget.style.background = "rgba(255,255,255,0.07)";
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        }}
      />
      {hint && <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AvatarUploader
// ─────────────────────────────────────────────────────────────────────────────

interface AvatarUploaderProps {
  currentUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}

function AvatarUploader({ currentUrl, onUpload, isUploading }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);

  useEffect(() => { setPreview(currentUrl); }, [currentUrl]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Arquivo inválido. Use PNG, JPG ou WebP.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    await onUpload(file);
    URL.revokeObjectURL(objectUrl);
  }, [onUpload]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.45)" }}>
        Sua Foto
      </label>

      <div className="flex items-center gap-4">
        <div
          className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {preview ? (
            <img src={preview} alt="Foto de perfil" className="h-full w-full object-cover" />
          ) : (
            <UserRound size={28} style={{ color: "rgba(255,255,255,0.2)" }} />
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full" style={{ background: "rgba(0,0,0,0.6)" }}>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          )}
        </div>

        <motion.div
          animate={{ borderColor: isDragging ? "rgba(39,163,255,0.6)" : "rgba(255,255,255,0.1)" }}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl py-5 transition-colors duration-200"
          style={{ background: isDragging ? "rgba(39,163,255,0.06)" : "rgba(255,255,255,0.03)", border: "1.5px dashed rgba(255,255,255,0.1)" }}
          whileHover={{ background: "rgba(255,255,255,0.09)" }}
        >
          <Upload size={16} style={{ color: "rgba(255,255,255,0.35)" }} />
          <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            Arraste ou <span style={{ color: "rgba(39,163,255,0.8)" }}>clique para selecionar</span>
          </p>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.22)" }}>PNG, JPG, WebP · Máx. 5 MB</p>
        </motion.div>

        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SaveBar
// ─────────────────────────────────────────────────────────────────────────────

function SaveBar({ isDirty, isSaving, onSave }: { isDirty: boolean; isSaving: boolean; onSave: () => void }) {
  return (
    <AnimatePresence>
      {isDirty && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
          className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2"
        >
          <div
            className="flex items-center gap-4 rounded-2xl px-5 py-3"
            style={{
              background: "rgba(10,10,10,0.85)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset",
            }}
          >
            <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              Alterações não salvas
            </span>
            <PrimaryButton onClick={onSave} disabled={isSaving} className="flex items-center gap-2 px-5 py-2 text-[13px]">
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Salvando…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save size={13} />
                  Salvar Alterações
                </span>
              )}
            </PrimaryButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function MeuPerfilPage() {
  const { member, isLoading, isSaving, save, uploadAvatar } = useMyProfile();
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (member) {
      setFullName(member.full_name ?? "");
      setJobTitle(member.job_title ?? "");
      setIsDirty(false);
    }
  }, [member]);

  async function handleSave() {
    const { error } = await save({ full_name: fullName, job_title: jobTitle || null });
    if (error) {
      toast.error("Erro ao salvar", { description: error, icon: <AlertCircle size={15} /> });
    } else {
      toast.success("Perfil salvo com sucesso", { icon: <CheckCircle2 size={15} /> });
      setIsDirty(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    setIsUploading(true);
    const { error } = await uploadAvatar(file);
    setIsUploading(false);
    if (error) {
      toast.error("Erro ao enviar foto", { description: error });
    } else {
      toast.success("Foto atualizada");
    }
  }

  const roleLabel = member?.role && member.role in ROLE_LABELS ? ROLE_LABELS[member.role as UserRole] : member?.role;
  const roleColor = member?.role && member.role in ROLE_COLORS ? ROLE_COLORS[member.role as UserRole] : "rgba(255,255,255,0.35)";

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pb-40 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="space-y-1 pt-5"
      >
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
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: "#ffffff", letterSpacing: "-0.02em" }}>
          Meu Perfil
        </h1>
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.38)" }}>
          Seu nome, foto e cargo — visíveis só para você e sua equipe
        </p>
      </motion.div>

      {isLoading ? (
        <div className="animate-pulse rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="h-20 w-20 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
          className="space-y-5 rounded-2xl p-6"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <AvatarUploader currentUrl={member?.avatar_url ?? null} onUpload={handleAvatarUpload} isUploading={isUploading} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProfileInput
              label="Seu Nome"
              placeholder="Como devemos te chamar"
              hint="Usado no cumprimento do Dashboard"
              value={fullName}
              onChange={e => { setFullName(e.target.value); setIsDirty(true); }}
            />
            <ProfileInput
              label="Cargo"
              placeholder="Ex: Gestor de Tráfego"
              value={jobTitle}
              onChange={e => { setJobTitle(e.target.value); setIsDirty(true); }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.45)" }}>
              Papel
            </label>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium"
                style={{ background: `${roleColor}18`, color: roleColor }}
              >
                {roleLabel}
              </span>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                Definido pelo administrador em Usuários e Permissões
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <SaveBar isDirty={isDirty} isSaving={isSaving} onSave={handleSave} />
    </div>
  );
}
