"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2, CheckCircle2, AlertCircle, ExternalLink,
  Shield, Bell, Link2, Globe, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { FormularioShell } from "../_components/FormularioShell";
import { ConfigSubNav } from "./_components/ConfigSubNav";
import type { Form, FormStatus } from "@/types";
import { Switch } from "@/components/ui/Switch";

// ── Local types ───────────────────────────────────────────────────────────────

type SlugStatus = "idle" | "checking" | "ok" | "taken" | "invalid";

interface Draft {
  name:               string;
  slug:               string;
  status:             FormStatus;
  notificationEmails: string;
  antiFraudEnabled:   boolean;
}

interface Errors {
  name?: string;
  slug?: string;
  emails?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeSlug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function toDraft(form: Form): Draft {
  const st = form.settings ?? {};
  return {
    name:               form.name,
    slug:               form.slug,
    status:             form.status,
    notificationEmails: (st.notificationEmails ?? []).join(", "),
    antiFraudEnabled: st.antiFraudEnabled ?? false,
  };
}

// ── Primitive components ──────────────────────────────────────────────────────

const Toggle = Switch;

function SectionCard({
  title, description, icon: Icon, children,
}: {
  title: string; description?: string; icon?: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
      <div className="flex items-start gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        {Icon && (
          <div className="mt-0.5 p-1.5 rounded-lg" style={{ background: "var(--glass-bg-soft)" }}>
            <Icon size={13} style={{ color: "var(--muted-foreground)" }} />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>{title}</p>
          {description && <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{description}</p>}
        </div>
      </div>
      <div className="px-5 py-4 flex flex-col gap-4">{children}</div>
    </div>
  );
}

function FieldRow({
  label, description, error, required, children,
}: {
  label: string; description?: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-title)" }}>
        {label}{required && <span className="ml-0.5" style={{ color: "#ef4444" }}>*</span>}
      </label>
      {children}
      {error
        ? <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: "#ef4444" }}>
            <AlertCircle size={10} />{error}
          </p>
        : description
          ? <p className="text-[11px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>{description}</p>
          : null
      }
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, disabled, hasError, type = "text", suffix,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  disabled?: boolean; hasError?: boolean; type?: string; suffix?: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center">
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all disabled:opacity-50"
        style={{
          background: "var(--hover)",
          border:        `1px solid ${hasError ? "#ef4444" : "var(--border)"}`,
          color:         "var(--text-title)",
          paddingRight:  suffix ? "2.5rem" : "0.75rem",
        }}
      />
      {suffix && <div className="absolute right-3">{suffix}</div>}
    </div>
  );
}

function Textarea({
  value, onChange, placeholder, rows = 3,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
      style={{ background: "var(--hover)", border: "1px solid var(--border)", color: "var(--text-title)" }}
    />
  );
}

function SwitchRow({
  label, description, checked, onChange,
}: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" style={{ color: "var(--text-title)" }}>{label}</p>
        {description && <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function Divider() {
  return <div className="h-px" style={{ background: "var(--border)" }} />;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FormularioConfiguracoesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [form,      setForm]      = useState<Form | null>(null);
  const [draft,     setDraft]     = useState<Draft | null>(null);
  const [saved,     setSaved]     = useState<Draft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving,  setIsSaving]  = useState(false);
  const [errors,    setErrors]    = useState<Errors>({});

  // Slug availability check
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    fetch(`/api/formularios/${id}`)
      .then(r => r.json())
      .then(json => {
        if (!mounted || !json.formulario) return;
        const f = json.formulario as Form;
        const d = toDraft(f);
        setForm(f);
        setDraft(d);
        setSaved(d);
      })
      .catch(() => toast.error("Erro ao carregar configurações"))
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [id]);

  // ── Slug check ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!draft || !saved) return;
    const slug = draft.slug;

    if (slug === saved.slug) { setSlugStatus("idle"); return; }
    if (!slug || slug.length < 3) { setSlugStatus("invalid"); return; }
    if (normalizeSlug(slug) !== slug) { setSlugStatus("invalid"); return; }

    setSlugStatus("checking");
    if (slugTimer.current) clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/formularios/check-slug?slug=${encodeURIComponent(slug)}&exclude=${id}`
        );
        const { available } = await r.json() as { available: boolean };
        setSlugStatus(available ? "ok" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 600);

    return () => { if (slugTimer.current) clearTimeout(slugTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.slug]);

  // ── Patch helpers ───────────────────────────────────────────────────────────

  const patch = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev);
    setErrors(prev => ({ ...prev, [key === "notificationEmails" ? "emails" : key]: undefined }));
  }, []);

  // ── Validate ────────────────────────────────────────────────────────────────

  function validate(d: Draft): Errors {
    const e: Errors = {};
    if (!d.name.trim()) e.name = "Nome é obrigatório";
    if (!d.slug.trim() || d.slug.length < 3) e.slug = "Slug deve ter pelo menos 3 caracteres";
    if (slugStatus === "taken")   e.slug = "Este slug já está em uso";
    if (slugStatus === "invalid") e.slug = "Slug inválido (use apenas letras, números e hífens)";
    if (slugStatus === "checking") e.slug = "Aguarde a verificação do slug";
    if (d.notificationEmails.trim()) {
      const invalid = d.notificationEmails.split(",").filter(e => e.trim() && !isValidEmail(e));
      if (invalid.length > 0) e.emails = `E-mail inválido: ${invalid[0].trim()}`;
    }
    return e;
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!draft || !form) return;
    const errs = validate(draft);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setIsSaving(true);
    try {
      const payload = {
        name:   draft.name.trim(),
        slug:   normalizeSlug(draft.slug),
        status: draft.status,
        settings: {
          ...form.settings,
          notificationEmails: draft.notificationEmails
            .split(",")
            .map(e => e.trim())
            .filter(Boolean),
          antiFraudEnabled: draft.antiFraudEnabled,
        },
      };

      const res = await fetch(`/api/formularios/${id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 409) setErrors({ slug: "Este slug já está em uso" });
        else toast.error("Erro ao salvar", { description: json.error });
        return;
      }

      const updated   = json.formulario as Form;
      const newDraft  = toDraft(updated);

      setForm(updated);
      setDraft(newDraft);
      setSaved(newDraft);
      setSlugStatus("idle");
      toast.success("Configurações salvas!");
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, form, id, slugStatus]);

  // ── Cancel ──────────────────────────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    if (!saved) return;
    setDraft(saved);
    setErrors({});
    setSlugStatus("idle");
  }, [saved]);

  // ── isDirty ─────────────────────────────────────────────────────────────────

  const isDirty = draft && saved && JSON.stringify(draft) !== JSON.stringify(saved);

  // ── Public URL ──────────────────────────────────────────────────────────────

  const origin    = typeof window !== "undefined" ? window.location.origin : "https://seudominio.com";
  const publicUrl = `${origin}/form/${draft?.slug ?? ""}`;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <FormularioShell id={id}>
      <div className="px-4 sm:px-6 pt-5 pb-32 flex flex-col gap-4 max-w-2xl">

        <ConfigSubNav />

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 py-8" style={{ color: "var(--muted-foreground)" }}>
            <Loader2 size={15} className="animate-spin" />
            <span className="text-sm">Carregando…</span>
          </div>
        )}

        {draft && (
          <>
            {/* ── 1. Informações Gerais ────────────────────────────────────── */}
            <SectionCard title="Informações Gerais" icon={Link2}>

              <FieldRow label="Nome do formulário" required error={errors.name}>
                <TextInput
                  value={draft.name}
                  onChange={v => patch("name", v)}
                  placeholder="Ex: Formulário de Contato"
                  hasError={!!errors.name}
                />
              </FieldRow>

              <FieldRow
                label="Slug (URL)"
                required
                error={errors.slug}
                description={!errors.slug ? `URL pública: ${publicUrl}` : undefined}
              >
                <TextInput
                  value={draft.slug}
                  onChange={v => patch("slug", normalizeSlug(v))}
                  placeholder="meu-formulario"
                  hasError={!!errors.slug}
                  suffix={
                    slugStatus === "checking" ? <Loader2 size={12} className="animate-spin" style={{ color: "var(--muted-foreground)" }} /> :
                    slugStatus === "ok"       ? <CheckCircle2 size={12} style={{ color: "#22c55e" }} /> :
                    slugStatus === "taken"    ? <AlertCircle  size={12} style={{ color: "#ef4444" }} /> :
                    null
                  }
                />
                {!errors.slug && draft.slug && (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-[11px] hover:underline"
                    style={{ color: "var(--primary)" }}
                  >
                    <Globe size={10} />
                    {publicUrl}
                    <ExternalLink size={9} />
                  </a>
                )}
              </FieldRow>

              <Divider />

              <SwitchRow
                label="Status do formulário"
                description={draft.status === "published" ? "Formulário ativo — aceitando respostas" : "Formulário inativo — inacessível ao público"}
                checked={draft.status === "published"}
                onChange={v => patch("status", v ? "published" : "disabled")}
              />
            </SectionCard>

            {/* ── 2. Notificações ──────────────────────────────────────────── */}
            <SectionCard
              title="Notificações"
              description="Receba e-mails sempre que uma nova resposta for enviada."
              icon={Bell}
            >
              <FieldRow
                label="E-mails de notificação"
                error={errors.emails}
                description={!errors.emails ? "Separe múltiplos e-mails por vírgula" : undefined}
              >
                <Textarea
                  value={draft.notificationEmails}
                  onChange={v => patch("notificationEmails", v)}
                  placeholder="voce@empresa.com, equipe@empresa.com"
                  rows={2}
                />
              </FieldRow>
            </SectionCard>

            {/* ── 3. Após o envio ──────────────────────────────────────────── */}
            <SectionCard title="Após o envio">
              <div
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: "color-mix(in srgb, var(--primary) 7%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)" }}
              >
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--primary)" }} />
                <div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: "var(--primary)" }}>Configurado no Editor Visual</p>
                  <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    O redirecionamento, mensagem de agradecimento e tela de encerramento são configurados
                    na seção <strong style={{ color: "var(--text-title)" }}>Ending</strong> do Editor Visual.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push(`/formularios/${id}/editor`)}
                    className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium hover:underline"
                    style={{ color: "var(--primary)" }}
                  >
                    Ir para o Editor <ExternalLink size={9} />
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* ── 4. Proteção Anti-Fraude ──────────────────────────────────── */}
            <SectionCard
              title="Proteção Anti-Fraude"
              description="Detecte e bloqueie respostas suspeitas antes de entrar no CRM."
              icon={Shield}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: draft.antiFraudEnabled ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
                    }}
                  >
                    <Shield
                      size={14}
                      style={{ color: draft.antiFraudEnabled ? "#22c55e" : "var(--muted-foreground)" }}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
                      {draft.antiFraudEnabled ? "Proteção ativa" : "Proteção inativa"}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {draft.antiFraudEnabled
                        ? "Respostas suspeitas serão marcadas automaticamente para revisão."
                        : "Habilite para filtrar leads de baixa qualidade e bots automaticamente."}
                    </p>
                  </div>
                </div>
                <Toggle checked={draft.antiFraudEnabled} onChange={v => patch("antiFraudEnabled", v)} />
              </div>

              <button
                type="button"
                onClick={() => toast.info("Lead Scoring estará disponível em breve!")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium self-start transition-colors hover:opacity-80"
                style={{
                  background: "var(--glass-bg-soft)",
                  border:     "1px solid var(--border)",
                  color:      "var(--text-title)",
                }}
              >
                <Shield size={12} />
                Configurar Lead Scoring
              </button>
            </SectionCard>
          </>
        )}
      </div>

      {/* ── Sticky save bar ─────────────────────────────────────────────────── */}
      {draft && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 px-4 sm:px-6 py-3"
          style={{
            background:   "var(--card)",
            borderTop:    "1px solid var(--border)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center gap-2">
            {isDirty
              ? <>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f59e0b" }} />
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Alterações não salvas</span>
                </>
              : <>
                  <CheckCircle2 size={12} style={{ color: "#22c55e" }} />
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Tudo salvo</span>
                </>
            }
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={!isDirty || isSaving}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-30"
              style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "#b0b8c1", color: "#000000" }}
            >
              {isSaving && <Loader2 size={11} className="animate-spin" />}
              {isSaving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </FormularioShell>
  );
}
