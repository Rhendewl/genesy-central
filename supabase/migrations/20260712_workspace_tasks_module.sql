-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace — Fase 1: Tarefas + Kanban + To-do List
--
-- Design decisions:
--   • Ownership via effective_owner_id() (migration 022), não auth.uid()=user_id
--     puro: tarefas têm "responsável" (assignee) que pode ser um membro de
--     equipe diferente de quem criou — o board precisa ser compartilhado por
--     toda a conta (dono + equipe), não isolado por sessão individual, senão
--     atribuir uma tarefa a um colega não faria sentido (ele nunca veria).
--   • Checklist e Subtarefas unificados em workspace_task_checklist_items
--     (coluna linked_task_id reservada, não usada nesta fase).
--   • status/priority como text + CHECK, não enum nativo — mesma convenção do
--     restante do schema (leads.kanban_column etc.).
--   • position em passos de 10 por coluna de status, reindexado no cliente a
--     cada drag-and-drop (ver /api/workspace/tasks/[id]/move).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.workspace_tasks (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by     uuid        NOT NULL REFERENCES auth.users(id),
  title          text        NOT NULL,
  description    text,
  status         text        NOT NULL DEFAULT 'a_fazer'
                             CHECK (status IN ('a_fazer','em_andamento','aguardando','concluido')),
  priority       text        NOT NULL DEFAULT 'media'
                             CHECK (priority IN ('baixa','media','alta','urgente')),
  assignee_id    uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  tags           text[]      NOT NULL DEFAULT '{}',
  due_date       date,
  due_time       time,
  color          text,
  notes          text,
  position       integer     NOT NULL DEFAULT 0,
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_tasks_user_status_idx ON public.workspace_tasks (user_id, status, position);
CREATE INDEX IF NOT EXISTS workspace_tasks_assignee_idx     ON public.workspace_tasks (assignee_id);
CREATE INDEX IF NOT EXISTS workspace_tasks_due_date_idx     ON public.workspace_tasks (due_date) WHERE due_date IS NOT NULL;

SELECT public.ensure_updated_at_trigger('workspace_tasks');


CREATE TABLE IF NOT EXISTS public.workspace_task_checklist_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id        uuid        NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
  label          text        NOT NULL,
  is_completed   boolean     NOT NULL DEFAULT false,
  position       integer     NOT NULL DEFAULT 0,
  linked_task_id uuid        REFERENCES public.workspace_tasks(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_task_checklist_items_task_idx ON public.workspace_task_checklist_items (task_id, position);

SELECT public.ensure_updated_at_trigger('workspace_task_checklist_items');


CREATE TABLE IF NOT EXISTS public.workspace_task_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id    uuid        NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
  author_id  uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  body       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_task_comments_task_idx ON public.workspace_task_comments (task_id, created_at);


CREATE TABLE IF NOT EXISTS public.workspace_task_attachments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id      uuid        NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  mime_type    text        NOT NULL,
  file_size    bigint,
  storage_path text        NOT NULL,
  public_url   text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_task_attachments_task_idx ON public.workspace_task_attachments (task_id);


-- ── Ownership trigger + RLS (padrão de equipe compartilhada, migration 022) ───

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'workspace_tasks','workspace_task_checklist_items',
    'workspace_task_comments','workspace_task_attachments'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_owner_%I ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_auto_owner_%I
       BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

SELECT public.apply_standard_rls('workspace_tasks');
SELECT public.apply_standard_rls('workspace_task_checklist_items');
SELECT public.apply_standard_rls('workspace_task_comments');
SELECT public.apply_standard_rls('workspace_task_attachments');


-- ── Realtime ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_tasks;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_task_checklist_items;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_task_comments;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
