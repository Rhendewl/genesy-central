-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace — notificações de tarefas: lembretes e hardening RLS
--
-- 1. Registra lembretes de prazo já enviados para evitar push duplicado.
-- 2. Restringe policies auxiliares de leitura ao role service_role. O cliente
--    comum continua usando as policies "owner full access".
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.workspace_task_deadline_notification_deliveries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid        NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_date date        NOT NULL,
  due_date      date        NOT NULL,
  advance_days  integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id, reminder_date, advance_days)
);

CREATE INDEX IF NOT EXISTS workspace_task_deadline_deliveries_user_date_idx
  ON public.workspace_task_deadline_notification_deliveries (user_id, reminder_date DESC);

ALTER TABLE public.workspace_task_deadline_notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_task_deadline_deliveries: service role all" ON public.workspace_task_deadline_notification_deliveries;
CREATE POLICY "workspace_task_deadline_deliveries: service role all"
  ON public.workspace_task_deadline_notification_deliveries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- A service role já bypassa RLS, mas políticas abertas com USING (true) também
-- podem ampliar leitura para authenticated se houver grants. Mantemos intenção
-- explícita: só service_role lê em massa.

DROP POLICY IF EXISTS "push_subscriptions: service role read" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions: service role read"
  ON public.push_subscriptions
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "task_notification_preferences: service role read" ON public.workspace_task_notification_preferences;
CREATE POLICY "task_notification_preferences: service role read"
  ON public.workspace_task_notification_preferences
  FOR SELECT
  TO service_role
  USING (true);
