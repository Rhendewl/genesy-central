-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace — notificações de tarefas persistentes
--
-- Evolui workflow_notifications para a inbox compartilhada da plataforma.
-- Mantemos o nome da tabela para preservar os registros e consumidores atuais,
-- acrescentando metadados que permitem abrir a tarefa e deduplicar retries do bus.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.workflow_notifications
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'workflow',
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS event_id text,
  ADD COLUMN IF NOT EXISTS push_status text,
  ADD COLUMN IF NOT EXISTS push_subscriptions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS push_accepted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS push_failed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS push_removed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS push_error text,
  ADD COLUMN IF NOT EXISTS push_attempted_at timestamptz;

CREATE INDEX IF NOT EXISTS workflow_notifications_task_idx
  ON public.workflow_notifications (task_id, created_at DESC)
  WHERE task_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workflow_notifications_event_recipient_uidx
  ON public.workflow_notifications (event_id, recipient_user_id)
  WHERE event_id IS NOT NULL;

COMMENT ON COLUMN public.workflow_notifications.source IS
  'Módulo que originou a notificação: workflow, workspace_task, etc.';
COMMENT ON COLUMN public.workflow_notifications.action_url IS
  'Rota interna aberta ao clicar na notificação.';
COMMENT ON COLUMN public.workflow_notifications.event_id IS
  'ID do evento do EventBus, usado para impedir duplicação em retries.';
COMMENT ON COLUMN public.workflow_notifications.push_status IS
  'Resultado agregado: accepted, partial, failed, no_subscription ou not_configured.';
