"use client";

import { useState } from "react";
import { Loader2, Plus, TestTube2, Trash2 } from "lucide-react";
import { useUsers } from "@/hooks/useUsers";
import { ensurePushSubscription } from "@/lib/notifications/push-client";
import { ACTION_DEFINITIONS, RECIPIENT_TYPE_LABELS, WORKFLOW_VARIABLES } from "./catalog";
import type { NotificationActionConfig } from "@/lib/workflow-engine/actions/notification-action";

export interface ActionRowValue { type: string; config: Record<string, unknown>; }

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--hover)",
  border:     "1px solid var(--border)",
  color:      "var(--text-title)",
};

const PREVIEW_VARS: Record<string, string> = {
  "lead.nome":        "João Silva",
  "lead.email":       "joao@email.com",
  "lead.telefone":    "(11) 99999-9999",
  "pipeline.nome":    "Comercial",
  "etapa.nome":       "Novo Lead",
  "responsavel.nome": "Maria Santos",
  "empresa":          "Genesy",
  "data":             "08/07/2026",
  "hora":             "14:30",
  "iq":               "82",
  "ie":               "40",
  "dias_na_etapa":    "2",
};

interface ActionsEditorProps {
  actions:  ActionRowValue[];
  onChange: (actions: ActionRowValue[]) => void;
}

function renderPreview(template: string): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => PREVIEW_VARS[key.trim()] ?? `{{${key.trim()}}}`);
}

export function ActionsEditor({ actions, onChange }: ActionsEditorProps) {
  const { profiles } = useUsers();
  const [testingIndex, setTestingIndex] = useState<number | null>(null);
  const [testMessage, setTestMessage] = useState<{ index: number; text: string } | null>(null);

  function addAction() {
    onChange([...actions, {
      type: "core.notification.create",
      config: { title: "", body: "", recipientType: "lead_owner" } satisfies NotificationActionConfig,
    }]);
  }

  function updateConfig(index: number, patch: Partial<NotificationActionConfig>) {
    onChange(actions.map((a, i) => i === index ? { ...a, config: { ...a.config, ...patch } } : a));
  }

  function removeAction(index: number) {
    onChange(actions.filter((_, i) => i !== index));
  }

  async function testNotification(index: number, config: NotificationActionConfig) {
    setTestingIndex(index);
    setTestMessage(null);

    try {
      if (!("Notification" in window)) {
        setTestMessage({ index, text: "Seu navegador não suporta notificações." });
        return;
      }

      let permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setTestMessage({ index, text: "Permissão negada. Habilite notificações no navegador." });
        return;
      }

      await ensurePushSubscription();

      const title = renderPreview(config.title?.trim() || "Teste de automação CRM");
      const body = renderPreview(config.body?.trim() || "Esta é uma prévia da notificação da automação.");
      const opts = { body, icon: "/favicon.png", badge: "/favicon.png", tag: "genesy-workflow-test" };

      if ("serviceWorker" in navigator) {
        const timeoutPromise = new Promise<null>(res => setTimeout(() => res(null), 3000));
        const reg = await Promise.race([navigator.serviceWorker.ready, timeoutPromise]);
        if (reg) {
          await reg.showNotification(title, opts);
          setTestMessage({ index, text: "Notificação de teste enviada." });
          return;
        }
      }

      new Notification(title, opts);
      setTestMessage({ index, text: "Notificação de teste enviada." });
    } catch (err) {
      setTestMessage({ index, text: err instanceof Error ? err.message : "Erro ao testar notificação." });
    } finally {
      setTestingIndex(null);
      setTimeout(() => setTestMessage(null), 4000);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {actions.map((action, index) => {
        const config = action.config as unknown as NotificationActionConfig;
        const def = ACTION_DEFINITIONS.find(a => a.type === action.type);
        return (
          <div key={index} className="rounded-lg p-3 flex flex-col gap-2" style={{ border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "var(--text-title)" }}>{def?.label ?? action.type}</p>
              <button
                type="button"
                onClick={() => removeAction(index)}
                className="p-1 rounded hover:bg-[var(--hover)] transition-colors"
                style={{ color: "var(--muted-foreground)" }}
                aria-label="Remover ação"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <input
              value={config.title ?? ""}
              onChange={e => updateConfig(index, { title: e.target.value })}
              placeholder="Título — aceita {{lead.nome}}, {{etapa.nome}}…"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={INPUT_STYLE}
            />
            <textarea
              value={config.body ?? ""}
              onChange={e => updateConfig(index, { body: e.target.value })}
              placeholder="Descrição"
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={INPUT_STYLE}
            />

            <select
              value={config.recipientType ?? "lead_owner"}
              onChange={e => updateConfig(index, { recipientType: e.target.value as NotificationActionConfig["recipientType"] })}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={INPUT_STYLE}
            >
              {Object.entries(RECIPIENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {config.recipientType === "specific_user" && (
              <select
                value={config.recipientUserId ?? ""}
                onChange={e => updateConfig(index, { recipientUserId: e.target.value || undefined })}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={INPUT_STYLE}
              >
                <option value="">Selecione o usuário</option>
                {profiles.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => testNotification(index, config)}
                disabled={testingIndex === index}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--hover)", border: "1px solid var(--border)", color: "var(--text-title)" }}
              >
                {testingIndex === index ? <Loader2 size={12} className="animate-spin" /> : <TestTube2 size={12} />}
                {testingIndex === index ? "Testando..." : "Testar notificação"}
              </button>

              {testMessage?.index === index && (
                <span className="text-[10px] text-right" style={{ color: "var(--text-placeholder)" }}>
                  {testMessage.text}
                </span>
              )}
            </div>

            <p className="text-[10px]" style={{ color: "var(--text-placeholder)" }}>
              Variáveis: {WORKFLOW_VARIABLES.map(v => `{{${v}}}`).join(", ")}
            </p>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addAction}
        className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--hover)]"
        style={{ color: "var(--muted-foreground)", border: "1px dashed var(--border)" }}
      >
        <Plus size={12} />
        Adicionar ação
      </button>
    </div>
  );
}
