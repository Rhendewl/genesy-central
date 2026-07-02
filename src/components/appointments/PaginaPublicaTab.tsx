"use client";

import { useState, useEffect } from "react";
import {
  Plus, Trash2, Loader2, GripVertical, ExternalLink,
  ChevronDown, ChevronUp,
} from "lucide-react";
import type {
  AppointmentCalendar,
  UpdateAppointmentCalendar,
  AppointmentCalendarSettings,
  AppointmentCustomField,
  AppointmentCustomFieldType,
  StandardFieldVisibility,
} from "@/types/appointments";

// ── Styles ────────────────────────────────────────────────────────────────────

const inputCls   = "w-full px-3 py-2 rounded-xl text-sm outline-none";
const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border:     "1px solid var(--border)",
  color:      "var(--text-title)",
};
const labelCls   = "block text-xs mb-1.5 font-medium";
const labelStyle = { color: "var(--muted-foreground)" };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className={labelCls} style={labelStyle}>{children}</label>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3"
      style={{ color: "var(--muted-foreground)", letterSpacing: "0.08em" }}>
      {children}
    </h3>
  );
}

function Section({
  title, children, defaultOpen = true,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)", letterSpacing: "0.08em" }}>
          {title}
        </span>
        {open ? <ChevronUp size={13} style={{ color: "var(--muted-foreground)" }} /> : <ChevronDown size={13} style={{ color: "var(--muted-foreground)" }} />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

// ── Standard field visibility selector ───────────────────────────────────────

const VISIBILITY_OPTIONS: { value: StandardFieldVisibility; label: string }[] = [
  { value: "required", label: "Obrigatório" },
  { value: "optional", label: "Opcional"   },
  { value: "hidden",   label: "Oculto"     },
];

function VisibilitySelect({
  label, value, onChange,
}: { label: string; value: StandardFieldVisibility; onChange: (v: StandardFieldVisibility) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm" style={{ color: "var(--text-title)" }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as StandardFieldVisibility)}
        className="px-2 py-1.5 rounded-lg text-xs outline-none"
        style={{ ...inputStyle, width: "auto" }}
      >
        {VISIBILITY_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Custom field types ────────────────────────────────────────────────────────

const FIELD_TYPES: { value: AppointmentCustomFieldType; label: string }[] = [
  { value: "text",        label: "Texto" },
  { value: "number",      label: "Número" },
  { value: "email",       label: "E-mail" },
  { value: "phone",       label: "Telefone" },
  { value: "url",         label: "URL" },
  { value: "date",        label: "Data" },
  { value: "time",        label: "Hora" },
  { value: "select",      label: "Seleção" },
  { value: "multiselect", label: "Multi-seleção" },
  { value: "checkbox",    label: "Checkbox" },
  { value: "radio",       label: "Radio" },
  { value: "textarea",    label: "Texto longo" },
];

const HAS_OPTIONS: AppointmentCustomFieldType[] = ["select", "multiselect", "checkbox", "radio"];

// ── Custom field editor (modal-in-place) ──────────────────────────────────────

function FieldEditor({
  field, onSave, onCancel,
}: {
  field:    Partial<AppointmentCustomField>;
  onSave:   (f: AppointmentCustomField) => void;
  onCancel: () => void;
}) {
  const [label,       setLabel]       = useState(field.label ?? "");
  const [type,        setType]        = useState<AppointmentCustomFieldType>(field.type ?? "text");
  const [required,    setRequired]    = useState(field.required ?? false);
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? "");
  const [help,        setHelp]        = useState(field.help ?? "");
  const [optionsRaw,  setOptionsRaw]  = useState((field.options ?? []).join("\n"));

  const showOptions = HAS_OPTIONS.includes(type);

  const save = () => {
    if (!label.trim()) return;
    onSave({
      id:          field.id ?? crypto.randomUUID(),
      label:       label.trim(),
      type,
      required,
      placeholder: placeholder.trim() || undefined,
      help:        help.trim() || undefined,
      order:       field.order ?? 0,
      options:     showOptions
        ? optionsRaw.split("\n").map(s => s.trim()).filter(Boolean)
        : undefined,
    });
  };

  return (
    <div className="p-4 rounded-xl space-y-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Nome do campo *</FieldLabel>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Ex: Mensagem"
            className={inputCls}
            style={inputStyle}
            autoFocus
          />
        </div>
        <div>
          <FieldLabel>Tipo</FieldLabel>
          <select value={type} onChange={e => setType(e.target.value as AppointmentCustomFieldType)} className={inputCls} style={inputStyle}>
            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <FieldLabel>Placeholder</FieldLabel>
        <input type="text" value={placeholder} onChange={e => setPlaceholder(e.target.value)} className={inputCls} style={inputStyle} />
      </div>

      <div>
        <FieldLabel>Texto de ajuda</FieldLabel>
        <input type="text" value={help} onChange={e => setHelp(e.target.value)} placeholder="Exibido abaixo do campo" className={inputCls} style={inputStyle} />
      </div>

      {showOptions && (
        <div>
          <FieldLabel>Opções (uma por linha)</FieldLabel>
          <textarea
            value={optionsRaw}
            onChange={e => setOptionsRaw(e.target.value)}
            placeholder={"Opção 1\nOpção 2\nOpção 3"}
            rows={4}
            className={`${inputCls} resize-none`}
            style={inputStyle}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "var(--text-title)" }}>
          <input
            type="checkbox"
            checked={required}
            onChange={e => setRequired(e.target.checked)}
            style={{ accentColor: "var(--primary)" }}
          />
          Obrigatório
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: "var(--muted-foreground)" }}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!label.trim()}
          className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          Salvar campo
        </button>
      </div>
    </div>
  );
}

// ── Defaults ──────────────────────────────────────────────────────────────────

function defaultSettings(current: AppointmentCalendarSettings): AppointmentCalendarSettings {
  return {
    page: {
      title:           current.page?.title           ?? null,
      subtitle:        current.page?.subtitle        ?? null,
      welcome_message: current.page?.welcome_message ?? null,
      cover_image_url: current.page?.cover_image_url ?? null,
      logo_url:        current.page?.logo_url        ?? null,
      brand_color:     current.page?.brand_color     ?? "#6366f1",
    },
    form: {
      standard_fields: {
        phone:   current.form?.standard_fields?.phone   ?? "optional",
        company: current.form?.standard_fields?.company ?? "hidden",
        role:    current.form?.standard_fields?.role    ?? "hidden",
        city:    current.form?.standard_fields?.city    ?? "hidden",
        notes:   current.form?.standard_fields?.notes   ?? "optional",
      },
    },
    success: {
      title:        current.success?.title        ?? "Agendamento confirmado!",
      message:      current.success?.message      ?? "Em breve você receberá os detalhes por e-mail.",
      button_label: current.success?.button_label ?? null,
      redirect_url: current.success?.redirect_url ?? null,
    },
    lgpd: {
      enabled: current.lgpd?.enabled ?? false,
      title:   current.lgpd?.title   ?? "Política de Privacidade",
      text:    current.lgpd?.text    ?? "",
      link:    current.lgpd?.link    ?? null,
    },
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PaginaPublicaTabProps {
  calendar: AppointmentCalendar;
  onSave:   (payload: UpdateAppointmentCalendar) => Promise<boolean>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PaginaPublicaTab({ calendar, onSave }: PaginaPublicaTabProps) {
  const [settings, setSettings] = useState<AppointmentCalendarSettings>(
    () => defaultSettings(calendar.settings ?? {}),
  );
  const [customFields, setCustomFields] = useState<AppointmentCustomField[]>(
    () => [...(calendar.custom_fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );
  const [editingField, setEditingField] = useState<Partial<AppointmentCustomField> | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingField,  setAddingField]  = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);

  useEffect(() => {
    setSettings(defaultSettings(calendar.settings ?? {}));
    setCustomFields([...(calendar.custom_fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  }, [calendar]);

  const setPage    = (patch: Partial<NonNullable<AppointmentCalendarSettings["page"]>>) =>
    setSettings(s => ({ ...s, page: { ...s.page!, ...patch } }));
  const setForm    = (patch: Partial<NonNullable<AppointmentCalendarSettings["form"]>>) =>
    setSettings(s => ({ ...s, form: { ...s.form!, ...patch } }));
  const setSuccess = (patch: Partial<NonNullable<AppointmentCalendarSettings["success"]>>) =>
    setSettings(s => ({ ...s, success: { ...s.success!, ...patch } }));
  const setLgpd    = (patch: Partial<NonNullable<AppointmentCalendarSettings["lgpd"]>>) =>
    setSettings(s => ({ ...s, lgpd: { ...s.lgpd!, ...patch } }));

  const setStdField = (key: keyof NonNullable<AppointmentCalendarSettings["form"]>["standard_fields"], v: StandardFieldVisibility) =>
    setForm({ standard_fields: { ...settings.form!.standard_fields, [key]: v } });

  const saveField = (field: AppointmentCustomField) => {
    setCustomFields(prev => {
      if (editingIndex !== null) {
        const next = [...prev];
        next[editingIndex] = { ...field, order: editingIndex };
        return next;
      }
      return [...prev, { ...field, order: prev.length }];
    });
    setEditingField(null);
    setEditingIndex(null);
    setAddingField(false);
  };

  const removeField = (idx: number) => {
    setCustomFields(prev => prev.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i })));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave({
      settings:      settings,
      custom_fields: customFields.map((f, i) => ({ ...f, order: i })),
    });
    setIsSaving(false);
  };

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/agendar/${calendar.slug}`;

  return (
    <div className="space-y-4 max-w-xl pb-8">
      {/* Preview link */}
      <div
        className="flex items-center justify-between p-3 rounded-xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
      >
        <div>
          <p className="text-xs font-medium" style={{ color: "var(--text-title)" }}>URL pública</p>
          <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: "var(--muted-foreground)" }}>
            /agendar/{calendar.slug}
          </p>
        </div>
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-70"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          <ExternalLink size={11} />
          Abrir
        </a>
      </div>

      {/* ── Aparência ──────────────────────────────────────────────────────── */}
      <Section title="Aparência">
        <div>
          <FieldLabel>Cor principal</FieldLabel>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.page?.brand_color ?? "#6366f1"}
              onChange={e => setPage({ brand_color: e.target.value })}
              className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
            />
            <input
              type="text"
              value={settings.page?.brand_color ?? "#6366f1"}
              onChange={e => setPage({ brand_color: e.target.value })}
              placeholder="#6366f1"
              className="flex-1 px-3 py-2 rounded-xl text-sm outline-none font-mono"
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <FieldLabel>URL da imagem de capa</FieldLabel>
          <input type="url" value={settings.page?.cover_image_url ?? ""} onChange={e => setPage({ cover_image_url: e.target.value || null })} placeholder="https://..." className={inputCls} style={inputStyle} />
        </div>

        <div>
          <FieldLabel>URL do logo</FieldLabel>
          <input type="url" value={settings.page?.logo_url ?? ""} onChange={e => setPage({ logo_url: e.target.value || null })} placeholder="https://..." className={inputCls} style={inputStyle} />
        </div>
      </Section>

      {/* ── Conteúdo ────────────────────────────────────────────────────────── */}
      <Section title="Conteúdo">
        <div>
          <FieldLabel>Título público</FieldLabel>
          <input
            type="text"
            value={settings.page?.title ?? ""}
            onChange={e => setPage({ title: e.target.value || null })}
            placeholder={`Padrão: "${calendar.name}"`}
            className={inputCls}
            style={inputStyle}
          />
        </div>

        <div>
          <FieldLabel>Subtítulo</FieldLabel>
          <input
            type="text"
            value={settings.page?.subtitle ?? ""}
            onChange={e => setPage({ subtitle: e.target.value || null })}
            placeholder="Frase de apoio exibida abaixo do título"
            className={inputCls}
            style={inputStyle}
          />
        </div>

        <div>
          <FieldLabel>Mensagem de boas-vindas</FieldLabel>
          <textarea
            value={settings.page?.welcome_message ?? ""}
            onChange={e => setPage({ welcome_message: e.target.value || null })}
            placeholder="Texto exibido abaixo das informações do evento"
            rows={3}
            className={`${inputCls} resize-none`}
            style={inputStyle}
          />
        </div>
      </Section>

      {/* ── Formulário ──────────────────────────────────────────────────────── */}
      <Section title="Campos do formulário">
        <div>
          <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
            Nome e e-mail são sempre obrigatórios.
          </p>
          <div className="space-y-2.5">
            <VisibilitySelect label="Telefone"  value={settings.form!.standard_fields.phone}   onChange={v => setStdField("phone",   v)} />
            <VisibilitySelect label="Empresa"   value={settings.form!.standard_fields.company} onChange={v => setStdField("company", v)} />
            <VisibilitySelect label="Cargo"     value={settings.form!.standard_fields.role}    onChange={v => setStdField("role",    v)} />
            <VisibilitySelect label="Cidade"    value={settings.form!.standard_fields.city}    onChange={v => setStdField("city",    v)} />
            <VisibilitySelect label="Observações" value={settings.form!.standard_fields.notes} onChange={v => setStdField("notes",   v)} />
          </div>
        </div>

        {/* Custom fields list */}
        <div>
          <SectionTitle>Campos personalizados</SectionTitle>

          <div className="space-y-2 mb-3">
            {customFields.map((field, idx) => (
              <div key={field.id}>
                {editingIndex === idx ? (
                  <FieldEditor
                    field={field}
                    onSave={saveField}
                    onCancel={() => { setEditingField(null); setEditingIndex(null); }}
                  />
                ) : (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                  >
                    <GripVertical size={12} style={{ color: "var(--muted-foreground)" }} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm" style={{ color: "var(--text-title)" }}>{field.label}</span>
                      <span className="ml-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {FIELD_TYPES.find(t => t.value === field.type)?.label}
                        {field.required ? " · Obrigatório" : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setEditingField(field); setEditingIndex(idx); setAddingField(false); }}
                      className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-70"
                      style={{ color: "var(--primary)" }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => removeField(idx)}
                      className="p-1.5 rounded hover:bg-white/10"
                    >
                      <Trash2 size={12} style={{ color: "var(--muted-foreground)" }} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {addingField ? (
            <FieldEditor
              field={{ order: customFields.length }}
              onSave={saveField}
              onCancel={() => setAddingField(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => { setAddingField(true); setEditingIndex(null); setEditingField(null); }}
              className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
              style={{ color: "var(--primary)" }}
            >
              <Plus size={13} />
              Adicionar campo
            </button>
          )}
        </div>
      </Section>

      {/* ── LGPD ────────────────────────────────────────────────────────────── */}
      <Section title="LGPD" defaultOpen={false}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.lgpd?.enabled ?? false}
            onChange={e => setLgpd({ enabled: e.target.checked })}
            style={{ accentColor: "var(--primary)" }}
          />
          <span className="text-sm" style={{ color: "var(--text-title)" }}>
            Exigir aceite dos termos
          </span>
        </label>

        {settings.lgpd?.enabled && (
          <>
            <div>
              <FieldLabel>Título do termo</FieldLabel>
              <input type="text" value={settings.lgpd?.title ?? ""} onChange={e => setLgpd({ title: e.target.value })} placeholder="Política de Privacidade" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <FieldLabel>Texto do checkbox</FieldLabel>
              <input type="text" value={settings.lgpd?.text ?? ""} onChange={e => setLgpd({ text: e.target.value })} placeholder="Li e aceito a" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <FieldLabel>Link da política</FieldLabel>
              <input type="url" value={settings.lgpd?.link ?? ""} onChange={e => setLgpd({ link: e.target.value || null })} placeholder="https://..." className={inputCls} style={inputStyle} />
            </div>
          </>
        )}
      </Section>

      {/* ── Tela de sucesso ─────────────────────────────────────────────────── */}
      <Section title="Tela de sucesso" defaultOpen={false}>
        <div>
          <FieldLabel>Título</FieldLabel>
          <input type="text" value={settings.success?.title ?? ""} onChange={e => setSuccess({ title: e.target.value })} placeholder="Agendamento confirmado!" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <FieldLabel>Mensagem</FieldLabel>
          <textarea value={settings.success?.message ?? ""} onChange={e => setSuccess({ message: e.target.value })} rows={3} className={`${inputCls} resize-none`} style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Texto do botão</FieldLabel>
            <input type="text" value={settings.success?.button_label ?? ""} onChange={e => setSuccess({ button_label: e.target.value || null })} placeholder="Visitar site" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <FieldLabel>URL de redirecionamento</FieldLabel>
            <input type="url" value={settings.success?.redirect_url ?? ""} onChange={e => setSuccess({ redirect_url: e.target.value || null })} placeholder="https://..." className={inputCls} style={inputStyle} />
          </div>
        </div>
      </Section>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          {isSaving && <Loader2 size={13} className="animate-spin" />}
          Salvar alterações
        </button>
      </div>
    </div>
  );
}
