-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace — Fase 4: Objetivos
--
-- Design decisions:
--   • Etapas (workspace_objective_steps) têm a mesma forma de
--     workspace_task_checklist_items — mesmo padrão, tabela paralela (não uma
--     extensão de tarefas, já que Objetivos é um sistema conceitualmente
--     separado do Kanban, sem status/coluna).
--   • Progresso (% concluído) é sempre calculado a partir das etapas, nunca
--     armazenado — evita trigger de desnormalização.
--   • Mesmo padrão de ownership compartilhado das fases anteriores.
--   • Sem campo de cor — não foi pedido para Objetivos (diferente de
--     Tarefas/Notas).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.workspace_objectives (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by   uuid        NOT NULL REFERENCES auth.users(id),
  title        text        NOT NULL,
  description  text,
  priority     text        NOT NULL DEFAULT 'media'
                           CHECK (priority IN ('baixa','media','alta','urgente')),
  assignee_id  uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  tags         text[]      NOT NULL DEFAULT '{}',
  due_date     date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_objectives_user_updated_idx ON public.workspace_objectives (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS workspace_objectives_assignee_idx     ON public.workspace_objectives (assignee_id);

SELECT public.ensure_updated_at_trigger('workspace_objectives');


CREATE TABLE IF NOT EXISTS public.workspace_objective_steps (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  objective_id uuid        NOT NULL REFERENCES public.workspace_objectives(id) ON DELETE CASCADE,
  label        text        NOT NULL,
  is_completed boolean     NOT NULL DEFAULT false,
  position     integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_objective_steps_objective_idx ON public.workspace_objective_steps (objective_id, position);

SELECT public.ensure_updated_at_trigger('workspace_objective_steps');


CREATE TABLE IF NOT EXISTS public.workspace_objective_comments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  objective_id uuid        NOT NULL REFERENCES public.workspace_objectives(id) ON DELETE CASCADE,
  author_id    uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  body         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_objective_comments_objective_idx ON public.workspace_objective_comments (objective_id, created_at);


CREATE TABLE IF NOT EXISTS public.workspace_objective_attachments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  objective_id uuid        NOT NULL REFERENCES public.workspace_objectives(id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  mime_type    text        NOT NULL,
  file_size    bigint,
  storage_path text        NOT NULL,
  public_url   text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_objective_attachments_objective_idx ON public.workspace_objective_attachments (objective_id);


-- ── Ownership trigger + RLS (mesmo padrão das fases anteriores) ───────────────

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'workspace_objectives','workspace_objective_steps',
    'workspace_objective_comments','workspace_objective_attachments'
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

SELECT public.apply_standard_rls('workspace_objectives');
SELECT public.apply_standard_rls('workspace_objective_steps');
SELECT public.apply_standard_rls('workspace_objective_comments');
SELECT public.apply_standard_rls('workspace_objective_attachments');


-- ── Realtime (objectives + steps — o progresso precisa atualizar ao vivo) ────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_objectives;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_objective_steps;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
