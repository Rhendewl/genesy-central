-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Workspace 100% pessoal (Tarefas/Notas/Objetivos)
--
-- Hoje as 11 tabelas do Workspace usam o padrão de "conta compartilhada"
-- (apply_standard_rls / effective_owner_id()) — qualquer membro da equipe
-- lê e escreve 100% das tarefas/notas/objetivos de qualquer outro membro,
-- incluindo o dono. É o bug mais grave relatado: cada usuário deve ter seu
-- próprio Workspace, vazio ao entrar pela primeira vez.
--
-- Fix: dado pessoal passa a usar auth.uid() = user_id direto (mesmo padrão
-- já correto de push_subscriptions/workspace_task_notification_preferences).
-- Uma tarefa/objetivo continua visível e acionável por quem foi atribuído
-- (workspace_task_assignees / workspace_objectives.assignee_id, que já
-- existem), preservando o recurso de múltiplos responsáveis — só deixa de
-- ser visível para TODA a equipe indiscriminadamente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Helpers ─────────────────────────────────────────────────────────────────

-- Trigger de auto-preenchimento pessoal (troca effective_owner_id() por
-- auth.uid() direto) — aplicado às 11 tabelas do Workspace.
CREATE OR REPLACE FUNCTION public.auto_set_own_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

-- RLS 100% pessoal reutilizável, para tabelas sem conceito de atribuição
-- (workspace_notes, workspace_note_revisions).
CREATE OR REPLACE FUNCTION public.apply_personal_rls(tbl text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete', tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (auth.uid() = user_id)', tbl || '_select', tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', tbl || '_insert', tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (auth.uid() = user_id)', tbl || '_update', tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (auth.uid() = user_id)', tbl || '_delete', tbl);
END;
$$;

-- Um responsável (via workspace_task_assignees) também pode ver/agir sobre
-- a tarefa e seus filhos (checklist/comentários/anexos), mesmo sem tê-la criado.
CREATE OR REPLACE FUNCTION public.can_access_workspace_task(p_task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_tasks wt
    WHERE wt.id = p_task_id
      AND (
        wt.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_task_assignees wta
          JOIN public.user_profiles up ON up.id = wta.assignee_id
          WHERE wta.task_id = wt.id AND up.auth_user_id = auth.uid()
        )
      )
  );
$$;

-- Mesma ideia para Objetivos (assignee_id é uma FK única, não uma tabela de vínculo).
CREATE OR REPLACE FUNCTION public.can_access_workspace_objective(p_objective_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_objectives wo
    WHERE wo.id = p_objective_id
      AND (
        wo.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = wo.assignee_id AND up.auth_user_id = auth.uid()
        )
      )
  );
$$;

-- ── 2. Migração dos dados existentes ─────────────────────────────────────────
--
-- Reatribui as linhas (hoje todas com user_id = dono) para quem de fato
-- criou cada registro, usando created_by/author_id que já existem. Tabelas
-- sem coluna própria de criador herdam o user_id (já corrigido) do pai.

UPDATE public.workspace_tasks      SET user_id = created_by WHERE created_by IS NOT NULL;
UPDATE public.workspace_notes      SET user_id = created_by WHERE created_by IS NOT NULL;
UPDATE public.workspace_objectives SET user_id = created_by WHERE created_by IS NOT NULL;

UPDATE public.workspace_task_checklist_items ci
SET user_id = wt.user_id
FROM public.workspace_tasks wt
WHERE ci.task_id = wt.id;

UPDATE public.workspace_task_attachments a
SET user_id = wt.user_id
FROM public.workspace_tasks wt
WHERE a.task_id = wt.id;

UPDATE public.workspace_task_assignees ta
SET user_id = wt.user_id
FROM public.workspace_tasks wt
WHERE ta.task_id = wt.id;

UPDATE public.workspace_objective_steps os
SET user_id = wo.user_id
FROM public.workspace_objectives wo
WHERE os.objective_id = wo.id;

UPDATE public.workspace_objective_attachments oa
SET user_id = wo.user_id
FROM public.workspace_objectives wo
WHERE oa.objective_id = wo.id;

UPDATE public.workspace_note_revisions nr
SET user_id = wn.user_id
FROM public.workspace_notes wn
WHERE nr.note_id = wn.id;

-- Comentários: resolve o autor real via author_id -> user_profiles.auth_user_id;
-- author_id NULL significa que foi o dono da tarefa/objetivo quem comentou.
UPDATE public.workspace_task_comments c
SET user_id = COALESCE(
  (SELECT up.auth_user_id FROM public.user_profiles up WHERE up.id = c.author_id),
  (SELECT wt.user_id FROM public.workspace_tasks wt WHERE wt.id = c.task_id)
);

UPDATE public.workspace_objective_comments oc
SET user_id = COALESCE(
  (SELECT up.auth_user_id FROM public.user_profiles up WHERE up.id = oc.author_id),
  (SELECT wo.user_id FROM public.workspace_objectives wo WHERE wo.id = oc.objective_id)
);

-- ── 3. Troca o trigger de auto-preenchimento nas 11 tabelas ──────────────────

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'workspace_tasks','workspace_task_assignees','workspace_task_checklist_items',
    'workspace_task_comments','workspace_task_attachments',
    'workspace_notes','workspace_note_revisions',
    'workspace_objectives','workspace_objective_steps',
    'workspace_objective_comments','workspace_objective_attachments'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_owner_%I ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_auto_owner_%I
       BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.auto_set_own_id()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ── 4. RLS pessoal simples — sem conceito de atribuição ──────────────────────

SELECT public.apply_personal_rls('workspace_notes');
SELECT public.apply_personal_rls('workspace_note_revisions');

-- ── 5. RLS de workspace_tasks — pessoal + visível/editável por atribuídos ────

DROP POLICY IF EXISTS "workspace_tasks_select" ON public.workspace_tasks;
DROP POLICY IF EXISTS "workspace_tasks_insert" ON public.workspace_tasks;
DROP POLICY IF EXISTS "workspace_tasks_update" ON public.workspace_tasks;
DROP POLICY IF EXISTS "workspace_tasks_delete" ON public.workspace_tasks;

CREATE POLICY "workspace_tasks_select" ON public.workspace_tasks FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.workspace_task_assignees wta
    JOIN public.user_profiles up ON up.id = wta.assignee_id
    WHERE wta.task_id = workspace_tasks.id AND up.auth_user_id = auth.uid()
  )
);
CREATE POLICY "workspace_tasks_insert" ON public.workspace_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workspace_tasks_update" ON public.workspace_tasks FOR UPDATE USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.workspace_task_assignees wta
    JOIN public.user_profiles up ON up.id = wta.assignee_id
    WHERE wta.task_id = workspace_tasks.id AND up.auth_user_id = auth.uid()
  )
);
CREATE POLICY "workspace_tasks_delete" ON public.workspace_tasks FOR DELETE USING (auth.uid() = user_id);

-- ── 6. RLS de workspace_task_assignees — pessoal + visível pelo atribuído ────

DROP POLICY IF EXISTS "workspace_task_assignees_select" ON public.workspace_task_assignees;
DROP POLICY IF EXISTS "workspace_task_assignees_insert" ON public.workspace_task_assignees;
DROP POLICY IF EXISTS "workspace_task_assignees_update" ON public.workspace_task_assignees;
DROP POLICY IF EXISTS "workspace_task_assignees_delete" ON public.workspace_task_assignees;

CREATE POLICY "workspace_task_assignees_select" ON public.workspace_task_assignees FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = workspace_task_assignees.assignee_id AND up.auth_user_id = auth.uid())
);
CREATE POLICY "workspace_task_assignees_insert" ON public.workspace_task_assignees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workspace_task_assignees_update" ON public.workspace_task_assignees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "workspace_task_assignees_delete" ON public.workspace_task_assignees FOR DELETE USING (auth.uid() = user_id);

-- ── 7. RLS das tabelas-filhas de tarefas — via can_access_workspace_task() ───

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['workspace_task_checklist_items','workspace_task_comments','workspace_task_attachments'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (public.can_access_workspace_task(task_id))', tbl || '_select', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.can_access_workspace_task(task_id))', tbl || '_insert', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (public.can_access_workspace_task(task_id))', tbl || '_update', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (public.can_access_workspace_task(task_id))', tbl || '_delete', tbl);
  END LOOP;
END;
$$;

-- ── 8. RLS de workspace_objectives — pessoal + visível/editável por atribuído ─

DROP POLICY IF EXISTS "workspace_objectives_select" ON public.workspace_objectives;
DROP POLICY IF EXISTS "workspace_objectives_insert" ON public.workspace_objectives;
DROP POLICY IF EXISTS "workspace_objectives_update" ON public.workspace_objectives;
DROP POLICY IF EXISTS "workspace_objectives_delete" ON public.workspace_objectives;

CREATE POLICY "workspace_objectives_select" ON public.workspace_objectives FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = workspace_objectives.assignee_id AND up.auth_user_id = auth.uid())
);
CREATE POLICY "workspace_objectives_insert" ON public.workspace_objectives FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workspace_objectives_update" ON public.workspace_objectives FOR UPDATE USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = workspace_objectives.assignee_id AND up.auth_user_id = auth.uid())
);
CREATE POLICY "workspace_objectives_delete" ON public.workspace_objectives FOR DELETE USING (auth.uid() = user_id);

-- ── 9. RLS das tabelas-filhas de objetivos — via can_access_workspace_objective() ─

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['workspace_objective_steps','workspace_objective_comments','workspace_objective_attachments'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (public.can_access_workspace_objective(objective_id))', tbl || '_select', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.can_access_workspace_objective(objective_id))', tbl || '_insert', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (public.can_access_workspace_objective(objective_id))', tbl || '_update', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (public.can_access_workspace_objective(objective_id))', tbl || '_delete', tbl);
  END LOOP;
END;
$$;
