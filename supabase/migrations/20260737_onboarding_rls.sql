-- ═══════════════════════════════════════════════════════════════════════════════
-- Workspace > Onboarding — Fase 1: RLS
--
-- Dois níveis de acesso:
--   • "Estrutural" (templates e tudo dentro deles) — só admin da conta
--     (is_admin_of_owner), colaborador nem vê.
--   • "Projeto" (onboarding_projects e tudo dentro) — admin vê tudo; um
--     colaborador só vê o projeto se tiver ao menos uma onboarding_task
--     atribuída a ele (mesmo espírito de can_access_workspace_task, adaptado
--     para "acesso ao projeto inteiro via qualquer tarefa atribuída").
--
-- A distinção fina "colaborador pode concluir/comentar mas não pode mudar
-- título/prazo/responsável" não é expressa em RLS (não há trigger de coluna
-- privilegiada aqui, ao contrário do self-edit de user_profiles) — fica a
-- cargo do allowlist de campos em cada API route, checando is_admin_of_owner
-- server-side antes de aceitar campos estruturais. RLS garante a visibilidade
-- e que só quem tem acesso ao projeto grava a linha.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Helpers ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_access_onboarding_project(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_projects p
    WHERE p.id = p_project_id
      AND p.user_id = public.effective_owner_id()
      AND (
        public.is_admin_of_owner(p.user_id)
        OR EXISTS (
          SELECT 1 FROM public.onboarding_tasks t
          JOIN public.user_profiles up ON up.id = t.assignee_profile_id
          WHERE t.project_id = p.id AND up.auth_user_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_onboarding_task(p_task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_tasks t
    WHERE t.id = p_task_id AND public.can_access_onboarding_project(t.project_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of_onboarding_project(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_projects p
    WHERE p.id = p_project_id AND public.is_admin_of_owner(p.user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of_onboarding_task(p_task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_tasks t
    WHERE t.id = p_task_id AND public.is_admin_of_onboarding_project(t.project_id)
  );
$$;

-- ── Templates — admin-only (FOR ALL, mesmo estilo de crm_pipelines) ─────────

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'onboarding_templates','onboarding_template_stages','onboarding_template_tasks',
    'onboarding_template_task_dependencies','onboarding_template_documents'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_admin_all', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (public.is_admin_of_owner(user_id)) WITH CHECK (public.is_admin_of_owner(user_id))',
      tbl || '_admin_all', tbl
    );
  END LOOP;
END;
$$;

-- ── onboarding_projects — SELECT via projeto; INSERT/UPDATE/DELETE admin ────

ALTER TABLE public.onboarding_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_projects_select" ON public.onboarding_projects;
DROP POLICY IF EXISTS "onboarding_projects_insert" ON public.onboarding_projects;
DROP POLICY IF EXISTS "onboarding_projects_update" ON public.onboarding_projects;
DROP POLICY IF EXISTS "onboarding_projects_delete" ON public.onboarding_projects;

CREATE POLICY "onboarding_projects_select" ON public.onboarding_projects FOR SELECT USING (
  public.can_access_onboarding_project(id)
);
CREATE POLICY "onboarding_projects_insert" ON public.onboarding_projects FOR INSERT WITH CHECK (
  public.is_admin_of_owner(user_id)
);
CREATE POLICY "onboarding_projects_update" ON public.onboarding_projects FOR UPDATE USING (
  public.is_admin_of_owner(user_id)
);
CREATE POLICY "onboarding_projects_delete" ON public.onboarding_projects FOR DELETE USING (
  public.is_admin_of_owner(user_id)
);

-- ── onboarding_project_stages — SELECT via projeto; mutação admin ───────────

ALTER TABLE public.onboarding_project_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_project_stages_select" ON public.onboarding_project_stages;
DROP POLICY IF EXISTS "onboarding_project_stages_insert" ON public.onboarding_project_stages;
DROP POLICY IF EXISTS "onboarding_project_stages_update" ON public.onboarding_project_stages;
DROP POLICY IF EXISTS "onboarding_project_stages_delete" ON public.onboarding_project_stages;

CREATE POLICY "onboarding_project_stages_select" ON public.onboarding_project_stages FOR SELECT USING (
  public.can_access_onboarding_project(project_id)
);
CREATE POLICY "onboarding_project_stages_insert" ON public.onboarding_project_stages FOR INSERT WITH CHECK (
  public.is_admin_of_onboarding_project(project_id)
);
CREATE POLICY "onboarding_project_stages_update" ON public.onboarding_project_stages FOR UPDATE USING (
  public.is_admin_of_onboarding_project(project_id)
);
CREATE POLICY "onboarding_project_stages_delete" ON public.onboarding_project_stages FOR DELETE USING (
  public.is_admin_of_onboarding_project(project_id)
);

-- ── onboarding_tasks — SELECT+UPDATE via projeto (campo-a-campo na API); INSERT/DELETE admin ─

ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_tasks_select" ON public.onboarding_tasks;
DROP POLICY IF EXISTS "onboarding_tasks_insert" ON public.onboarding_tasks;
DROP POLICY IF EXISTS "onboarding_tasks_update" ON public.onboarding_tasks;
DROP POLICY IF EXISTS "onboarding_tasks_delete" ON public.onboarding_tasks;

CREATE POLICY "onboarding_tasks_select" ON public.onboarding_tasks FOR SELECT USING (
  public.can_access_onboarding_project(project_id)
);
CREATE POLICY "onboarding_tasks_insert" ON public.onboarding_tasks FOR INSERT WITH CHECK (
  public.is_admin_of_onboarding_project(project_id)
);
CREATE POLICY "onboarding_tasks_update" ON public.onboarding_tasks FOR UPDATE USING (
  public.can_access_onboarding_project(project_id)
);
CREATE POLICY "onboarding_tasks_delete" ON public.onboarding_tasks FOR DELETE USING (
  public.is_admin_of_onboarding_project(project_id)
);

-- ── onboarding_task_dependencies — SELECT via tarefa; mutação admin (estrutural) ─

ALTER TABLE public.onboarding_task_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_task_dependencies_select" ON public.onboarding_task_dependencies;
DROP POLICY IF EXISTS "onboarding_task_dependencies_insert" ON public.onboarding_task_dependencies;
DROP POLICY IF EXISTS "onboarding_task_dependencies_delete" ON public.onboarding_task_dependencies;

CREATE POLICY "onboarding_task_dependencies_select" ON public.onboarding_task_dependencies FOR SELECT USING (
  public.can_access_onboarding_task(task_id)
);
CREATE POLICY "onboarding_task_dependencies_insert" ON public.onboarding_task_dependencies FOR INSERT WITH CHECK (
  public.is_admin_of_onboarding_task(task_id)
);
CREATE POLICY "onboarding_task_dependencies_delete" ON public.onboarding_task_dependencies FOR DELETE USING (
  public.is_admin_of_onboarding_task(task_id)
);

-- ── Tabelas-filhas de tarefa — checklist/comentários/anexos: qualquer participante do projeto ─

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['onboarding_task_checklist_items','onboarding_task_comments','onboarding_task_attachments'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (public.can_access_onboarding_task(task_id))', tbl || '_select', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.can_access_onboarding_task(task_id))', tbl || '_insert', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (public.can_access_onboarding_task(task_id))', tbl || '_update', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (public.can_access_onboarding_task(task_id))', tbl || '_delete', tbl);
  END LOOP;
END;
$$;

-- ── onboarding_project_documents — SELECT+UPDATE via projeto; INSERT/DELETE admin ─

ALTER TABLE public.onboarding_project_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_project_documents_select" ON public.onboarding_project_documents;
DROP POLICY IF EXISTS "onboarding_project_documents_insert" ON public.onboarding_project_documents;
DROP POLICY IF EXISTS "onboarding_project_documents_update" ON public.onboarding_project_documents;
DROP POLICY IF EXISTS "onboarding_project_documents_delete" ON public.onboarding_project_documents;

CREATE POLICY "onboarding_project_documents_select" ON public.onboarding_project_documents FOR SELECT USING (
  public.can_access_onboarding_project(project_id)
);
CREATE POLICY "onboarding_project_documents_insert" ON public.onboarding_project_documents FOR INSERT WITH CHECK (
  public.is_admin_of_onboarding_project(project_id)
);
CREATE POLICY "onboarding_project_documents_update" ON public.onboarding_project_documents FOR UPDATE USING (
  public.can_access_onboarding_project(project_id)
);
CREATE POLICY "onboarding_project_documents_delete" ON public.onboarding_project_documents FOR DELETE USING (
  public.is_admin_of_onboarding_project(project_id)
);

-- ── onboarding_history — append-only: SELECT+INSERT via projeto, sem UPDATE/DELETE ─

ALTER TABLE public.onboarding_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_history_select" ON public.onboarding_history;
DROP POLICY IF EXISTS "onboarding_history_insert" ON public.onboarding_history;

CREATE POLICY "onboarding_history_select" ON public.onboarding_history FOR SELECT USING (
  public.can_access_onboarding_project(project_id)
);
CREATE POLICY "onboarding_history_insert" ON public.onboarding_history FOR INSERT WITH CHECK (
  public.can_access_onboarding_project(project_id)
);

-- ── onboarding_notification_preferences — pessoal (mesmo padrão de workspace_task_notification_preferences) ─

ALTER TABLE public.onboarding_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_notification_preferences: owner full access" ON public.onboarding_notification_preferences;
CREATE POLICY "onboarding_notification_preferences: owner full access"
  ON public.onboarding_notification_preferences FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "onboarding_notification_preferences: service role read" ON public.onboarding_notification_preferences;
CREATE POLICY "onboarding_notification_preferences: service role read"
  ON public.onboarding_notification_preferences FOR SELECT
  USING (true);

-- ── workspace_tasks / workspace_task_assignees — brecha aditiva para o espelho ─
--
-- O serviço de sincronização (src/lib/onboarding/sync.ts) roda sob a sessão de
-- quem disparou a ação, não um service-role. Isso é suficiente quando é um
-- admin criando/editando o projeto (já coberto por is_admin_of_user acima),
-- mas quando um COLABORADOR comum conclui uma tarefa e isso desbloqueia uma
-- tarefa dependente atribuída a OUTRA pessoa, o sistema precisa criar o
-- espelho no Workspace pessoal dessa outra pessoa — algo que um colaborador
-- não-admin normalmente não pode fazer. A brecha abaixo permite isso somente
-- quando a linha referencia um onboarding_task real de um projeto ao qual quem
-- está autenticado tem acesso (can_access_onboarding_project) — nunca uma
-- criação arbitrária em nome de terceiros fora desse contexto.

DROP POLICY IF EXISTS "workspace_tasks_insert" ON public.workspace_tasks;
CREATE POLICY "workspace_tasks_insert" ON public.workspace_tasks FOR INSERT WITH CHECK (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
  OR (
    onboarding_task_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.onboarding_tasks ot
      WHERE ot.id = onboarding_task_id AND public.can_access_onboarding_project(ot.project_id)
    )
  )
);

DROP POLICY IF EXISTS "workspace_task_assignees_insert" ON public.workspace_task_assignees;
CREATE POLICY "workspace_task_assignees_insert" ON public.workspace_task_assignees FOR INSERT WITH CHECK (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
  OR EXISTS (
    SELECT 1 FROM public.workspace_tasks wt
    JOIN public.onboarding_tasks ot ON ot.id = wt.onboarding_task_id
    WHERE wt.id = task_id AND public.can_access_onboarding_project(ot.project_id)
  )
);
