-- ═══════════════════════════════════════════════════════════════════════════════
-- Performance — participantes da gamificação
--
-- Mantém a seleção do pódio separada dos grupos/cargos de Performance.
-- A ausência de uma linha preserva o comportamento anterior (todos participam).
-- Uma linha com array vazio desativa o ranking para todos os colaboradores.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.performance_gamification_settings (
  user_id                  uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_profile_ids uuid[]      NOT NULL DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_gamification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS performance_gamification_settings_select
  ON public.performance_gamification_settings;
DROP POLICY IF EXISTS performance_gamification_settings_insert
  ON public.performance_gamification_settings;
DROP POLICY IF EXISTS performance_gamification_settings_update
  ON public.performance_gamification_settings;
DROP POLICY IF EXISTS performance_gamification_settings_delete
  ON public.performance_gamification_settings;

CREATE POLICY performance_gamification_settings_select
  ON public.performance_gamification_settings
  FOR SELECT USING (public.effective_owner_id() = user_id);

CREATE POLICY performance_gamification_settings_insert
  ON public.performance_gamification_settings
  FOR INSERT WITH CHECK (
    public.effective_owner_id() = user_id
    AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
  );

CREATE POLICY performance_gamification_settings_update
  ON public.performance_gamification_settings
  FOR UPDATE USING (
    public.effective_owner_id() = user_id
    AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
  );

CREATE POLICY performance_gamification_settings_delete
  ON public.performance_gamification_settings
  FOR DELETE USING (
    public.effective_owner_id() = user_id
    AND (auth.uid() = user_id OR public.is_admin_of_user(user_id))
  );

SELECT public.ensure_updated_at_trigger('performance_gamification_settings');
