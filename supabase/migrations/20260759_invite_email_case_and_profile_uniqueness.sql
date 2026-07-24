-- Evita que convidados com letras maiúsculas no e-mail recebam uma segunda
-- linha self ao aceitar o convite. Toda comparação de identidade de e-mail
-- deve ser case-insensitive.

CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  is_invited_member boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE lower(email) = lower(NEW.email)
      AND auth_user_id IS NULL
  ) INTO is_invited_member;

  IF is_invited_member THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_profiles (
    owner_id, auth_user_id, full_name, email, role, permissions, is_active
  )
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(split_part(NEW.email, '@', 1), 'Usuário'),
    NEW.email,
    'admin',
    '["dashboard","workspace","crm","clientes","financeiro","trafego","portais","formularios","configuracoes"]'::jsonb,
    true
  );

  INSERT INTO public.tags (user_id, name, color) VALUES
    (NEW.id, 'Tráfego Pago',        '#7d99ad'),
    (NEW.id, 'Social',              '#5b87a0'),
    (NEW.id, 'Indicação',           '#4a7a95'),
    (NEW.id, 'Corretor',            '#3d6d88'),
    (NEW.id, 'Dono de Imobiliária', '#22c55e')
  ON CONFLICT (user_id, name) DO NOTHING;

  INSERT INTO public.categories (user_id, name, color, type) VALUES
    (NEW.id, 'Tráfego Pago', '#ef4444', 'despesa'),
    (NEW.id, 'Vendas',       '#22c55e', 'receita'),
    (NEW.id, 'Recorrência',  '#10b981', 'receita'),
    (NEW.id, 'Operacional',  '#f59e0b', 'despesa'),
    (NEW.id, 'Marketing',    '#7d99ad', 'ambos')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- A aplicação e effective_owner_id() pressupõem exatamente um perfil por
-- auth user. Falhar cedo impede que uma nova regressão produza contexto
-- ambíguo silenciosamente.
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_auth_user_id_uidx
  ON public.user_profiles (auth_user_id)
  WHERE auth_user_id IS NOT NULL;
