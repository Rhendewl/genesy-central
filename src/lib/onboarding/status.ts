import type { OnboardingProjectStatus } from "@/types/onboarding";

// Status do projeto — manual_status tem prioridade (admin marcou explicitamente
// "aguardando cliente"/"cancelado"); senão é sempre derivado de progresso/prazos,
// nunca armazenado (mesma convenção da Objectives module). "Saúde" (verde/
// amarelo/vermelho/azul) é só uma cor sobre este mesmo status — ver
// ONBOARDING_PROJECT_STATUSES em src/types/onboarding.ts.
export function computeProjectStatus(params: {
  manualStatus: "aguardando_cliente" | "cancelado" | null;
  progress:     number;
  hasOverdue:   boolean;
  targetDate:   string | null;
}): OnboardingProjectStatus {
  if (params.manualStatus) return params.manualStatus;
  if (params.progress >= 100) return "concluido";
  if (params.hasOverdue) return "atrasado";
  if (params.targetDate) {
    const daysLeft = (new Date(params.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft <= 3) return "em_risco";
  }
  return "em_andamento";
}
