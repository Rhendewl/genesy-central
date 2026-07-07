import type { Db, DelayType } from "./types";
import { WorkflowRepository } from "./repositories/workflow-repository";

// Timezone fixo na Fase 1 (ver limitações do plano) — cálculo de "amanhã"/
// "próximo dia útil" usa o horário local do servidor, que roda em UTC; para
// não desalinhar o "dia" percebido pelo usuário, todo cálculo de data usa o
// offset de America/Sao_Paulo (-03:00, sem horário de verão desde 2019).
const TZ_OFFSET_HOURS = -3;

function setTimeOfDay(date: Date, hhmm: string | undefined): Date {
  if (!hhmm) return date;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(date);
  // Aplica o horário informado no fuso de referência (offset fixo acima).
  d.setUTCHours(h - TZ_OFFSET_HOURS, m ?? 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isWeekend(date: Date): boolean {
  // Dia da semana no fuso de referência.
  const local = new Date(date.getTime() + TZ_OFFSET_HOURS * 60 * 60 * 1000);
  const day = local.getUTCDay();
  return day === 0 || day === 6;
}

export class JobScheduler {
  private readonly repo: WorkflowRepository;

  constructor(db: Db) {
    this.repo = new WorkflowRepository(db);
  }

  /** Função pura — testável sem banco. */
  computeScheduledFor(delayType: DelayType, delayConfig: Record<string, unknown>, now: Date = new Date()): Date {
    switch (delayType) {
      case "immediate":
        return now;

      case "after_minutes":
        return new Date(now.getTime() + (Number(delayConfig.minutes) || 0) * 60_000);

      case "after_hours":
        return new Date(now.getTime() + (Number(delayConfig.hours) || 0) * 3_600_000);

      case "after_days":
        return new Date(now.getTime() + (Number(delayConfig.days) || 0) * 86_400_000);

      case "tomorrow": {
        const tomorrow = addDays(now, 1);
        return setTimeOfDay(tomorrow, delayConfig.time as string | undefined);
      }

      case "specific_time": {
        const time = (delayConfig.time as string | undefined) ?? "09:00";
        let target = setTimeOfDay(now, time);
        if (target.getTime() <= now.getTime()) target = addDays(target, 1);
        return target;
      }

      case "next_business_day": {
        const time = (delayConfig.time as string | undefined) ?? "09:00";
        let target = addDays(now, 1);
        while (isWeekend(target)) target = addDays(target, 1);
        return setTimeOfDay(target, time);
      }

      default:
        return now;
    }
  }

  async scheduleJob(params: {
    automationId: string;
    leadId:       string;
    userId:       string;
    delayType:    DelayType;
    delayConfig:  Record<string, unknown>;
    snapshot:     Record<string, unknown>;
  }): Promise<{ ok: boolean; jobId: string | null; error: string | null }> {
    const scheduledFor = this.computeScheduledFor(params.delayType, params.delayConfig);
    const result = await this.repo.insertJob({
      userId:       params.userId,
      automationId: params.automationId,
      leadId:       params.leadId,
      scheduledFor,
      snapshot:     params.snapshot,
    });
    return { ok: !result.error, jobId: result.id, error: result.error };
  }
}
