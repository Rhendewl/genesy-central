"use client";

import { useState, useMemo } from "react";
import { Save, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IntegrationDefinition, FieldDefinition } from "@/lib/integrations/catalog";
import { ALL_FORM_EVENTS } from "@/lib/integrations/catalog";
import type { FormIntegrationRow } from "@/hooks/useFormularioIntegracoes";

const MASK = "__masked__";

function MaskedInput({
  field,
  value,
  onChange,
}: {
  field:    FieldDefinition;
  value:    string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const isMasked = value === MASK;

  return (
    <div className="relative">
      <input
        type={field.type === "password" && !show ? "password" : "text"}
        placeholder={isMasked ? "••••••••  (manter atual)" : field.placeholder}
        value={isMasked ? "" : value}
        onChange={e => onChange(e.target.value || "")}
        className="w-full text-sm rounded-lg px-3 py-2 pr-9 outline-none transition-colors"
        style={{
          background:  "var(--background)",
          border:      "1px solid var(--border)",
          color:       "var(--text-title)",
        }}
      />
      {field.type === "password" && (
        <button
          type="button"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
          onClick={() => setShow(s => !s)}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field:    FieldDefinition;
  value:    string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
          {field.label}
          {field.required && <span className="ml-1 text-red-400">*</span>}
        </label>
      </div>
      {field.type === "textarea" ? (
        <textarea
          rows={3}
          placeholder={field.placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
          style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--text-title)" }}
        />
      ) : field.type === "password" ? (
        <MaskedInput field={field} value={value} onChange={onChange} />
      ) : (
        <input
          type={field.type}
          placeholder={field.placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full text-sm rounded-lg px-3 py-2 outline-none"
          style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--text-title)" }}
        />
      )}
      {field.hint && (
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{field.hint}</p>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted-foreground)" }}>
      {children}
    </h4>
  );
}

interface ConfigPanelProps {
  definition: IntegrationDefinition;
  row?:       FormIntegrationRow;
  onSave:     (patch: Partial<FormIntegrationRow>) => Promise<boolean>;
  onCreate:   () => Promise<FormIntegrationRow | null>;
  onDelete:   () => Promise<boolean>;
}

export function ConfigPanel({ definition, row, onSave, onCreate, onDelete }: ConfigPanelProps) {
  const [enabled,      setEnabled]      = useState(row?.enabled ?? true);
  const [settings,     setSettings]     = useState<Record<string, string>>(
    () => Object.fromEntries(definition.settingsSchema.map(f => [f.key, String(row?.settings?.[f.key] ?? "")])),
  );
  const [secrets,      setSecrets]      = useState<Record<string, string>>(
    () => Object.fromEntries(definition.secretsSchema.map(f => [f.key, row?.secrets?.[f.key] ?? ""])),
  );
  const [eventFilter,  setEventFilter]  = useState<string[]>(row?.event_filter ?? []);
  const [maxAttempts,  setMaxAttempts]  = useState(row?.retry_policy?.maxAttempts ?? 3);
  const [rpm,          setRpm]          = useState(row?.rate_limit?.requestsPerMinute ?? 60);
  const [enableRetry,  setEnableRetry]  = useState(!!row?.retry_policy);
  const [enableLimit,  setEnableLimit]  = useState(!!row?.rate_limit);
  const [isSaving,     setIsSaving]     = useState(false);
  const [isDeleting,   setIsDeleting]   = useState(false);

  const toggleEvent = (evt: string) => {
    setEventFilter(prev =>
      prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const patch: Partial<FormIntegrationRow> = {
        enabled,
        settings,
        secrets:      Object.fromEntries(
          Object.entries(secrets).map(([k, v]) => [k, v === "" ? MASK : v])
        ),
        event_filter: eventFilter.length > 0 ? eventFilter : null,
        retry_policy: enableRetry ? { maxAttempts: Number(maxAttempts), initialDelayMs: 1000, maxDelayMs: 30000, backoffFactor: 2, jitter: true, timeoutMs: 10000 } : null,
        rate_limit:   enableLimit ? { requestsPerMinute: Number(rpm) } : null,
      };

      if (!row) {
        const created = await onCreate();
        if (created) await onSave(patch);
      } else {
        await onSave(patch);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!row) return;
    if (!confirm("Remover esta integração? Esta ação não pode ser desfeita.")) return;
    setIsDeleting(true);
    await onDelete();
    setIsDeleting(false);
  };

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Habilitado */}
      <div
        className="flex items-center justify-between rounded-xl p-4"
        style={{ background: "var(--background)", border: "1px solid var(--border)" }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>Habilitado</p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Integrações desabilitadas não recebem eventos
          </p>
        </div>
        <button
          onClick={() => setEnabled(e => !e)}
          className="relative w-11 h-6 rounded-full transition-colors"
          style={{ background: enabled ? "var(--primary)" : "var(--border-card-hover)" }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm"
            style={{ transform: enabled ? "translateX(20px)" : "translateX(0)" }}
          />
        </button>
      </div>

      {/* Configurações do adapter */}
      <div className="space-y-4">
        <SectionTitle>Configuração</SectionTitle>
        {definition.settingsSchema.map(field => (
          <FieldRow
            key={field.key}
            field={field}
            value={settings[field.key] ?? ""}
            onChange={v => setSettings(s => ({ ...s, [field.key]: v }))}
          />
        ))}
      </div>

      {/* Credenciais */}
      {definition.secretsSchema.length > 0 && (
        <div className="space-y-4">
          <SectionTitle>Credenciais</SectionTitle>
          {definition.secretsSchema.map(field => (
            <FieldRow
              key={field.key}
              field={field}
              value={secrets[field.key] ?? ""}
              onChange={v => setSecrets(s => ({ ...s, [field.key]: v }))}
            />
          ))}
        </div>
      )}

      {/* Filtro de eventos */}
      <div className="space-y-3">
        <SectionTitle>Eventos monitorados</SectionTitle>
        <p className="text-xs -mt-1" style={{ color: "var(--muted-foreground)" }}>
          Sem seleção = todos os eventos são enviados
        </p>
        {ALL_FORM_EVENTS.map(evt => (
          <label key={evt} className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={eventFilter.includes(evt)}
              onChange={() => toggleEvent(evt)}
              className="w-3.5 h-3.5 rounded accent-[var(--primary)]"
            />
            <span className="text-sm font-mono" style={{ color: "var(--text-title)" }}>{evt}</span>
          </label>
        ))}
      </div>

      {/* Retry policy */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Política de Retry</SectionTitle>
          <button
            onClick={() => setEnableRetry(r => !r)}
            className="text-xs px-2 py-1 rounded"
            style={{ color: enableRetry ? "var(--primary)" : "var(--muted-foreground)", background: "var(--background)", border: "1px solid var(--border)" }}
          >
            {enableRetry ? "Desativar" : "Ativar"}
          </button>
        </div>
        {enableRetry && (
          <div className="space-y-2">
            <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Tentativas máximas
            </label>
            <input
              type="number"
              min={1} max={10}
              value={maxAttempts as number}
              onChange={e => setMaxAttempts(Number(e.target.value))}
              className="w-24 text-sm rounded-lg px-3 py-2 outline-none"
              style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--text-title)" }}
            />
          </div>
        )}
      </div>

      {/* Rate limit */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Rate Limit</SectionTitle>
          <button
            onClick={() => setEnableLimit(r => !r)}
            className="text-xs px-2 py-1 rounded"
            style={{ color: enableLimit ? "var(--primary)" : "var(--muted-foreground)", background: "var(--background)", border: "1px solid var(--border)" }}
          >
            {enableLimit ? "Desativar" : "Ativar"}
          </button>
        </div>
        {enableLimit && (
          <div className="space-y-2">
            <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Requisições por minuto
            </label>
            <input
              type="number"
              min={1} max={6000}
              value={rpm as number}
              onChange={e => setRpm(Number(e.target.value))}
              className="w-28 text-sm rounded-lg px-3 py-2 outline-none"
              style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--text-title)" }}
            />
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        {row && (
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
            <Trash2 size={13} />
            {isDeleting ? "Removendo…" : "Remover"}
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="ml-auto"
        >
          <Save size={13} />
          {isSaving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
