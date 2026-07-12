-- ═══════════════════════════════════════════════════════════════════════════════
-- Onboarding — responsável direto nas tarefas de template
--
-- Antes o template guardava apenas role_key ("cargo responsável") e o usuário
-- precisava mapear cargos para pessoas ao criar cada onboarding. Agora a tarefa
-- do template pode guardar o user_profiles.id do colaborador responsável.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.onboarding_template_tasks
  ADD COLUMN IF NOT EXISTS assignee_profile_id uuid
  REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS onboarding_template_tasks_assignee_idx
  ON public.onboarding_template_tasks (assignee_profile_id);
