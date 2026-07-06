-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Painel "Equipe" do Administrador (Fase 2)
--
-- Dá ao admin acesso de leitura/escrita ao Workspace de qualquer colega da
-- mesma conta — sem impersonar, sem trocar login — via RLS aditiva (soma-se
-- às políticas pessoais da Fase 1 via OR, nunca as substitui). O componente
-- React nunca decide isso; ele só pede os dados de um user_id específico, e
-- o banco decide se a resposta vem vazia ou populada.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Helpers ─────────────────────────────────────────────────────────────────

-- owner_id_of(p_user_id): espelha effective_owner_id(), mas para um usuário
-- arbitrário, não só quem está logado agora.
CREATE OR REPLACE FUNCTION public.owner_id_of(p_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.user_profiles WHERE auth_user_id = p_user_id LIMIT 1),
    p_user_id
  );
$$;

-- is_admin_of_owner(target_owner_id): true se quem está logado é um admin
-- ativo dessa mesma organização (comparação direta por owner_id).
CREATE OR REPLACE FUNCTION public.is_admin_of_owner(target_owner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles me
    WHERE me.auth_user_id = auth.uid()
      AND me.role = 'admin'
      AND me.is_active
      AND me.owner_id = target_owner_id
  );
$$;

-- is_admin_of_user(target_user_id): true se quem está logado é admin da
-- mesma organização do usuário-alvo (identificado pelo seu auth uid).
CREATE OR REPLACE FUNCTION public.is_admin_of_user(target_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.is_admin_of_owner(public.owner_id_of(target_user_id));
$$;

-- ── 2. Trigger de auto-preenchimento passa a respeitar um user_id explícito ──
--
-- Necessário para o admin criar uma tarefa/nota/objetivo "em nome de" um
-- colega enquanto visualiza o Workspace dele — sem isso o trigger sempre
-- reverteria user_id de volta pro uid do próprio admin.

CREATE OR REPLACE FUNCTION public.auto_set_own_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3. RLS aditiva nas tabelas-pai do Workspace + workspace_task_assignees ───

DROP POLICY IF EXISTS "workspace_tasks_select" ON public.workspace_tasks;
DROP POLICY IF EXISTS "workspace_tasks_insert" ON public.workspace_tasks;
DROP POLICY IF EXISTS "workspace_tasks_update" ON public.workspace_tasks;
DROP POLICY IF EXISTS "workspace_tasks_delete" ON public.workspace_tasks;

CREATE POLICY "workspace_tasks_select" ON public.workspace_tasks FOR SELECT USING (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
  OR EXISTS (
    SELECT 1 FROM public.workspace_task_assignees wta
    JOIN public.user_profiles up ON up.id = wta.assignee_id
    WHERE wta.task_id = workspace_tasks.id AND up.auth_user_id = auth.uid()
  )
);
CREATE POLICY "workspace_tasks_insert" ON public.workspace_tasks FOR INSERT WITH CHECK (
  auth.uid() = user_id OR public.is_admin_of_user(user_id)
);
CREATE POLICY "workspace_tasks_update" ON public.workspace_tasks FOR UPDATE USING (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
  OR EXISTS (
    SELECT 1 FROM public.workspace_task_assignees wta
    JOIN public.user_profiles up ON up.id = wta.assignee_id
    WHERE wta.task_id = workspace_tasks.id AND up.auth_user_id = auth.uid()
  )
);
CREATE POLICY "workspace_tasks_delete" ON public.workspace_tasks FOR DELETE USING (
  auth.uid() = user_id OR public.is_admin_of_user(user_id)
);

DROP POLICY IF EXISTS "workspace_task_assignees_select" ON public.workspace_task_assignees;
DROP POLICY IF EXISTS "workspace_task_assignees_insert" ON public.workspace_task_assignees;
DROP POLICY IF EXISTS "workspace_task_assignees_update" ON public.workspace_task_assignees;
DROP POLICY IF EXISTS "workspace_task_assignees_delete" ON public.workspace_task_assignees;

CREATE POLICY "workspace_task_assignees_select" ON public.workspace_task_assignees FOR SELECT USING (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
  OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = workspace_task_assignees.assignee_id AND up.auth_user_id = auth.uid())
);
CREATE POLICY "workspace_task_assignees_insert" ON public.workspace_task_assignees FOR INSERT WITH CHECK (
  auth.uid() = user_id OR public.is_admin_of_user(user_id)
);
CREATE POLICY "workspace_task_assignees_update" ON public.workspace_task_assignees FOR UPDATE USING (
  auth.uid() = user_id OR public.is_admin_of_user(user_id)
);
CREATE POLICY "workspace_task_assignees_delete" ON public.workspace_task_assignees FOR DELETE USING (
  auth.uid() = user_id OR public.is_admin_of_user(user_id)
);

DROP POLICY IF EXISTS "workspace_objectives_select" ON public.workspace_objectives;
DROP POLICY IF EXISTS "workspace_objectives_insert" ON public.workspace_objectives;
DROP POLICY IF EXISTS "workspace_objectives_update" ON public.workspace_objectives;
DROP POLICY IF EXISTS "workspace_objectives_delete" ON public.workspace_objectives;

CREATE POLICY "workspace_objectives_select" ON public.workspace_objectives FOR SELECT USING (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
  OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = workspace_objectives.assignee_id AND up.auth_user_id = auth.uid())
);
CREATE POLICY "workspace_objectives_insert" ON public.workspace_objectives FOR INSERT WITH CHECK (
  auth.uid() = user_id OR public.is_admin_of_user(user_id)
);
CREATE POLICY "workspace_objectives_update" ON public.workspace_objectives FOR UPDATE USING (
  auth.uid() = user_id
  OR public.is_admin_of_user(user_id)
  OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = workspace_objectives.assignee_id AND up.auth_user_id = auth.uid())
);
CREATE POLICY "workspace_objectives_delete" ON public.workspace_objectives FOR DELETE USING (
  auth.uid() = user_id OR public.is_admin_of_user(user_id)
);

-- ── 4. RLS aditiva em workspace_notes / workspace_note_revisions ────────────

DROP POLICY IF EXISTS "workspace_notes_select" ON public.workspace_notes;
DROP POLICY IF EXISTS "workspace_notes_insert" ON public.workspace_notes;
DROP POLICY IF EXISTS "workspace_notes_update" ON public.workspace_notes;
DROP POLICY IF EXISTS "workspace_notes_delete" ON public.workspace_notes;

CREATE POLICY "workspace_notes_select" ON public.workspace_notes FOR SELECT USING (auth.uid() = user_id OR public.is_admin_of_user(user_id));
CREATE POLICY "workspace_notes_insert" ON public.workspace_notes FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin_of_user(user_id));
CREATE POLICY "workspace_notes_update" ON public.workspace_notes FOR UPDATE USING (auth.uid() = user_id OR public.is_admin_of_user(user_id));
CREATE POLICY "workspace_notes_delete" ON public.workspace_notes FOR DELETE USING (auth.uid() = user_id OR public.is_admin_of_user(user_id));

DROP POLICY IF EXISTS "workspace_note_revisions_select" ON public.workspace_note_revisions;
DROP POLICY IF EXISTS "workspace_note_revisions_insert" ON public.workspace_note_revisions;
DROP POLICY IF EXISTS "workspace_note_revisions_update" ON public.workspace_note_revisions;
DROP POLICY IF EXISTS "workspace_note_revisions_delete" ON public.workspace_note_revisions;

CREATE POLICY "workspace_note_revisions_select" ON public.workspace_note_revisions FOR SELECT USING (auth.uid() = user_id OR public.is_admin_of_user(user_id));
CREATE POLICY "workspace_note_revisions_insert" ON public.workspace_note_revisions FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin_of_user(user_id));
CREATE POLICY "workspace_note_revisions_update" ON public.workspace_note_revisions FOR UPDATE USING (auth.uid() = user_id OR public.is_admin_of_user(user_id));
CREATE POLICY "workspace_note_revisions_delete" ON public.workspace_note_revisions FOR DELETE USING (auth.uid() = user_id OR public.is_admin_of_user(user_id));

-- ── 5. Tabelas-filhas de tarefas/objetivos — estende os helpers da Fase 1 ───
--
-- can_access_workspace_task/objective já centralizam "criador OU atribuído";
-- só precisam ganhar mais um OR ("admin da organização do dono"), sem mexer
-- nas políticas das tabelas-filhas em si (checklist/comentários/anexos).

CREATE OR REPLACE FUNCTION public.can_access_workspace_task(p_task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_tasks wt
    WHERE wt.id = p_task_id
      AND (
        wt.user_id = auth.uid()
        OR public.is_admin_of_user(wt.user_id)
        OR EXISTS (
          SELECT 1 FROM public.workspace_task_assignees wta
          JOIN public.user_profiles up ON up.id = wta.assignee_id
          WHERE wta.task_id = wt.id AND up.auth_user_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_workspace_objective(p_objective_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_objectives wo
    WHERE wo.id = p_objective_id
      AND (
        wo.user_id = auth.uid()
        OR public.is_admin_of_user(wo.user_id)
        OR EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = wo.assignee_id AND up.auth_user_id = auth.uid()
        )
      )
  );
$$;

-- ── 6. user_profiles — admin vê a equipe inteira, não só a própria linha ────

DROP POLICY IF EXISTS "user_profiles_admin_select_team" ON public.user_profiles;
CREATE POLICY "user_profiles_admin_select_team" ON public.user_profiles FOR SELECT USING (
  public.is_admin_of_owner(owner_id)
);
