"use client";

import { ChevronLeft, Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  CrmConversionSource,
  NewCrmConversionSource,
  UpdateCrmConversionSource,
} from "@/types/crm";

const MASKED = "__masked__";

const INPUT_STYLE = {
  background: "rgba(255,255,255,0.04)",
  border:     "1px solid var(--border)",
  color:      "var(--text-title)",
} as const;

// ── Form ──────────────────────────────────────────────────────────────────────

interface FormState {
  name:            string;
  description:     string;
  pixel_id:        string;
  access_token:    string;
  test_event_code: string;
  is_default:      boolean;
  is_active:       boolean;
}

const EMPTY_FORM: FormState = {
  name:            "",
  description:     "",
  pixel_id:        "",
  access_token:    "",
  test_event_code: "",
  is_default:      false,
  is_active:       true,
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="relative flex-shrink-0 w-9 h-5 rounded-full transition-colors"
      style={{ background: checked ? "var(--primary)" : "rgba(255,255,255,0.12)" }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
        style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
      />
    </button>
  );
}

interface FormProps {
  source:  CrmConversionSource | "new";
  onBack:  () => void;
  onSave:  (form: FormState, isNew: boolean) => Promise<boolean>;
}

function SourceForm({ source, onBack, onSave }: FormProps) {
  const isNew = source === "new";
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [showToken, setShowToken] = useState(false);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (!isNew) {
      setForm({
        name:            source.name,
        description:     source.description ?? "",
        pixel_id:        source.pixel_id,
        access_token:    "",
        test_event_code: source.test_event_code ?? "",
        is_default:      source.is_default,
        is_active:       source.is_active,
      });
    }
  }, [isNew, source]);

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const canSubmit =
    form.name.trim().length > 0 &&
    form.pixel_id.trim().length > 0 &&
    (isNew ? form.access_token.trim().length > 0 : true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    const ok = await onSave(form, isNew);
    setSaving(false);
    if (ok) onBack();
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-medium hover:opacity-70 transition-opacity"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ChevronLeft size={13} />
          Voltar
        </button>
        <span className="text-xs font-semibold" style={{ color: "var(--text-title)" }}>
          {isNew ? "Nova Origem" : "Editar Origem"}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5 overflow-y-auto">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-title)" }}>
            Nome <span style={{ color: "var(--primary)" }}>*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => patch("name", e.target.value)}
            placeholder="Ex: Pixel SDR"
            maxLength={80}
            required
            autoFocus
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={INPUT_STYLE}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-title)" }}>
            Descrição
          </label>
          <input
            type="text"
            value={form.description}
            onChange={e => patch("description", e.target.value)}
            placeholder="Descrição opcional…"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={INPUT_STYLE}
          />
        </div>

        {/* Pixel ID */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-title)" }}>
            Pixel ID <span style={{ color: "var(--primary)" }}>*</span>
          </label>
          <input
            type="text"
            value={form.pixel_id}
            onChange={e => patch("pixel_id", e.target.value)}
            placeholder="123456789012345"
            required
            className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono"
            style={INPUT_STYLE}
          />
        </div>

        {/* Access Token */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-title)" }}>
            Access Token {isNew && <span style={{ color: "var(--primary)" }}>*</span>}
          </label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={form.access_token}
              onChange={e => patch("access_token", e.target.value)}
              placeholder={isNew ? "EAAxxxxxxxxxxxxx…" : "Deixe em branco para manter o token atual"}
              required={isNew}
              className="w-full rounded-lg px-3 py-2 pr-10 text-sm outline-none font-mono"
              style={INPUT_STYLE}
            />
            <button
              type="button"
              onClick={() => setShowToken(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
              style={{ color: "var(--muted-foreground)" }}
            >
              {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          {!isNew && (
            <p className="text-[11px] mt-1" style={{ color: "var(--muted-foreground)" }}>
              Token já configurado. Preencha apenas para substituir.
            </p>
          )}
        </div>

        {/* Test Event Code */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-title)" }}>
            Test Event Code
            <span className="ml-1.5 text-[10px] font-normal" style={{ color: "var(--muted-foreground)" }}>
              (opcional)
            </span>
          </label>
          <input
            type="text"
            value={form.test_event_code}
            onChange={e => patch("test_event_code", e.target.value)}
            placeholder="TEST12345"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono"
            style={INPUT_STYLE}
          />
        </div>

        {/* Toggles */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-title)" }}>Origem padrão</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                Usada automaticamente ao configurar novas etapas
              </p>
            </div>
            <Toggle checked={form.is_default} onChange={() => patch("is_default", !form.is_default)} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-title)" }}>Ativa</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                Origens inativas não são utilizadas pelo Conversion Engine
              </p>
            </div>
            <Toggle checked={form.is_active} onChange={() => patch("is_active", !form.is_active)} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            {saving && <Loader2 size={11} className="animate-spin" />}
            {saving ? "Salvando…" : isNew ? "Criar Origem" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── OrigensTab ─────────────────────────────────────────────────────────────────

interface Props {
  pipelineId: string;
  sources:    CrmConversionSource[];
  onCreate:   (data: NewCrmConversionSource) => Promise<boolean>;
  onUpdate:   (id: string, data: UpdateCrmConversionSource) => Promise<boolean>;
  onDelete:   (id: string) => Promise<boolean>;
}

export function OrigensTab({ pipelineId, sources, onCreate, onUpdate, onDelete }: Props) {
  const [editing,    setEditing]    = useState<CrmConversionSource | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSave(form: FormState, isNew: boolean): Promise<boolean> {
    if (isNew) {
      return onCreate({
        pipeline_id:     pipelineId,
        name:            form.name.trim(),
        description:     form.description.trim() || null,
        provider:        "meta_pixel",
        pixel_id:        form.pixel_id.trim(),
        access_token:    form.access_token.trim(),
        test_event_code: form.test_event_code.trim() || null,
        is_default:      form.is_default,
        is_active:       form.is_active,
      });
    }

    if (!editing || editing === "new") return false;
    const update: UpdateCrmConversionSource = {
      name:            form.name.trim(),
      description:     form.description.trim() || null,
      pixel_id:        form.pixel_id.trim(),
      test_event_code: form.test_event_code.trim() || null,
      is_default:      form.is_default,
      is_active:       form.is_active,
    };
    if (form.access_token.trim()) {
      update.access_token = form.access_token.trim();
    } else {
      update.access_token = MASKED;
    }
    return onUpdate(editing.id, update);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  }

  if (editing !== null) {
    return (
      <SourceForm
        source={editing}
        onBack={() => setEditing(null)}
        onSave={handleSave}
      />
    );
  }

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {sources.length === 0
            ? "Nenhuma origem configurada"
            : `${sources.length} origem${sources.length !== 1 ? "s" : ""}`}
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          <Plus size={12} />
          Nova Origem
        </button>
      </div>

      {/* Empty state */}
      {sources.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-14 px-5 text-center">
          <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>
            Sem origens configuradas
          </p>
          <p className="text-xs max-w-xs" style={{ color: "var(--muted-foreground)" }}>
            Configure uma origem para começar a rastrear conversões por etapa.
          </p>
        </div>
      ) : (
        <div>
          {sources.map(source => (
            <div
              key={source.id}
              className="flex items-center gap-3 px-5 py-3.5 group"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              {/* Status dot */}
              <span
                className="w-2 h-2 flex-shrink-0 rounded-full"
                style={{ background: source.is_active ? "#22c55e" : "rgba(255,255,255,0.2)" }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text-title)" }}>
                    {source.name}
                  </p>
                  {source.is_default && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}
                    >
                      padrão
                    </span>
                  )}
                  {!source.is_active && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}
                    >
                      inativa
                    </span>
                  )}
                </div>
                <p className="text-[11px] mt-0.5 font-mono truncate" style={{ color: "var(--muted-foreground)" }}>
                  {source.pixel_id.length > 12 ? source.pixel_id.slice(0, 12) + "…" : source.pixel_id}
                  {source.description && (
                    <span className="font-sans ml-2">{source.description}</span>
                  )}
                </p>
              </div>

              {/* Provider badge */}
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}
              >
                Meta Pixel
              </span>

              {/* Actions */}
              <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => setEditing(source)}
                  title="Editar"
                  className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(source.id)}
                  disabled={deletingId === source.id}
                  title="Remover"
                  className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
                  style={{ color: "#ef4444" }}
                >
                  {deletingId === source.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Trash2 size={12} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
