"use client";

import { useRef, useState } from "react";
import { addHours, format, setHours, setMinutes } from "date-fns";
import { Bell, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useModalOpen } from "@/hooks/useModalOpen";
import { validateCalendarEvent } from "@/lib/google-calendar/event-validation";
import type { CalendarReminder } from "@/types/google-calendar";

interface ReminderDraft {
  method: CalendarReminder["method"];
  value: string;
  unit: "minutes" | "hours" | "days";
}
const MULTIPLIER = { minutes: 1, hours: 60, days: 1440 };
const fieldClass = "w-full min-w-0 rounded-xl border border-[var(--border-modal)] bg-[var(--bg-modal)] px-3 py-2.5 text-sm text-[var(--text-title)] outline-none focus:border-[var(--primary)]";

export function CreateEventModal({ day, onClose, onCreated }: {
  day: Date;
  onClose: () => void;
  onCreated: (start: Date) => void;
}) {
  useModalOpen(true);
  const [initialStart] = useState(() => {
    const start = setMinutes(setHours(day, 9), 0);
    start.setSeconds(0, 0);
    return start;
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState(format(initialStart, "yyyy-MM-dd'T'HH:mm"));
  const [end, setEnd] = useState(format(addHours(initialStart, 1), "yyyy-MM-dd'T'HH:mm"));
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Fortaleza");
  const [reminders, setReminders] = useState<ReminderDraft[]>([{ method: "popup", value: "10", unit: "minutes" }]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState(false);

  function updateReminder(index: number, patch: Partial<ReminderDraft>) {
    setReminders((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    setError(null);
    setReconnect(false);
    let input;
    try {
      input = validateCalendarEvent({
        title, description, location, timezone,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        reminders: reminders.map((r) => ({ method: r.method, minutes: r.value.trim() === "" ? NaN : Number(r.value) * MULTIPLIER[r.unit] })),
      });
    } catch (err) {
      setError(err instanceof RangeError ? "Informe datas e horários válidos." : err instanceof Error ? err.message : "Confira os dados do evento.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/google-calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        setReconnect(!!data.reconnect);
        throw new Error(data.error || "Não foi possível criar o evento.");
      }
      toast.success("Evento criado no Google Agenda.");
      onCreated(new Date(input.start));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar a criação. Confira o Google Agenda antes de tentar novamente.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !savingRef.current) onClose(); }}>
      <DialogContent className="lc-modal-panel sm:max-w-lg" showCloseButton={!saving}>
        <DialogTitle>Novo evento</DialogTitle>
        <DialogDescription>Crie na sua agenda Google conectada e escolha quando receber os lembretes.</DialogDescription>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <fieldset disabled={saving} className="flex min-w-0 flex-col gap-4 disabled:opacity-60">
            <label className="flex flex-col gap-1.5">Título
              <input autoFocus required maxLength={1024} className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Reunião com cliente" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1.5">Início
                <input required type="datetime-local" className={fieldClass} value={start} onChange={(e) => {
                  const value = e.target.value;
                  setStart(value);
                  if (value && (!end || value >= end)) setEnd(format(addHours(new Date(value), 1), "yyyy-MM-dd'T'HH:mm"));
                }} />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">Término
                <input required type="datetime-local" className={fieldClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
            <p className="-mt-2 text-xs text-[var(--muted-foreground)]">Fuso horário: {timezone}</p>
            <label className="flex flex-col gap-1.5">Local ou link da reunião
              <input maxLength={1024} className={fieldClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Opcional" />
            </label>
            <label className="flex flex-col gap-1.5">Descrição
              <textarea rows={3} maxLength={8000} className={fieldClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
            </label>
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 font-medium"><Bell size={15} /> Lembretes antes do evento</p>
              {reminders.map((reminder, index) => (
                <div key={index} className="grid grid-cols-[1fr_4rem_1fr_2rem] items-center gap-1.5">
                  <select aria-label={`Tipo do lembrete ${index + 1}`} className={fieldClass} value={reminder.method} onChange={(e) => updateReminder(index, { method: e.target.value as ReminderDraft["method"] })}>
                    <option value="popup">Notificação</option><option value="email">E-mail</option>
                  </select>
                  <input aria-label={`Antecedência do lembrete ${index + 1}`} type="number" required min={0} max={40320 / MULTIPLIER[reminder.unit]} step={1} className={fieldClass} value={reminder.value} onChange={(e) => updateReminder(index, { value: e.target.value })} />
                  <select aria-label={`Unidade do lembrete ${index + 1}`} className={fieldClass} value={reminder.unit} onChange={(e) => updateReminder(index, { unit: e.target.value as ReminderDraft["unit"] })}>
                    <option value="minutes">minutos</option><option value="hours">horas</option><option value="days">dias</option>
                  </select>
                  <button type="button" aria-label={`Remover lembrete ${index + 1}`} onClick={() => setReminders((items) => items.filter((_, i) => i !== index))} className="flex h-9 items-center justify-center"><Trash2 size={15} /></button>
                </div>
              ))}
              {reminders.length < 5 && <button type="button" onClick={() => setReminders((items) => [...items, { method: "popup", value: "1", unit: "days" }])} className="flex items-center gap-1 py-1 text-xs text-[var(--primary)]"><Plus size={14} /> Adicionar lembrete</button>}
              <p className="text-xs text-[var(--muted-foreground)]">Até 5 lembretes, de 0 minutos a 28 dias antes. As notificações são entregues pelo Google Agenda conforme as permissões do seu dispositivo. {reminders.length === 0 && "Este evento será criado sem lembretes."}</p>
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-[#fe7b4a]">{error}</p>}
          {reconnect && <a href="/api/google-calendar/connect" className="text-sm underline">Reconectar Google Agenda</a>}
          <div className="flex justify-end gap-2 border-t border-[var(--border-modal)] pt-4">
            <button type="button" disabled={saving} onClick={onClose} className="rounded-xl px-4 py-2.5 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-[#b0b8c1] px-4 py-2.5 font-medium text-black disabled:opacity-50">{saving ? "Criando…" : "Criar evento"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
