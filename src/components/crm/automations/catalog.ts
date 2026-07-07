import {
  LogIn, LogOut, ArrowRightLeft, Trophy, XCircle,
  Tag, Tags, CalendarCheck, UserCheck, UserX,
  Zap, Clock3, Sun, CalendarClock, Briefcase,
  Bell,
} from "lucide-react";
import type { DelayType } from "@/lib/workflow-engine/types";

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de tipos de gatilho/espera/condição/ação — mesmo formato de
// src/app/formularios/[id]/editor/_components/blocks.ts (BLOCK_DEFINITIONS):
// um array tipado + lookup, em vez de switch espalhado pela UI. Adicionar um
// tipo novo no futuro é só uma entrada nova aqui (o back-end também precisa
// de um resolver novo registrado, ver src/lib/workflow-engine/bootstrap.ts).
// ─────────────────────────────────────────────────────────────────────────────

export interface TriggerDefinition {
  type:        string;
  label:       string;
  description: string;
  icon:        React.ElementType;
  /** Quais campos de configuração este gatilho precisa (renderizados por TriggerConfigFields). */
  configFields: ("stage" | "tag")[];
}

export const TRIGGER_DEFINITIONS: TriggerDefinition[] = [
  { type: "crm.lead.stage_entered",     label: "Lead entrou na etapa",            description: "Dispara quando o lead entra na etapa escolhida.",     icon: LogIn,          configFields: ["stage"] },
  { type: "crm.lead.stage_left",        label: "Lead saiu da etapa",              description: "Dispara quando o lead sai da etapa escolhida.",       icon: LogOut,         configFields: ["stage"] },
  { type: "crm.lead.stage_changed_any", label: "Lead foi movido para qualquer etapa", description: "Dispara em qualquer movimentação de etapa.",       icon: ArrowRightLeft, configFields: [] },
  { type: "crm.lead.deal_won",          label: "Lead ganhou venda",               description: "Dispara ao entrar numa etapa marcada como Venda Ganha.", icon: Trophy,       configFields: [] },
  { type: "crm.lead.deal_lost",         label: "Lead perdeu venda",               description: "Dispara ao entrar numa etapa marcada como Venda Perdida.", icon: XCircle,    configFields: [] },
  { type: "crm.lead.tag_added",         label: "Lead recebeu tag",                description: "Dispara quando uma tag é adicionada ao lead.",        icon: Tag,            configFields: ["tag"] },
  { type: "crm.lead.tag_removed",       label: "Lead removeu tag",                description: "Dispara quando uma tag é removida do lead.",          icon: Tags,           configFields: ["tag"] },
  { type: "crm.lead.meeting_scheduled", label: "Lead agendou reunião",            description: "Dispara quando o lead agenda um horário.",            icon: CalendarCheck,  configFields: [] },
  { type: "crm.lead.meeting_attended",  label: "Lead compareceu",                 description: "Dispara quando a reunião é marcada como realizada.",  icon: UserCheck,      configFields: [] },
  { type: "crm.lead.meeting_no_show",   label: "Lead faltou",                     description: "Dispara quando a reunião é marcada como não comparecida.", icon: UserX,     configFields: [] },
];

export function getTriggerDef(type: string): TriggerDefinition | undefined {
  return TRIGGER_DEFINITIONS.find(t => t.type === type);
}

export interface DelayDefinition {
  type:  DelayType;
  label: string;
  icon:  React.ElementType;
  /** Quais campos de configuração este atraso precisa (renderizados por DelayConfigFields). */
  configFields: ("minutes" | "hours" | "days" | "time")[];
}

export const DELAY_DEFINITIONS: DelayDefinition[] = [
  { type: "immediate",         label: "Imediatamente",              icon: Zap,           configFields: [] },
  { type: "after_minutes",     label: "Após X minutos",             icon: Clock3,        configFields: ["minutes"] },
  { type: "after_hours",       label: "Após X horas",                icon: Clock3,        configFields: ["hours"] },
  { type: "after_days",        label: "Após X dias",                 icon: Clock3,        configFields: ["days"] },
  { type: "tomorrow",          label: "Amanhã",                      icon: Sun,           configFields: ["time"] },
  { type: "specific_time",     label: "Em horário específico",       icon: CalendarClock, configFields: ["time"] },
  { type: "next_business_day", label: "No próximo dia útil às XX:XX", icon: Briefcase,    configFields: ["time"] },
];

export function getDelayDef(type: string): DelayDefinition | undefined {
  return DELAY_DEFINITIONS.find(d => d.type === type);
}

export interface ConditionDefinition {
  type:        string;
  label:       string;
  description: string;
}

export const CONDITION_DEFINITIONS: ConditionDefinition[] = [
  { type: "crm.lead.same_stage", label: "Ainda estiver na mesma etapa",              description: "Cancela se o lead já mudou de etapa." },
  { type: "crm.lead.same_owner", label: "Ainda pertencer ao mesmo responsável",       description: "Cancela se o responsável mudou." },
  { type: "crm.lead.not_won",    label: "Ainda não foi vendido",                      description: "Cancela se o lead já ganhou a venda." },
  { type: "crm.lead.not_lost",   label: "Ainda não foi perdido",                      description: "Cancela se o lead já foi marcado como perdido." },
];

export function getConditionDef(type: string): ConditionDefinition | undefined {
  return CONDITION_DEFINITIONS.find(c => c.type === type);
}

export interface ActionDefinition {
  type:        string;
  label:       string;
  description: string;
  icon:        React.ElementType;
}

export const ACTION_DEFINITIONS: ActionDefinition[] = [
  { type: "core.notification.create", label: "Criar Notificação", description: "Cria uma notificação para o responsável, um usuário específico ou os administradores.", icon: Bell },
];

export function getActionDef(type: string): ActionDefinition | undefined {
  return ACTION_DEFINITIONS.find(a => a.type === type);
}

export const RECIPIENT_TYPE_LABELS: Record<string, string> = {
  lead_owner:    "Responsável atual do lead",
  specific_user: "Usuário específico",
  admins:        "Administradores",
};

export const WORKFLOW_VARIABLES = [
  "lead.nome", "lead.email", "lead.telefone", "pipeline.nome", "etapa.nome",
  "responsavel.nome", "empresa", "data", "hora", "iq", "ie", "dias_na_etapa",
] as const;
