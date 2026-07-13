-- ═══════════════════════════════════════════════════════════════════════════════
-- Performance — motor configurável por cargo
--
-- Cada cargo passa a ter uma regra própria para definir:
-- - objetivo principal e meta mensal;
-- - pesos da nota;
-- - pipeline/etapas do CRM que contam como reunião ou venda.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.performance_role_configs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key              text        NOT NULL CHECK (role_key IN ('gestor_trafego','sdr','closer','bdr','designer')),
  role_label            text        NOT NULL,
  main_goal_type        text        NOT NULL CHECK (main_goal_type IN (
                                'crm_stage_count',
                                'crm_won_count',
                                'workspace_completed_tasks',
                                'traffic_iq_average',
                                'traffic_leads',
                                'traffic_conversions'
                              )),
  main_goal_label       text        NOT NULL,
  main_goal_target      numeric     NOT NULL DEFAULT 1 CHECK (main_goal_target >= 0),
  weight_resultado      numeric     NOT NULL DEFAULT 50 CHECK (weight_resultado >= 0),
  weight_produtividade  numeric     NOT NULL DEFAULT 20 CHECK (weight_produtividade >= 0),
  weight_organizacao    numeric     NOT NULL DEFAULT 15 CHECK (weight_organizacao >= 0),
  weight_disciplina     numeric     NOT NULL DEFAULT 15 CHECK (weight_disciplina >= 0),
  crm_pipeline_id       uuid        REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
  meeting_stage_ids     uuid[]      NOT NULL DEFAULT '{}',
  sales_stage_ids       uuid[]      NOT NULL DEFAULT '{}',
  is_active             boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_key)
);

CREATE INDEX IF NOT EXISTS performance_role_configs_user_idx
  ON public.performance_role_configs (user_id, role_key);

ALTER TABLE public.performance_role_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS performance_role_configs_select ON public.performance_role_configs;
DROP POLICY IF EXISTS performance_role_configs_insert ON public.performance_role_configs;
DROP POLICY IF EXISTS performance_role_configs_update ON public.performance_role_configs;
DROP POLICY IF EXISTS performance_role_configs_delete ON public.performance_role_configs;

CREATE POLICY performance_role_configs_select ON public.performance_role_configs
  FOR SELECT USING (public.effective_owner_id() = user_id);

CREATE POLICY performance_role_configs_insert ON public.performance_role_configs
  FOR INSERT WITH CHECK (
    public.effective_owner_id() = user_id
    AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
  );

CREATE POLICY performance_role_configs_update ON public.performance_role_configs
  FOR UPDATE USING (
    public.effective_owner_id() = user_id
    AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
  );

CREATE POLICY performance_role_configs_delete ON public.performance_role_configs
  FOR DELETE USING (
    public.effective_owner_id() = user_id
    AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
  );

SELECT public.ensure_updated_at_trigger('performance_role_configs');

