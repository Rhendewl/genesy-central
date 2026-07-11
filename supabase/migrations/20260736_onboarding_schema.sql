-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace > Onboarding — Fase 1: Schema
--
-- Onboarding é compartilhado por toda a equipe (diferente do resto do
-- Workspace, que é pessoal desde 20260721) — por isso usa o padrão de
-- "conta compartilhada" (auto_set_owner_id() / effective_owner_id(), mesma
-- convenção do restante da plataforma fora do Workspace), não
-- auto_set_own_id(). Prefixo das tabelas é "onboarding_", não "workspace_",
-- para não confundir com a semântica pessoal que esse prefixo já carrega.
--
-- Tarefa mestre (onboarding_tasks) e espelho operacional (workspace_tasks,
-- que ganha aqui a coluna onboarding_task_id) — a sincronização entre os
-- dois vive em camada de serviço (src/lib/onboarding/sync.ts), não em
-- trigger: não existe precedente de trigger de lógica de negócio cross-table
-- neste schema (só triggers genéricos de updated_at/ownership), e a
-- sincronização precisa disparar notificações (camada de aplicação).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Templates (reutilizáveis, admin-only) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by  uuid        NOT NULL REFERENCES auth.users(id),
  name        text        NOT NULL,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_template_stages (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id       uuid        NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  order_index       integer     NOT NULL DEFAULT 0,
  relative_due_days integer     NOT NULL DEFAULT 0,
  color             text        NOT NULL DEFAULT '#4a8fd4',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_template_stages_template_idx ON public.onboarding_template_stages (template_id, order_index);

CREATE TABLE IF NOT EXISTS public.onboarding_template_tasks (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage_id                 uuid        NOT NULL REFERENCES public.onboarding_template_stages(id) ON DELETE CASCADE,
  title                    text        NOT NULL,
  description              text,
  role_key                 text,
  weight                   integer     NOT NULL DEFAULT 1 CHECK (weight > 0),
  priority                 text        NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta','urgente')),
  relative_due_days        integer,
  required_document_labels text[]      NOT NULL DEFAULT '{}',
  order_index              integer     NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_template_tasks_stage_idx ON public.onboarding_template_tasks (stage_id, order_index);

CREATE TABLE IF NOT EXISTS public.onboarding_template_task_dependencies (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id          uuid        NOT NULL REFERENCES public.onboarding_template_tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid      NOT NULL REFERENCES public.onboarding_template_tasks(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS onboarding_template_task_deps_task_idx    ON public.onboarding_template_task_dependencies (task_id);
CREATE INDEX IF NOT EXISTS onboarding_template_task_deps_depends_idx ON public.onboarding_template_task_dependencies (depends_on_task_id);

CREATE TABLE IF NOT EXISTS public.onboarding_template_documents (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid        NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
  label       text        NOT NULL,
  order_index integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_template_documents_template_idx ON public.onboarding_template_documents (template_id, order_index);

-- ── Projetos (instâncias) ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_projects (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by    uuid        NOT NULL REFERENCES auth.users(id),
  client_id     uuid        REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  template_id   uuid        REFERENCES public.onboarding_templates(id) ON DELETE SET NULL,
  name          text        NOT NULL,
  start_date    date        NOT NULL DEFAULT CURRENT_DATE,
  target_date   date,
  manual_status text        CHECK (manual_status IN ('aguardando_cliente','cancelado')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_projects_user_idx     ON public.onboarding_projects (user_id);
CREATE INDEX IF NOT EXISTS onboarding_projects_client_idx   ON public.onboarding_projects (client_id);
CREATE INDEX IF NOT EXISTS onboarding_projects_template_idx ON public.onboarding_projects (template_id);

CREATE TABLE IF NOT EXISTS public.onboarding_project_stages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  uuid        NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  order_index integer     NOT NULL DEFAULT 0,
  due_date    date,
  color       text        NOT NULL DEFAULT '#4a8fd4',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_project_stages_project_idx ON public.onboarding_project_stages (project_id, order_index);

CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by               uuid        NOT NULL REFERENCES auth.users(id),
  project_id               uuid        NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  stage_id                 uuid        NOT NULL REFERENCES public.onboarding_project_stages(id) ON DELETE CASCADE,
  title                    text        NOT NULL,
  description              text,
  role_key                 text,
  assignee_profile_id      uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  weight                   integer     NOT NULL DEFAULT 1 CHECK (weight > 0),
  priority                 text        NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta','urgente')),
  status                   text        NOT NULL DEFAULT 'a_fazer'
                                       CHECK (status IN ('a_fazer','em_andamento','aguardando','bloqueado','aguardando_cliente','concluido','cancelado')),
  due_date                 date,
  position                 integer     NOT NULL DEFAULT 0,
  required_document_labels text[]      NOT NULL DEFAULT '{}',
  completed_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_tasks_project_status_idx  ON public.onboarding_tasks (project_id, status);
CREATE INDEX IF NOT EXISTS onboarding_tasks_stage_status_idx    ON public.onboarding_tasks (stage_id, status);
CREATE INDEX IF NOT EXISTS onboarding_tasks_assignee_status_idx ON public.onboarding_tasks (assignee_profile_id, status);
CREATE INDEX IF NOT EXISTS onboarding_tasks_due_date_idx        ON public.onboarding_tasks (due_date) WHERE status NOT IN ('concluido','cancelado');

CREATE TABLE IF NOT EXISTS public.onboarding_task_dependencies (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id            uuid        NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid        NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS onboarding_task_deps_task_idx    ON public.onboarding_task_dependencies (task_id);
CREATE INDEX IF NOT EXISTS onboarding_task_deps_depends_idx ON public.onboarding_task_dependencies (depends_on_task_id);

CREATE TABLE IF NOT EXISTS public.onboarding_task_checklist_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id      uuid        NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  label        text        NOT NULL,
  is_completed boolean     NOT NULL DEFAULT false,
  position     integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_task_checklist_items_task_idx ON public.onboarding_task_checklist_items (task_id, position);

CREATE TABLE IF NOT EXISTS public.onboarding_task_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id    uuid        NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  author_id  uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  body       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_task_comments_task_idx ON public.onboarding_task_comments (task_id, created_at);

CREATE TABLE IF NOT EXISTS public.onboarding_task_attachments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id      uuid        NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  mime_type    text        NOT NULL,
  file_size    bigint,
  storage_path text        NOT NULL,
  public_url   text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_task_attachments_task_idx ON public.onboarding_task_attachments (task_id);

CREATE TABLE IF NOT EXISTS public.onboarding_project_documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   uuid        NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  label        text        NOT NULL,
  status       text        NOT NULL DEFAULT 'nao_solicitado'
                           CHECK (status IN ('nao_solicitado','solicitado','recebido','validado')),
  notes        text,
  file_url     text,
  storage_path text,
  updated_by   uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_project_documents_project_idx ON public.onboarding_project_documents (project_id);

CREATE TABLE IF NOT EXISTS public.onboarding_history (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id       uuid        NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  actor_profile_id uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  event_type       text        NOT NULL,
  payload          jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_history_project_idx ON public.onboarding_history (project_id, created_at);

-- ── Preferências de notificação (pessoal, mesmo padrão de workspace_task_notification_preferences) ─

CREATE TABLE IF NOT EXISTS public.onboarding_notification_preferences (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  notify_on_assignment     boolean     NOT NULL DEFAULT true,
  notify_on_status_change  boolean     NOT NULL DEFAULT true,
  notify_deadline_reminder boolean     NOT NULL DEFAULT true,
  reminder_advance_days    integer[]   NOT NULL DEFAULT '{0,1,3}',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ── Ponte com o Workspace pessoal — tarefa mestre → espelho operacional ──────

ALTER TABLE public.workspace_tasks
  ADD COLUMN IF NOT EXISTS onboarding_task_id uuid REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS workspace_tasks_onboarding_task_idx ON public.workspace_tasks (onboarding_task_id) WHERE onboarding_task_id IS NOT NULL;

-- ── updated_at triggers ───────────────────────────────────────────────────────

SELECT public.ensure_updated_at_trigger('onboarding_templates');
SELECT public.ensure_updated_at_trigger('onboarding_template_stages');
SELECT public.ensure_updated_at_trigger('onboarding_template_tasks');
SELECT public.ensure_updated_at_trigger('onboarding_projects');
SELECT public.ensure_updated_at_trigger('onboarding_project_stages');
SELECT public.ensure_updated_at_trigger('onboarding_tasks');
SELECT public.ensure_updated_at_trigger('onboarding_task_checklist_items');
SELECT public.ensure_updated_at_trigger('onboarding_project_documents');
SELECT public.ensure_updated_at_trigger('onboarding_notification_preferences');

-- ── Ownership trigger (conta compartilhada, mesmo padrão do restante da plataforma) ─

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'onboarding_templates','onboarding_template_stages','onboarding_template_tasks',
    'onboarding_template_task_dependencies','onboarding_template_documents',
    'onboarding_projects','onboarding_project_stages','onboarding_tasks',
    'onboarding_task_dependencies','onboarding_task_checklist_items',
    'onboarding_task_comments','onboarding_task_attachments',
    'onboarding_project_documents','onboarding_history'
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

-- ── Realtime ───────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'onboarding_templates','onboarding_template_stages','onboarding_template_tasks',
    'onboarding_template_task_dependencies','onboarding_template_documents',
    'onboarding_projects','onboarding_project_stages','onboarding_tasks',
    'onboarding_task_dependencies','onboarding_task_checklist_items',
    'onboarding_task_comments','onboarding_task_attachments',
    'onboarding_project_documents','onboarding_history'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END;
$$;
