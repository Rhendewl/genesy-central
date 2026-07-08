"use client";

import { useRef, useState } from "react";
import { Bell, Loader2, Plus, Trash2, X } from "lucide-react";
import { ensurePushSubscription } from "@/lib/notifications/push-client";
import { useCrmNotificationRules }  from "@/hooks/useCrmNotificationRules";
import { usePipelines }             from "@/hooks/usePipelines";
import type {
  CrmNotificationChannel,
  CrmNotificationRuleWithNames,
  NewCrmNotificationRule,
  UpdateCrmNotificationRule,
} from "@/types/crm";

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_TITLE = "Novo Lead • {{pipeline_name}}";
const DEFAULT_BODY  = "{{lead_name}} entrou na etapa {{stage_name}}.";

const VARIABLES: { key: string; label: string }[] = [
  { key: "{{pipeline_name}}", label: "Nome do pipeline" },
  { key: "{{stage_name}}",    label: "Nome da etapa" },
  { key: "{{lead_name}}",     label: "Nome do lead" },
  { key: "{{lead_email}}",    label: "E-mail do lead" },
  { key: "{{lead_phone}}",    label: "Telefone do lead" },
  { key: "{{assigned_user}}", label: "Responsável" },
  { key: "{{created_at}}",    label: "Criado em" },
];

const FAKE: Record<string, string> = {
  "{{pipeline_name}}": "Comercial",
  "{{stage_name}}":    "Novo Lead",
  "{{lead_name}}":     "João Silva",
  "{{lead_email}}":    "joao@email.com",
  "{{lead_phone}}":    "(11) 99999-9999",
  "{{assigned_user}}": "Você",
  "{{created_at}}":    "04/07/2026",
};

const CHANNELS: { id: CrmNotificationChannel; label: string; description: string }[] = [
  { id: "pwa", label: "Aplicativo (PWA)", description: "Notificação no navegador ou app instalado" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderPreview(template: string): string {
  return template.replace(/\{\{[^}]+\}\}/g, m => FAKE[m] ?? m);
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  pipeline_id: string;
  stage_id:    string;
  enabled:     boolean;
  channels:    CrmNotificationChannel[];
  title:       string;
  body:        string;
}

const EMPTY_FORM: FormState = {
  pipeline_id: "",
  stage_id:    "",
  enabled:     true,
  channels:    ["pwa"],
  title:       DEFAULT_TITLE,
  body:        DEFAULT_BODY,
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const INPUT_STYLE = {
  background: "var(--hover)",
  border:     "1px solid var(--border)",
  color:      "var(--text-title)",
} as const;

const CARD_STYLE = {
  background: "var(--card)",
  border:     "1px solid var(--border)",
} as const;

// ── Rule Modal ────────────────────────────────────────────────────────────────

interface ModalProps {
  rule?:       CrmNotificationRuleWithNames;
  onSave:      (data: NewCrmNotificationRule | UpdateCrmNotificationRule) => Promise<boolean>;
  onClose:     () => void;
}

function RuleModal({ rule, onSave, onClose }: ModalProps) {
  const { pipelines } = usePipelines();

  const [form,         setForm]        = useState<FormState>(() => rule
    ? { pipeline_id: rule.pipeline_id, stage_id: rule.stage_id, enabled: rule.enabled, channels: rule.channels, title: rule.title, body: rule.body }
    : EMPTY_FORM,
  );
  const [isSaving,     setIsSaving]    = useState(false);
  const [isTesting,    setIsTesting]   = useState(false);
  const [testMsg,      setTestMsg]     = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<"title" | "body">("title");
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef  = useRef<HTMLTextAreaElement>(null);

  const isEdit       = !!rule;
  const activePipelines = pipelines.filter(p => p.is_active);
  const selectedPipeline = activePipelines.find(p => p.id === form.pipeline_id);
  const availableStages  = selectedPipeline?.crm_stages.filter(s => s.is_active) ?? [];

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => {
      if (key === "pipeline_id") return { ...prev, pipeline_id: value as string, stage_id: "" };
      return { ...prev, [key]: value };
    });
  }

  function toggleChannel(ch: CrmNotificationChannel) {
    setForm(prev => {
      const has  = prev.channels.includes(ch);
      return { ...prev, channels: has ? prev.channels.filter(c => c !== ch) : [...prev.channels, ch] };
    });
  }

  function insertVariable(varKey: string) {
    if (focusedField === "title") {
      const el = titleRef.current;
      if (!el) return;
      const s = el.selectionStart ?? form.title.length;
      const e = el.selectionEnd   ?? form.title.length;
      patch("title", form.title.slice(0, s) + varKey + form.title.slice(e));
      setTimeout(() => { el.focus(); el.setSelectionRange(s + varKey.length, s + varKey.length); }, 0);
    } else {
      const el = bodyRef.current;
      if (!el) return;
      const s = el.selectionStart ?? form.body.length;
      const e = el.selectionEnd   ?? form.body.length;
      patch("body", form.body.slice(0, s) + varKey + form.body.slice(e));
      setTimeout(() => { el.focus(); el.setSelectionRange(s + varKey.length, s + varKey.length); }, 0);
    }
  }

  async function handleSave() {
    if (!isEdit && (!form.pipeline_id || !form.stage_id)) return;
    setIsSaving(true);
    const data = isEdit
      ? { enabled: form.enabled, channels: form.channels, title: form.title, body: form.body } as UpdateCrmNotificationRule
      : { pipeline_id: form.pipeline_id, stage_id: form.stage_id, enabled: form.enabled, channels: form.channels, title: form.title, body: form.body } as NewCrmNotificationRule;
    const ok = await onSave(data);
    setIsSaving(false);
    if (ok) onClose();
  }

  async function handleTest() {
    setIsTesting(true);
    setTestMsg(null);

    if (!("Notification" in window)) {
      setTestMsg("Navegador não suporta notificações.");
      setIsTesting(false);
      return;
    }

    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setTestMsg("Permissão negada. Habilite nas configurações do navegador.");
      setIsTesting(false);
      return;
    }

    const title = renderPreview(form.title || DEFAULT_TITLE);
    const body  = renderPreview(form.body  || DEFAULT_BODY);
    const opts  = { body, icon: "/favicon.png" };

    try {
      await ensurePushSubscription();

      if ("serviceWorker" in navigator) {
        const timeoutPromise = new Promise<null>(res => setTimeout(() => res(null), 3000));
        const reg = await Promise.race([navigator.serviceWorker.ready, timeoutPromise]);
        if (reg) {
          await reg.showNotification(title, opts);
          setTestMsg("Notificação enviada!");
          setIsTesting(false);
          setTimeout(() => setTestMsg(null), 4000);
          return;
        }
      }
      new Notification(title, opts);
      setTestMsg("Notificação enviada!");
    } catch (err) {
      setTestMsg(`Erro: ${err instanceof Error ? err.message : "desconhecido"}`);
    }

    setIsTesting(false);
    setTimeout(() => setTestMsg(null), 4000);
  }

  const canSave = isEdit || (!!form.pipeline_id && !!form.stage_id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 lc-scrim"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(8px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ ...CARD_STYLE, maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            {isEdit ? "Editar regra" : "Nova regra de notificação"}
          </p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--hover)] transition-colors" style={{ color: "var(--muted-foreground)" }}>
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

          {/* Pipeline + Stage (only on create) */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Pipeline</label>
                <select
                  value={form.pipeline_id}
                  onChange={e => patch("pipeline_id", e.target.value)}
                  className="w-full appearance-none rounded-lg px-3 py-2 text-sm outline-none"
                  style={INPUT_STYLE}
                >
                  <option value="" style={{ background: "var(--background)" }}>Selecionar…</option>
                  {activePipelines.map(p => (
                    <option key={p.id} value={p.id} style={{ background: "var(--background)" }}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Etapa</label>
                <select
                  value={form.stage_id}
                  onChange={e => patch("stage_id", e.target.value)}
                  disabled={!form.pipeline_id}
                  className="w-full appearance-none rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-40"
                  style={INPUT_STYLE}
                >
                  <option value="" style={{ background: "var(--background)" }}>Selecionar…</option>
                  {availableStages.map(s => (
                    <option key={s.id} value={s.id} style={{ background: "var(--background)" }}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>Ativar regra</p>
            <button
              onClick={() => patch("enabled", !form.enabled)}
              aria-pressed={form.enabled}
              className="relative rounded-full transition-colors shrink-0"
              style={{ background: form.enabled ? "var(--primary)" : "var(--border)", width: "40px", height: "22px" }}
            >
              <span
                className="absolute top-0.5 left-0.5 rounded-full bg-white transition-transform shadow"
                style={{ width: "18px", height: "18px", transform: form.enabled ? "translateX(18px)" : "translateX(0)" }}
              />
            </button>
          </div>

          {/* Channels */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={CARD_STYLE}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Destino</p>
            {CHANNELS.map(ch => (
              <label key={ch.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.channels.includes(ch.id)}
                  onChange={() => toggleChannel(ch.id)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>{ch.label}</p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{ch.description}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Title + body */}
          <div className="rounded-xl p-4 flex flex-col gap-4" style={CARD_STYLE}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Conteúdo</p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Título</label>
              <input
                ref={titleRef}
                type="text"
                value={form.title}
                onChange={e => patch("title", e.target.value)}
                onFocus={() => setFocusedField("title")}
                placeholder={DEFAULT_TITLE}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={INPUT_STYLE}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Corpo</label>
              <textarea
                ref={bodyRef}
                value={form.body}
                onChange={e => patch("body", e.target.value)}
                onFocus={() => setFocusedField("body")}
                placeholder={DEFAULT_BODY}
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                style={INPUT_STYLE}
              />
            </div>

            {/* Variable picker */}
            <div className="flex flex-col gap-2">
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Inserir em <span style={{ color: "var(--text-title)" }}>{focusedField === "title" ? "Título" : "Corpo"}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    title={v.label}
                    className="px-2 py-1 rounded text-xs font-mono transition-colors hover:opacity-80"
                    style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--border)" }}
                  >
                    {v.key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={CARD_STYLE}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Preview</p>
            <div
              className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}
            >
              <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-base" style={{ background: "var(--hover)" }}>
                🔔
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-title)" }}>
                  {renderPreview(form.title || DEFAULT_TITLE)}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  {renderPreview(form.body || DEFAULT_BODY)}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
              style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--border)" }}
            >
              {isTesting ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
              Testar
            </button>
            {testMsg && (
              <p className="text-xs" style={{ color: testMsg.startsWith("Notificação") ? "#22c55e" : "#ef4444" }}>
                {testMsg}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !canSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
              style={{ background: "#b0b8c1", color: "#000000" }}
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export function CrmNotificacoesTab() {
  const { rules, isLoading, error, createRule, updateRule, deleteRule } = useCrmNotificationRules();
  const [modalMode,   setModalMode]   = useState<"create" | "edit" | null>(null);
  const [editingRule, setEditingRule] = useState<CrmNotificationRuleWithNames | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  function openCreate() { setEditingRule(null); setModalMode("create"); }
  function openEdit(rule: CrmNotificationRuleWithNames) { setEditingRule(rule); setModalMode("edit"); }
  function closeModal() { setModalMode(null); setEditingRule(null); }

  async function handleSave(data: NewCrmNotificationRule | UpdateCrmNotificationRule): Promise<boolean> {
    if (modalMode === "edit" && editingRule) {
      return updateRule(editingRule.id, data as UpdateCrmNotificationRule);
    }
    return createRule(data as NewCrmNotificationRule);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteRule(id);
    setDeletingId(null);
  }

  async function handleToggle(rule: CrmNotificationRuleWithNames) {
    await updateRule(rule.id, { enabled: !rule.enabled });
  }

  return (
    <div className="max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-base font-semibold" style={{ color: "var(--text-title)" }}>
            Notificações do CRM
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Receba uma notificação quando um lead entrar em uma etapa específica.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
          style={{ background: "#b0b8c1", color: "#000000" }}
        >
          <Plus size={15} />
          Nova notificação
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-12 justify-center" style={{ color: "var(--muted-foreground)" }}>
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Carregando…</span>
        </div>
      ) : error ? (
        <p className="text-sm py-8 text-center" style={{ color: "#ef4444" }}>{error}</p>
      ) : rules.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 py-16 rounded-2xl text-center"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <Bell size={28} style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>Nenhuma regra configurada</p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Crie uma regra para ser notificado quando um lead entrar em uma etapa.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "#b0b8c1", color: "#000000" }}
          >
            <Plus size={14} />
            Nova notificação
          </button>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {/* Table header */}
          <div
            className="grid px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
            style={{
              gridTemplateColumns: "1fr 1fr auto auto",
              background: "var(--hover)",
              borderBottom: "1px solid var(--border)",
              color: "var(--muted-foreground)",
            }}
          >
            <span>Pipeline</span>
            <span>Etapa</span>
            <span className="text-center">Status</span>
            <span />
          </div>

          {/* Rows */}
          {rules.map((rule, idx) => (
            <div
              key={rule.id}
              className="grid items-center px-4 py-3 cursor-pointer hover:bg-[var(--hover)] transition-colors"
              style={{
                gridTemplateColumns: "1fr 1fr auto auto",
                borderBottom: idx < rules.length - 1 ? "1px solid var(--border)" : undefined,
              }}
              onClick={() => openEdit(rule)}
            >
              {/* Pipeline */}
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-title)" }}>
                {rule.pipeline_name}
              </p>

              {/* Stage */}
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: rule.stage_color || "var(--icon)" }}
                />
                <p className="text-sm truncate" style={{ color: "var(--muted-foreground)" }}>
                  {rule.stage_name}
                </p>
              </div>

              {/* Toggle */}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleToggle(rule); }}
                aria-pressed={rule.enabled}
                className="relative rounded-full transition-colors"
                style={{ background: rule.enabled ? "var(--primary)" : "var(--border-card-hover)", width: "36px", height: "20px" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 rounded-full bg-white transition-transform shadow"
                  style={{ width: "16px", height: "16px", transform: rule.enabled ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleDelete(rule.id); }}
                disabled={deletingId === rule.id}
                className="ml-2 p-1.5 rounded-lg hover:bg-[var(--hover)] transition-colors disabled:opacity-40"
                style={{ color: "var(--muted-foreground)" }}
              >
                {deletingId === rule.id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalMode && (
        <RuleModal
          rule={editingRule ?? undefined}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
