"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, Building2, Briefcase, Settings2, Save, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useCompanyProfile, CompanyProfilePayload } from "@/hooks/useCompanyProfile";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
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

function ProfileTextarea({
  label,
  hint,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.45)" }}>
        {label}
      </label>
      <textarea
        {...props}
        rows={3}
        className="w-full resize-none rounded-xl px-3.5 py-2.5 text-[14px] outline-none transition-all duration-200"
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

function ProfileSelect({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.45)" }}>
        {label}
      </label>
      <select
        {...props}
        className="h-10 w-full rounded-xl px-3.5 text-[14px] outline-none transition-all duration-200 appearance-none cursor-pointer"
        style={{
          background: "rgba(255,255,255,0.09)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#ffffff",
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = "rgba(39,163,255,0.45)";
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        }}
      >
        {children}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LogoUploader
// ─────────────────────────────────────────────────────────────────────────────

interface LogoUploaderProps {
  currentUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}

function LogoUploader({ currentUrl, onUpload, isUploading }: LogoUploaderProps) {
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
        Logo da Empresa
      </label>

      <div className="flex items-center gap-4">
        {/* Preview circle */}
        <div
          className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {preview ? (
            <img src={preview} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <Building2 size={28} style={{ color: "rgba(255,255,255,0.2)" }} />
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: "rgba(0,0,0,0.6)" }}>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          )}
        </div>

        {/* Drop zone */}
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

        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SettingsSection
// ─────────────────────────────────────────────────────────────────────────────

function SettingsSection({
  icon: Icon,
  title,
  accentColor,
  children,
  delay = 0,
}: {
  icon: React.ElementType;
  title: string;
  accentColor: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="rounded-2xl p-6"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${accentColor}18` }}>
          <Icon size={16} style={{ color: accentColor }} strokeWidth={1.75} />
        </div>
        <h2 className="text-[13px] font-semibold tracking-wide" style={{ color: "rgba(255,255,255,0.75)" }}>
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="mb-5 h-4 w-32 rounded-lg" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="space-y-2">
                <div className="h-3 w-20 rounded" style={{ background: "rgba(255,255,255,0.09)" }} />
                <div className="h-10 w-full rounded-xl" style={{ background: "rgba(255,255,255,0.08)" }} />
              </div>
            ))}
          </div>
        </div>
      ))}
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

export default function PerfilEmpresaPage() {
  const { profile, isLoading, isSaving, defaults, save, uploadAndSaveLogo } = useCompanyProfile();
  const [form, setForm] = useState<CompanyProfilePayload>(defaults);
  const [isDirty, setIsDirty] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      const { id, user_id, created_at, updated_at, ...rest } = profile;
      setForm(rest);
      setIsDirty(false);
    }
  }, [profile]);

  // NOT NULL columns — empty string must stay as the default, never null
  const NOT_NULL_FIELDS = new Set<keyof CompanyProfilePayload>([
    "country", "timezone", "currency", "language", "date_format",
  ]);

  function set(key: keyof CompanyProfilePayload, value: string | null) {
    const coerced = (!value && NOT_NULL_FIELDS.has(key)) ? (defaults[key] as string) : (value || null);
    setForm(prev => ({ ...prev, [key]: coerced }));
    setIsDirty(true);
  }

  async function handleSave() {
    const { error } = await save(form);
    if (error) {
      toast.error("Erro ao salvar", { description: error, icon: <AlertCircle size={15} /> });
    } else {
      toast.success("Perfil salvo com sucesso", { icon: <CheckCircle2 size={15} /> });
      setIsDirty(false);
    }
  }

  async function handleLogoUpload(file: File) {
    setIsUploading(true);
    const { url, error } = await uploadAndSaveLogo(file);
    setIsUploading(false);
    if (error) {
      toast.error("Erro ao enviar logo", { description: error });
    } else if (url) {
      set("logo_url", url);
      toast.success("Logo atualizado");
    }
  }

  const str = (v: string | null | undefined) => v ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pb-40 sm:px-6">
      {/* Back nav + header */}
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
          Perfil da Empresa
        </h1>
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.38)" }}>
          Dados institucionais e identidade da operação
        </p>
      </motion.div>

      {isLoading ? (
        <Skeleton />
      ) : (
        <>
          {/* Section A: Identidade */}
          <SettingsSection icon={Building2} title="Identidade" accentColor="#27a3ff" delay={0.05}>
            <div className="sm:col-span-2">
              <LogoUploader currentUrl={form.logo_url} onUpload={handleLogoUpload} isUploading={isUploading} />
            </div>

            <ProfileInput
              label="Razão Social"
              placeholder="Nome completo da empresa"
              value={str(form.company_name)}
              onChange={e => set("company_name", e.target.value)}
            />
            <ProfileInput
              label="Nome Fantasia"
              placeholder="Como é conhecida no mercado"
              value={str(form.trade_name)}
              onChange={e => set("trade_name", e.target.value)}
            />
            <ProfileInput
              label="Website"
              placeholder="https://suaempresa.com.br"
              type="url"
              value={str(form.website)}
              onChange={e => set("website", e.target.value)}
            />

            <div className="sm:col-span-2">
              <ProfileTextarea
                label="Descrição"
                placeholder="Breve descrição da empresa, serviços ou missão..."
                value={str(form.description)}
                onChange={e => set("description", e.target.value)}
              />
            </div>
          </SettingsSection>

          {/* Section B: Dados Empresariais */}
          <SettingsSection icon={Briefcase} title="Dados Empresariais" accentColor="#27f2e6" delay={0.12}>
            <ProfileInput
              label="CNPJ"
              placeholder="00.000.000/0000-00"
              value={str(form.cnpj)}
              onChange={e => set("cnpj", e.target.value)}
            />
            <ProfileInput
              label="E-mail comercial"
              placeholder="contato@empresa.com.br"
              type="email"
              value={str(form.email)}
              onChange={e => set("email", e.target.value)}
            />
            <ProfileInput
              label="Telefone"
              placeholder="(11) 0000-0000"
              type="tel"
              value={str(form.phone)}
              onChange={e => set("phone", e.target.value)}
            />
            <ProfileInput
              label="WhatsApp"
              placeholder="(11) 90000-0000"
              type="tel"
              value={str(form.whatsapp)}
              onChange={e => set("whatsapp", e.target.value)}
            />

            <div className="sm:col-span-2">
              <ProfileInput
                label="Endereço"
                placeholder="Rua, número, complemento"
                value={str(form.address)}
                onChange={e => set("address", e.target.value)}
              />
            </div>

            <ProfileInput
              label="Cidade"
              placeholder="São Paulo"
              value={str(form.city)}
              onChange={e => set("city", e.target.value)}
            />
            <ProfileInput
              label="Estado"
              placeholder="SP"
              maxLength={2}
              value={str(form.state)}
              onChange={e => set("state", e.target.value.toUpperCase())}
            />
            <ProfileInput
              label="CEP"
              placeholder="00000-000"
              value={str(form.zip_code)}
              onChange={e => set("zip_code", e.target.value)}
            />
            <ProfileInput
              label="País"
              placeholder="Brasil"
              value={str(form.country)}
              onChange={e => set("country", e.target.value)}
            />
          </SettingsSection>

          {/* Section C: Preferências Operacionais */}
          <SettingsSection icon={Settings2} title="Preferências Operacionais" accentColor="#a78bfa" delay={0.19}>
            <ProfileSelect
              label="Fuso Horário"
              value={str(form.timezone)}
              onChange={e => set("timezone", e.target.value)}
            >
              <option value="America/Sao_Paulo">America/Sao_Paulo (GMT-3)</option>
              <option value="America/Manaus">America/Manaus (GMT-4)</option>
              <option value="America/Belem">America/Belem (GMT-3)</option>
              <option value="America/Fortaleza">America/Fortaleza (GMT-3)</option>
              <option value="America/Recife">America/Recife (GMT-3)</option>
              <option value="America/Noronha">America/Noronha (GMT-2)</option>
              <option value="UTC">UTC (GMT+0)</option>
            </ProfileSelect>

            <ProfileSelect
              label="Moeda"
              value={str(form.currency)}
              onChange={e => set("currency", e.target.value)}
            >
              <option value="BRL">BRL — Real Brasileiro</option>
              <option value="USD">USD — Dólar Americano</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — Libra Esterlina</option>
            </ProfileSelect>

            <ProfileSelect
              label="Idioma"
              value={str(form.language)}
              onChange={e => set("language", e.target.value)}
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
              <option value="es-ES">Español (España)</option>
            </ProfileSelect>

            <ProfileSelect
              label="Formato de Data"
              value={str(form.date_format)}
              onChange={e => set("date_format", e.target.value)}
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </ProfileSelect>
          </SettingsSection>
        </>
      )}

      <SaveBar isDirty={isDirty} isSaving={isSaving} onSave={handleSave} />
    </div>
  );
}
