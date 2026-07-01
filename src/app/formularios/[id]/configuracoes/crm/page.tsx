"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Loader2, CheckCircle2, AlertCircle, Tag, X, ChevronDown, Users, Info,
} from "lucide-react";
import { toast } from "sonner";
import { FormularioShell } from "../../_components/FormularioShell";
import { ConfigSubNav } from "../_components/ConfigSubNav";
import { useFormularioIntegracoes } from "@/hooks/useFormularioIntegracoes";
import { usePipelines } from "@/hooks/usePipelines";
import { useTags } from "@/hooks/useTags";
import { useUsers } from "@/hooks/useUsers";
import type { FormStep, Form } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CrmConfig {
  enabled:        boolean;
  source:         string;
  pipeline_id:    string | null;
  stage_id:       string | null;
  owner_id:       string | null;
  owner_name:     string | null;
  tag_ids:        string[];
  value_mode:     "fixed" | "question";
  fixed_value:    number;
  value_field_id: string | null;
}

const DEFAULT_CONFIG: CrmConfig = {
  enabled:        true,
  source:         "formulario_genesy",
  pipeline_id:    null,
  stage_id:       null,
  owner_id:       null,
  owner_name:     null,
  tag_ids:        [],
  value_mode:     "fixed",
  fixed_value:    0,
  value_field_id: null,
};

// ── CRM Sources ───────────────────────────────────────────────────────────────

const CRM_SOURCES: { id: string; label: string; isDefault?: boolean }[] = [
  { id: "formulario_genesy", label: "Formulário Genesy", isDefault: true },
  { id: "manual",            label: "Manual"                             },
  { id: "meta_lead_ads",     label: "Meta Lead Ads"                      },
  { id: "whatsapp",          label: "WhatsApp"                           },
  { id: "site",              label: "Site"                               },
  { id: "indicacao",         label: "Indicação"                          },
  { id: "email_marketing",   label: "E-mail Marketing"                   },
  { id: "evento",            label: "Evento"                             },
];

const VALUE_STEP_TYPES = new Set<string>(["number", "rating"]);

// ── Primitive components ──────────────────────────────────────────────────────

function SectionCard({
  title, description, icon: Icon, children,
}: {
  title: string; description?: string; icon?: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
      <div className="flex items-start gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        {Icon && (
          <div className="mt-0.5 p-1.5 rounded-lg flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
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

function FieldRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-title)" }}>{label}</label>
      {children}
      {description && <p className="text-[11px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>{description}</p>}
    </div>
  );
}

function SelectField<T extends string>({
  value, onChange, disabled, children,
}: {
  value: T; onChange: (v: T) => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        disabled={disabled}
        className="w-full appearance-none rounded-lg px-3 py-2 text-sm outline-none pr-8 disabled:opacity-40"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-title)" }}
      >
        {children}
      </select>
      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted-foreground)" }} />
    </div>
  );
}

// ── Tag multi-select ──────────────────────────────────────────────────────────

interface TagChip { id: string; name: string; color: string }

function TagMultiSelect({
  available,
  selected,
  onChange,
}: {
  available: TagChip[];
  selected:  string[];
  onChange:  (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedTags = available.filter(t => selected.includes(t.id));
  const remaining    = available.filter(t => !selected.includes(t.id));

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter(x => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Selected chips */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ background: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}44` }}
            >
              {tag.name}
              <button type="button" onClick={() => toggle(tag.id)} className="hover:opacity-70">
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-left w-full transition-colors"
        style={{
          background: "rgba(255,255,255,0.04)",
          border:     "1px solid var(--border)",
          color:      selectedTags.length > 0 ? "var(--muted-foreground)" : "var(--muted-foreground)",
        }}
      >
        <Tag size={11} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
        {selectedTags.length === 0
          ? "Selecionar tags…"
          : `${selectedTags.length} tag${selectedTags.length > 1 ? "s" : ""} selecionada${selectedTags.length > 1 ? "s" : ""}`
        }
        <ChevronDown size={11} className="ml-auto" style={{ color: "var(--muted-foreground)" }} />
      </button>

      {open && (
        <div
          className="rounded-xl overflow-hidden shadow-lg"
          style={{ border: "1px solid var(--border)", background: "var(--card)" }}
        >
          {available.length === 0 ? (
            <p className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
              Nenhuma tag cadastrada no CRM.
            </p>
          ) : (
            <div className="max-h-44 overflow-y-auto">
              {available.map(tag => {
                const isSelected = selected.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggle(tag.id)}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-left transition-colors hover:bg-white/5"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: tag.color }}
                    />
                    <span style={{ color: "var(--text-title)", flex: 1 }}>{tag.name}</span>
                    {isSelected && <CheckCircle2 size={12} style={{ color: "var(--primary)" }} />}
                  </button>
                );
              })}
            </div>
          )}
          <div className="px-4 py-2.5 flex justify-end" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] font-medium px-3 py-1 rounded-lg"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FormularioCrmPage() {
  const { id } = useParams<{ id: string }>();

  const { integrations, isLoading: intLoading, save, create } = useFormularioIntegracoes(id);
  const { pipelines, isLoading: pipelinesLoading } = usePipelines();
  const { tags, isLoading: tagsLoading } = useTags();
  const { profiles, isLoading: usersLoading } = useUsers();

  const activePipelines = pipelines.filter(p => p.is_active);

  const [form,    setForm]    = useState<Form | null>(null);
  const [config,  setConfig]  = useState<CrmConfig>(DEFAULT_CONFIG);
  const [saved,   setSaved]   = useState<CrmConfig>(DEFAULT_CONFIG);
  const [configId, setConfigId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving,  setIsSaving]  = useState(false);

  // ── Load form + existing integration config ─────────────────────────────────

  useEffect(() => {
    fetch(`/api/formularios/${id}`)
      .then(r => r.json())
      .then(json => { if (json.formulario) setForm(json.formulario as Form); })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (intLoading) return;
    setIsLoading(false);
    const crm = integrations.find(i => i.adapter === "crm");
    if (crm) {
      const s = crm.settings as Partial<CrmConfig & { kanban_column?: string }>;
      const loaded: CrmConfig = {
        enabled:        crm.enabled         ?? true,
        source:         s.source            ?? DEFAULT_CONFIG.source,
        pipeline_id:    s.pipeline_id       ?? null,
        stage_id:       s.stage_id          ?? null,
        owner_id:       s.owner_id          ?? null,
        owner_name:     s.owner_name        ?? null,
        tag_ids:        s.tag_ids           ?? [],
        value_mode:     s.value_mode        ?? "fixed",
        fixed_value:    s.fixed_value       ?? 0,
        value_field_id: s.value_field_id    ?? null,
      };
      setConfigId(crm.id);
      setConfig(loaded);
      setSaved(loaded);
    }
  }, [integrations, intLoading]);

  // ── Compatible value steps ─────────────────────────────────────────────────

  const valueSteps = (form?.steps ?? []).filter((s: FormStep) => VALUE_STEP_TYPES.has(s.type));

  // ── Active users ───────────────────────────────────────────────────────────

  const activeUsers = profiles.filter(p => p.is_active);

  // ── Patch helper ───────────────────────────────────────────────────────────

  const patch = useCallback(<K extends keyof CrmConfig>(key: K, value: CrmConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const settings: Record<string, unknown> = {
        source:         config.source,
        pipeline_id:    config.pipeline_id,
        stage_id:       config.stage_id,
        owner_id:       config.owner_id,
        owner_name:     config.owner_name,
        tag_ids:        config.tag_ids,
        value_mode:     config.value_mode,
        fixed_value:    config.fixed_value,
        value_field_id: config.value_field_id,
      };

      if (configId) {
        const ok = await save(configId, { enabled: config.enabled, settings });
        if (ok) { setSaved({ ...config }); toast.success("Integração CRM salva!"); }
      } else {
        const res = await create("crm");
        if (res) {
          const ok = await save(res.id, { enabled: config.enabled, settings });
          if (ok) { setConfigId(res.id); setSaved({ ...config }); toast.success("Integração CRM ativada!"); }
        }
      }
    } catch {
      toast.error("Erro ao salvar integração CRM");
    } finally {
      setIsSaving(false);
    }
  }, [config, configId, save, create]);

  // ── Cancel ─────────────────────────────────────────────────────────────────

  const handleCancel = useCallback(() => setConfig({ ...saved }), [saved]);

  // ── isDirty ────────────────────────────────────────────────────────────────

  const isDirty = JSON.stringify(config) !== JSON.stringify(saved);

  // ── Summary labels ─────────────────────────────────────────────────────────

  const sourceName = CRM_SOURCES.find(s => s.id === config.source)?.label ?? config.source;
  const selectedPipeline = activePipelines.find(p => p.id === config.pipeline_id);
  const selectedStage    = selectedPipeline?.crm_stages.find(s => s.id === config.stage_id);
  const pipelineName     = selectedPipeline?.name ?? "—";
  const stageName        = selectedStage?.name    ?? "—";
  const ownerLabel       = config.owner_name ?? "sem responsável";
  const tagCount         = config.tag_ids.length;

  // Stages da pipeline selecionada
  const availableStages = (selectedPipeline?.crm_stages ?? []).filter(s => s.is_active);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <FormularioShell id={id}>
      <div className="px-4 sm:px-6 pt-5 pb-32 flex flex-col gap-4 max-w-2xl">

        <ConfigSubNav />

        {(isLoading || tagsLoading || usersLoading || pipelinesLoading) && (
          <div className="flex items-center gap-2 py-8" style={{ color: "var(--muted-foreground)" }}>
            <Loader2 size={15} className="animate-spin" />
            <span className="text-sm">Carregando…</span>
          </div>
        )}

        {!isLoading && (
          <>
            {/* ── 1. Resumo/Status ─────────────────────────────────────────── */}
            <div
              className="rounded-xl p-4 flex items-start gap-3"
              style={{ background: "rgba(102,174,214,0.06)", border: "1px solid rgba(102,174,214,0.15)" }}
            >
              <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#66aed6" }} />
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "#66aed6" }}>Como funciona</p>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  Todo lead enviado por este formulário será criado automaticamente no CRM utilizando
                  a <strong style={{ color: "var(--text-title)" }}>origem</strong>,{" "}
                  <strong style={{ color: "var(--text-title)" }}>etapa</strong>,{" "}
                  <strong style={{ color: "var(--text-title)" }}>responsável</strong>{" "}
                  e <strong style={{ color: "var(--text-title)" }}>tags</strong> configurados abaixo.
                </p>
                {configId && (
                  <p className="text-[11px] mt-2 font-medium" style={{ color: "#66aed6" }}>
                    ✓ Integração ativa — origem: {sourceName} · pipeline: {pipelineName} · etapa: {stageName}
                    {config.owner_name && ` · responsável: ${ownerLabel}`}
                    {tagCount > 0 && ` · ${tagCount} tag${tagCount > 1 ? "s" : ""}`}
                  </p>
                )}
              </div>
            </div>

            {/* ── 2. Origem ────────────────────────────────────────────────── */}
            <SectionCard title="Origem de Destino" description="Define a origem do lead no CRM." icon={AlertCircle}>
              <FieldRow label="Origem no CRM">
                <SelectField<string>
                  value={config.source}
                  onChange={v => patch("source", v)}
                >
                  {CRM_SOURCES.map(s => (
                    <option key={s.id} value={s.id} style={{ background: "#17172a" }}>
                      {s.label}{s.isDefault ? " (Padrão)" : ""}
                    </option>
                  ))}
                </SelectField>
              </FieldRow>
            </SectionCard>

            {/* ── 3. Pipeline → Etapa ──────────────────────────────────────── */}
            <SectionCard title="Destino no CRM" description="Pipeline e etapa onde o lead será criado.">
              <FieldRow label="Pipeline">
                <SelectField<string>
                  value={config.pipeline_id ?? ""}
                  onChange={v => {
                    patch("pipeline_id", v || null);
                    patch("stage_id", null);
                  }}
                  disabled={activePipelines.length === 0}
                >
                  <option value="" style={{ background: "#17172a" }}>Selecionar pipeline…</option>
                  {activePipelines.map(p => (
                    <option key={p.id} value={p.id} style={{ background: "#17172a" }}>
                      {p.name}
                    </option>
                  ))}
                </SelectField>
              </FieldRow>

              <FieldRow label="Etapa" description="Ao selecionar uma pipeline as etapas são carregadas automaticamente.">
                <SelectField<string>
                  value={config.stage_id ?? ""}
                  onChange={v => patch("stage_id", v || null)}
                  disabled={!config.pipeline_id || availableStages.length === 0}
                >
                  <option value="" style={{ background: "#17172a" }}>Selecionar etapa…</option>
                  {availableStages.map(s => (
                    <option key={s.id} value={s.id} style={{ background: "#17172a" }}>
                      {s.name}
                    </option>
                  ))}
                </SelectField>
              </FieldRow>
            </SectionCard>

            {/* ── 4. Responsável ───────────────────────────────────────────── */}
            <SectionCard title="Responsável Padrão" description="Usuário responsável pelos leads criados por este formulário." icon={Users}>
              <FieldRow label="Responsável" description="O nome do responsável ficará registrado nas observações do lead.">
                <SelectField<string>
                  value={config.owner_id ?? ""}
                  onChange={v => {
                    if (!v) { patch("owner_id", null); patch("owner_name", null); return; }
                    const u = activeUsers.find(u => u.id === v);
                    patch("owner_id", v);
                    patch("owner_name", u?.full_name ?? null);
                  }}
                >
                  <option value="" style={{ background: "#17172a" }}>Sem responsável</option>
                  {activeUsers.map(u => (
                    <option key={u.id} value={u.id} style={{ background: "#17172a" }}>
                      {u.full_name}
                      {u.job_title ? ` — ${u.job_title}` : ""}
                    </option>
                  ))}
                </SelectField>
              </FieldRow>
            </SectionCard>

            {/* ── 5. Tags ──────────────────────────────────────────────────── */}
            <SectionCard title="Tags Automáticas" description="Tags aplicadas automaticamente em todos os leads criados por este formulário.">
              <FieldRow label="Tags">
                <TagMultiSelect
                  available={tags.map(t => ({ id: t.id, name: t.name, color: t.color }))}
                  selected={config.tag_ids}
                  onChange={ids => patch("tag_ids", ids)}
                />
              </FieldRow>
            </SectionCard>

            {/* ── 6. Valor do negócio ──────────────────────────────────────── */}
            <SectionCard title="Valor do Negócio" description="Valor (R$) registrado no campo de negócio do lead no CRM.">
              {/* Mode toggle */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {(["fixed", "question"] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => patch("value_mode", mode)}
                    className="flex-1 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      background: config.value_mode === mode ? "rgba(255,255,255,0.10)" : "transparent",
                      color:      config.value_mode === mode ? "var(--text-title)" : "var(--muted-foreground)",
                      borderRight: mode === "fixed" ? "1px solid var(--border)" : "none",
                    }}
                  >
                    {mode === "fixed" ? "Valor fixo (R$)" : "Resposta do formulário"}
                  </button>
                ))}
              </div>

              {config.value_mode === "fixed" ? (
                <FieldRow
                  label="Valor do negócio"
                  description="Todos os leads criados por este formulário terão este valor registrado no CRM."
                >
                  <div className="relative">
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      R$
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={config.fixed_value || ""}
                      onChange={e => patch("fixed_value", Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0,00"
                      className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--border)",
                        color: "var(--text-title)",
                      }}
                    />
                  </div>
                </FieldRow>
              ) : (
                <FieldRow
                  label="Pergunta com valor"
                  description={valueSteps.length === 0
                    ? "Nenhuma pergunta de tipo numérico encontrada neste formulário."
                    : "O valor respondido pelo lead será registrado como valor do negócio no CRM."}
                >
                  <SelectField<string>
                    value={config.value_field_id ?? ""}
                    onChange={v => patch("value_field_id", v || null)}
                    disabled={valueSteps.length === 0}
                  >
                    <option value="" style={{ background: "#17172a" }}>Não mapear</option>
                    {valueSteps.map((step: FormStep) => (
                      <option key={step.id} value={step.id} style={{ background: "#17172a" }}>
                        {step.title}
                      </option>
                    ))}
                  </SelectField>
                </FieldRow>
              )}
            </SectionCard>

            {/* ── 7. Resumo ────────────────────────────────────────────────── */}
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}
            >
              <p className="text-xs font-semibold mb-2" style={{ color: "#22c55e" }}>Resumo da integração</p>
              <ul className="text-[11px] space-y-1" style={{ color: "var(--muted-foreground)" }}>
                <li>• Origem no CRM: <strong style={{ color: "var(--text-title)" }}>{sourceName}</strong></li>
                <li>• Pipeline: <strong style={{ color: "var(--text-title)" }}>{pipelineName}</strong></li>
                <li>• Etapa inicial: <strong style={{ color: "var(--text-title)" }}>{stageName}</strong></li>
                <li>• Responsável: <strong style={{ color: "var(--text-title)" }}>{config.owner_name ?? "Sem responsável"}</strong></li>
                <li>• Tags: <strong style={{ color: "var(--text-title)" }}>
                  {tagCount === 0 ? "Nenhuma" : `${tagCount} tag${tagCount > 1 ? "s" : ""}`}
                </strong></li>
                <li>• Valor do negócio: <strong style={{ color: "var(--text-title)" }}>
                  {config.value_mode === "fixed"
                    ? config.fixed_value > 0
                      ? `R$ ${config.fixed_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "R$ 0,00"
                    : config.value_field_id
                      ? valueSteps.find((s: FormStep) => s.id === config.value_field_id)?.title ?? "—"
                      : "Não mapeado"}
                </strong></li>
              </ul>
            </div>
          </>
        )}
      </div>

      {/* ── Sticky save bar ─────────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 px-4 sm:px-6 py-3"
        style={{ background: "var(--card)", borderTop: "1px solid var(--border)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-2">
          {isDirty
            ? <><span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f59e0b" }} /><span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Alterações não salvas</span></>
            : <><CheckCircle2 size={12} style={{ color: "#22c55e" }} /><span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Tudo salvo</span></>
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
    </FormularioShell>
  );
}
