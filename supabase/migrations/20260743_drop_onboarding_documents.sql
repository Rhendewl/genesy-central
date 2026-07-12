-- ═══════════════════════════════════════════════════════════════════════════════
-- Onboarding — remove documentos de template/projeto
--
-- O módulo deixou de exibir/usar documentos e acessos em templates/projetos.
-- Anexos de tarefas continuam existindo em onboarding_task_attachments.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.onboarding_project_documents CASCADE;
DROP TABLE IF EXISTS public.onboarding_template_documents CASCADE;

