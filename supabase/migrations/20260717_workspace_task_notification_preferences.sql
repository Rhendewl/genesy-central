-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace — Tarefas: preferências de notificação
--
-- Diferente do resto do schema (conta compartilhada via effective_owner_id()),
-- preferências de notificação são pessoais: cada pessoa (dono ou membro da
-- equipe) configura as suas próprias. Mesmo padrão de RLS pessoal já usado em
-- push_subscriptions (migration 20260710) — auth.uid() = user_id direto.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.workspace_task_notification_preferences (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  notify_on_assignment      boolean     NOT NULL DEFAULT true,
  notify_on_status_change   boolean     NOT NULL DEFAULT true,
  notify_on_completion      boolean     NOT NULL DEFAULT true,
  notify_deadline_reminder  boolean     NOT NULL DEFAULT true,
  reminder_time             time        NOT NULL DEFAULT '08:00',
  reminder_advance_days     integer[]   NOT NULL DEFAULT '{0,1,3}',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_task_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_notification_preferences: owner full access" ON public.workspace_task_notification_preferences;
CREATE POLICY "task_notification_preferences: owner full access"
  ON public.workspace_task_notification_preferences FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Necessário para as fases seguintes: o servidor precisa ler as preferências
-- de qualquer destinatário (não só de quem está logado) para decidir se
-- dispara o push de atribuição/movimentação/prazo.
DROP POLICY IF EXISTS "task_notification_preferences: service role read" ON public.workspace_task_notification_preferences;
CREATE POLICY "task_notification_preferences: service role read"
  ON public.workspace_task_notification_preferences FOR SELECT
  USING (true);

SELECT public.ensure_updated_at_trigger('workspace_task_notification_preferences');
