"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { Switch } from "@/components/ui/Switch";
import { useTaskNotificationPreferences } from "@/hooks/useTaskNotificationPreferences";
import { ensurePushSubscription } from "@/lib/notifications/push-client";
import { REMINDER_ADVANCE_OPTIONS, type UpdateTaskNotificationPreferences } from "@/types/workspace-notifications";

interface PreferenceRowProps {
  label:       string;
  description: string;
  checked:     boolean;
  onChange:    (v: boolean) => void;
}

function PreferenceRow({ label, description, checked, onChange }: PreferenceRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>{label}</p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

export default function WorkspaceNotificationSettingsPage() {
  const { preferences, isLoading, save } = useTaskNotificationPreferences();
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [isEnablingPush, setIsEnablingPush] = useState(false);

  async function ensureDeviceCanReceivePush(): Promise<boolean> {
    const subscription = await ensurePushSubscription({ requestPermission: true });
    if (!subscription) {
      toast.error("Permissão de notificação não concedida neste dispositivo.");
      return false;
    }
    return true;
  }

  async function savePreference(patch: UpdateTaskNotificationPreferences) {
    const enablingPush = Object.values(patch).some((value) => value === true);
    if (enablingPush) {
      setIsEnablingPush(true);
      try {
        const ok = await ensureDeviceCanReceivePush();
        if (!ok) return;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao ativar notificações neste dispositivo");
        return;
      } finally {
        setIsEnablingPush(false);
      }
    }

    const result = await save(patch);
    if (result.error) toast.error(result.error);
  }

  function toggleAdvanceDay(day: number) {
    if (!preferences) return;
    const next = preferences.reminder_advance_days.includes(day)
      ? preferences.reminder_advance_days.filter((d) => d !== day)
      : [...preferences.reminder_advance_days, day];
    void savePreference({ reminder_advance_days: next });
  }

  async function handleTestNotification() {
    setIsTestingPush(true);
    try {
      const ok = await ensureDeviceCanReceivePush();
      if (!ok) return;

      const res = await fetch("/api/workspace/notifications/test", { method: "POST" });
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao enviar teste");
      toast.success("Notificação de teste enviada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao testar notificação");
    } finally {
      setIsTestingPush(false);
    }
  }

  return (
    <div className="flex flex-col pb-24">
      <Header title="Notificações de Tarefas" subtitle="Escolha como você quer ser avisado" />

      {isLoading || !preferences ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 sm:px-6">
          <div className="lc-card p-6" style={{ background: "var(--glass-bg-soft)" }}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
              Atividade da tarefa
            </p>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl p-3" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>Teste de notificação PWA</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Envie um push real para este dispositivo.
                </p>
              </div>
              <button
                onClick={handleTestNotification}
                disabled={isTestingPush}
                className="lc-btn flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {isTestingPush && <Loader2 size={12} className="animate-spin" />}
                Testar notificação
              </button>
            </div>
            <div className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
              <PreferenceRow
                label="Atribuição"
                description="Quando uma tarefa for atribuída para mim"
                checked={preferences.notify_on_assignment}
                onChange={(v) => void savePreference({ notify_on_assignment: v })}
              />
              <PreferenceRow
                label="Mudança de etapa"
                description="Quando uma tarefa minha mudar de coluna no Kanban"
                checked={preferences.notify_on_status_change}
                onChange={(v) => void savePreference({ notify_on_status_change: v })}
              />
              <PreferenceRow
                label="Conclusão"
                description="Quando uma tarefa minha for concluída"
                checked={preferences.notify_on_completion}
                onChange={(v) => void savePreference({ notify_on_completion: v })}
              />
            </div>
          </div>

          <div className="lc-card p-6" style={{ background: "var(--glass-bg-soft)" }}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
              Lembretes de prazo
            </p>
            <PreferenceRow
              label="Ativar lembretes de prazo"
              description="Receber avisos sobre tarefas próximas do vencimento"
              checked={preferences.notify_deadline_reminder}
              onChange={(v) => void savePreference({ notify_deadline_reminder: v })}
            />

            {preferences.notify_deadline_reminder && (
              <div className="mt-1 flex flex-col gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                    Horário do lembrete
                  </p>
                  <input
                    type="time"
                    value={preferences.reminder_time.slice(0, 5)}
                    onChange={(e) => void savePreference({ reminder_time: e.target.value })}
                    className="h-9 rounded-lg border border-[var(--border)] bg-transparent px-2.5 text-sm outline-none"
                    disabled={isEnablingPush}
                    style={{ color: "var(--text-title)" }}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                    Antecedência
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {REMINDER_ADVANCE_OPTIONS.map((opt) => {
                      const active = preferences.reminder_advance_days.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          onClick={() => toggleAdvanceDay(opt.value)}
                          className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                          style={{
                            background: active ? "rgba(176,184,193,0.24)" : "var(--hover)",
                            color:      active ? "#b0b8c1" : "var(--muted-foreground)",
                            border:     `1px solid ${active ? "rgba(176,184,193,0.5)" : "var(--glass-border)"}`,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
