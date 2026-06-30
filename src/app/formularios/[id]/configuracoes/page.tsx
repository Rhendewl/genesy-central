"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, ExternalLink,
  Shield, Bell, Zap, ChevronDown, Link2, Globe, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { FormularioShell } from "../_components/FormularioShell";
import { ConfigSubNav } from "./_components/ConfigSubNav";
import type { Form, FormStatus, PixelMode, FormMetaPixelConfig, FormWebhookConfig } from "@/types";
import { Switch } from "@/components/ui/Switch";
import { useFormularioIntegracoes } from "@/hooks/useFormularioIntegracoes";

// ── Local types ───────────────────────────────────────────────────────────────

type SlugStatus = "idle" | "checking" | "ok" | "taken" | "invalid";

interface Draft {
  name:               string;
  slug:               string;
  status:             FormStatus;
  notificationEmails: string;
  metaPixel:          FormMetaPixelConfig;
  webhook:            FormWebhookConfig;
  antiFraudEnabled:   boolean;
}

interface Errors {
  name?: string;
  slug?: string;
  pixelId?: string;
  webhookUrl?: string;
  emails?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Default event set for Meta Pixel integrations. Stored in form_integrations.event_filter
// when first creating a record. Preserves the value already in the DB on subsequent saves,
// allowing per-form customization without a UI change.
const META_PIXEL_DEFAULT_EVENTS: string[] = [
  "form.started",
  "form.step.completed",
  "form.completed",
  "form.submission.succeeded",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const PIXEL_MODE_OPTIONS: { value: PixelMode; label: string }[] = [
  { value: "browser", label: "Browser (fbq)"               },
  { value: "capi",    label: "Conversions API"              },
  { value: "both",    label: "Browser + Conversions API"    },
];

function normalizeSlug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isValidPixelId(v: string): boolean {
  return /^\d{10,20}$/.test(v.trim());
}

function isValidUrl(v: string): boolean {
  try { new URL(v); return v.startsWith("https://"); } catch { return false; }
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function toDraft(form: Form): Draft {
  const mp = form.integrations?.metaPixel;
  const wh = form.integrations?.webhook;
  const st = form.settings ?? {};
  return {
    name:               form.name,
    slug:               form.slug,
    status:             form.status,
    notificationEmails: (st.notificationEmails ?? []).join(", "),
    metaPixel: {
      enabled:       mp?.enabled       ?? false,
      pixelId:       mp?.pixelId       ?? "",
      event:         mp?.event         ?? "Lead",
      mode:          mp?.mode          ?? "browser",
      accessToken:   "",               // synced from form_integrations.secrets after load
      testEventCode: mp?.testEventCode ?? "",
    },
    webhook: {
      enabled: wh?.enabled ?? false,
      url:     wh?.url     ?? "",
      secret:  wh?.secret  ?? "",
    },
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
          <div className="mt-0.5 p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }}>
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
          background:    "rgba(255,255,255,0.04)",
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
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-title)" }}
    />
  );
}

function SelectField<T extends string>({
  value, onChange, options, disabled,
}: {
  value: T; onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        disabled={disabled}
        className="w-full appearance-none rounded-lg px-3 py-2 text-sm outline-none pr-8 disabled:opacity-50"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-title)" }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: "#17172a" }}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted-foreground)" }} />
    </div>
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

  // Integration configs (Meta Pixel access_token lives here)
  const { integrations, reload: reloadIntegrations } = useFormularioIntegracoes(id);

  // Slug availability check
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Password visibility
  const [showToken,  setShowToken]  = useState(false);
  const [showSecret, setShowSecret] = useState(false);

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

  // ── Sync accessToken from form_integrations into draft ─────────────────────

  useEffect(() => {
    const mp = integrations.find(i => i.adapter === "meta-pixel");
    if (!mp) return;
    const token = mp.secrets?.access_token ? "__masked__" : "";
    setDraft(prev => prev ? { ...prev, metaPixel: { ...prev.metaPixel, accessToken: token } } : prev);
    setSaved(prev => prev ? { ...prev, metaPixel: { ...prev.metaPixel, accessToken: token } } : prev);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrations]);

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

  const patchPixel = useCallback(<K extends keyof FormMetaPixelConfig>(key: K, value: FormMetaPixelConfig[K]) => {
    setDraft(prev => prev
      ? { ...prev, metaPixel: { ...prev.metaPixel, [key]: value } }
      : prev
    );
    if (key === "pixelId") setErrors(prev => ({ ...prev, pixelId: undefined }));
  }, []);

  const patchWebhook = useCallback(<K extends keyof FormWebhookConfig>(key: K, value: FormWebhookConfig[K]) => {
    setDraft(prev => prev
      ? { ...prev, webhook: { ...prev.webhook, [key]: value } }
      : prev
    );
    if (key === "url") setErrors(prev => ({ ...prev, webhookUrl: undefined }));
  }, []);

  // ── Validate ────────────────────────────────────────────────────────────────

  function validate(d: Draft): Errors {
    const e: Errors = {};
    if (!d.name.trim()) e.name = "Nome é obrigatório";
    if (!d.slug.trim() || d.slug.length < 3) e.slug = "Slug deve ter pelo menos 3 caracteres";
    if (slugStatus === "taken")   e.slug = "Este slug já está em uso";
    if (slugStatus === "invalid") e.slug = "Slug inválido (use apenas letras, números e hífens)";
    if (slugStatus === "checking") e.slug = "Aguarde a verificação do slug";
    if (d.metaPixel.enabled && !isValidPixelId(d.metaPixel.pixelId)) {
      e.pixelId = "Pixel ID deve ter entre 10 e 20 dígitos";
    }
    if (d.webhook.enabled && d.webhook.url && !isValidUrl(d.webhook.url)) {
      e.webhookUrl = "URL inválida (deve começar com https://)";
    }
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
      // ── 1. Upsert Meta Pixel config into form_integrations (secrets live here) ─
      const mpInteg = integrations.find(i => i.adapter === "meta-pixel");
      const mpSettings = {
        pixel_id:        draft.metaPixel.pixelId,
        mode:            draft.metaPixel.mode,
        event:           draft.metaPixel.event,
        test_event_code: draft.metaPixel.testEventCode,
      };
      const mpSecrets  = draft.metaPixel.accessToken
        ? { access_token: draft.metaPixel.accessToken }
        : {};

      if (mpInteg) {
        await fetch(`/api/formularios/${id}/integracoes/${mpInteg.id}`, {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            enabled:      draft.metaPixel.enabled,
            settings:     mpSettings,
            secrets:      mpSecrets,
            // Preserve any custom event_filter already in the DB; fall back to default
            event_filter: mpInteg.event_filter ?? META_PIXEL_DEFAULT_EVENTS,
          }),
        });
      } else if (draft.metaPixel.pixelId || draft.metaPixel.enabled) {
        // Only create when user has provided at least a pixel ID
        await fetch(`/api/formularios/${id}/integracoes`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            adapter:      "meta-pixel",
            enabled:      draft.metaPixel.enabled,
            settings:     mpSettings,
            secrets:      mpSecrets,
            event_filter: META_PIXEL_DEFAULT_EVENTS,
          }),
        });
      }

      // ── 2. Save form settings (without accessToken — it lives in form_integrations) ─
      const { accessToken: _removed, ...metaPixelWithoutToken } = draft.metaPixel;
      void _removed;
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
        integrations: {
          ...form.integrations,
          metaPixel: metaPixelWithoutToken,
          webhook:   draft.webhook,
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
      // Preserve the token state (integrations are reloaded separately)
      const curToken  = draft.metaPixel.accessToken;
      newDraft.metaPixel.accessToken = curToken;

      setForm(updated);
      setDraft(newDraft);
      setSaved(newDraft);
      setSlugStatus("idle");
      reloadIntegrations();
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

            {/* ── 2. Meta Pixel ────────────────────────────────────────────── */}
            <SectionCard
              title="Meta Pixel"
              description="Rastreie conversões e otimize suas campanhas de anúncios."
              icon={Zap}
            >
              <SwitchRow
                label="Habilitar Meta Pixel"
                checked={draft.metaPixel.enabled}
                onChange={v => patchPixel("enabled", v)}
              />

              {draft.metaPixel.enabled && (
                <>
                  <Divider />

                  <FieldRow label="Pixel ID" required error={errors.pixelId} description="O ID numérico do seu pixel (15–16 dígitos)">
                    <TextInput
                      value={draft.metaPixel.pixelId}
                      onChange={v => patchPixel("pixelId", v.replace(/\D/g, ""))}
                      placeholder="123456789012345"
                      hasError={!!errors.pixelId}
                    />
                  </FieldRow>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldRow label="Evento no envio">
                      <TextInput
                        value={draft.metaPixel.event}
                        onChange={v => patchPixel("event", v)}
                        placeholder="Lead"
                      />
                    </FieldRow>

                    <FieldRow label="Modo do evento">
                      <SelectField<PixelMode>
                        value={draft.metaPixel.mode}
                        onChange={v => patchPixel("mode", v)}
                        options={PIXEL_MODE_OPTIONS}
                      />
                    </FieldRow>
                  </div>

                  {(draft.metaPixel.mode === "capi" || draft.metaPixel.mode === "both") && (
                    <FieldRow
                      label="Access Token (Conversions API)"
                      description="Token de acesso da sua conta de anúncios. Nunca compartilhe publicamente."
                    >
                      <TextInput
                        value={draft.metaPixel.accessToken}
                        onChange={v => patchPixel("accessToken", v)}
                        placeholder="EAAxxxxxxxxxxxxxxxx"
                        type={showToken ? "text" : "password"}
                        suffix={
                          <button
                            type="button"
                            onClick={() => setShowToken(s => !s)}
                            className="p-0.5 hover:opacity-70 transition-opacity"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        }
                      />
                    </FieldRow>
                  )}

                  <FieldRow label="Test Event Code" description="Opcional. Use para validar eventos no Event Manager do Meta.">
                    <TextInput
                      value={draft.metaPixel.testEventCode}
                      onChange={v => patchPixel("testEventCode", v)}
                      placeholder="TEST12345"
                    />
                  </FieldRow>
                </>
              )}
            </SectionCard>

            {/* ── 3. Webhook ───────────────────────────────────────────────── */}
            <SectionCard
              title="Webhook"
              description="Receba notificações HTTP em tempo real a cada nova resposta."
              icon={Globe}
            >
              <SwitchRow
                label="Habilitar Webhook"
                checked={draft.webhook.enabled}
                onChange={v => patchWebhook("enabled", v)}
              />

              {draft.webhook.enabled && (
                <>
                  <Divider />

                  <FieldRow label="URL do Webhook" required error={errors.webhookUrl} description="Endpoint HTTPS que receberá os dados via POST">
                    <TextInput
                      value={draft.webhook.url}
                      onChange={v => patchWebhook("url", v)}
                      placeholder="https://sua-api.com/webhook"
                      hasError={!!errors.webhookUrl}
                    />
                  </FieldRow>

                  <FieldRow label="Secret" description="Opcional. Enviado no header X-Webhook-Secret para validar a origem.">
                    <TextInput
                      value={draft.webhook.secret}
                      onChange={v => patchWebhook("secret", v)}
                      placeholder="meu-secret-seguro"
                      type={showSecret ? "text" : "password"}
                      suffix={
                        <button
                          type="button"
                          onClick={() => setShowSecret(s => !s)}
                          className="p-0.5 hover:opacity-70 transition-opacity"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      }
                    />
                  </FieldRow>

                  <div
                    className="flex items-center justify-between py-2 px-3 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                  >
                    <div>
                      <p className="text-xs font-medium" style={{ color: "var(--text-title)" }}>Método</p>
                      <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>POST — JSON com todos os dados da resposta</p>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold"
                      style={{ background: "rgba(102,174,214,0.12)", color: "#66aed6" }}
                    >
                      POST
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium self-start opacity-40"
                    style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
                    title="Em breve"
                  >
                    Testar Webhook
                  </button>
                </>
              )}
            </SectionCard>

            {/* ── 4. Notificações ──────────────────────────────────────────── */}
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

            {/* ── 5. Após o envio ──────────────────────────────────────────── */}
            <SectionCard title="Após o envio">
              <div
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: "rgba(102,174,214,0.07)", border: "1px solid rgba(102,174,214,0.15)" }}
              >
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#66aed6" }} />
                <div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: "#66aed6" }}>Configurado no Editor Visual</p>
                  <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    O redirecionamento, mensagem de agradecimento e tela de encerramento são configurados
                    na seção <strong style={{ color: "var(--text-title)" }}>Ending</strong> do Editor Visual.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push(`/formularios/${id}/editor`)}
                    className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium hover:underline"
                    style={{ color: "#66aed6" }}
                  >
                    Ir para o Editor <ExternalLink size={9} />
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* ── 6. Proteção Anti-Fraude ──────────────────────────────────── */}
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
                  background: "rgba(255,255,255,0.06)",
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
              style={{ background: "var(--primary)", color: "#fff" }}
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
