-- ═══════════════════════════════════════════════════════════════════════════════
-- Onboarding — horário de prazo nas tarefas
--
-- Alinha onboarding_tasks com workspace_tasks para que tarefas espelhadas no
-- Workspace carreguem data e horário de vencimento.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.onboarding_tasks
  ADD COLUMN IF NOT EXISTS due_time time;

