-- ═══════════════════════════════════════════════════════════════════════════════
-- Performance — grupos vinculados a funções e colaboradores
--
-- Evolui performance_role_configs para funcionar como "grupo de performance":
-- - job_title_aliases: cargos/funções que entram automaticamente no grupo;
-- - member_profile_ids: colaboradores vinculados manualmente ao grupo.
--
-- Vínculo manual tem prioridade sobre função/cargo textual.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.performance_role_configs
  ADD COLUMN IF NOT EXISTS job_title_aliases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS member_profile_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS performance_role_configs_members_gin_idx
  ON public.performance_role_configs USING gin (member_profile_ids);

CREATE INDEX IF NOT EXISTS performance_role_configs_job_titles_gin_idx
  ON public.performance_role_configs USING gin (job_title_aliases);

