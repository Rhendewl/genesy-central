-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 021: Fix on_auth_user_created trigger for invited team members
--
-- Problem: the trigger runs for every new auth.users row, including invited
-- team members created via admin.auth.admin.createUser(). If any INSERT
-- inside the trigger fails (e.g. categories.type CHECK constraint rejecting
-- 'ambos', or a UNIQUE violation), the entire user creation is rolled back
-- and Supabase returns "Database error creating new user".
--
-- Fix:
--   1. Wrap inserts in EXCEPTION so trigger never blocks user creation.
--   2. Add ON CONFLICT DO NOTHING to both inserts.
--   3. Skip seeding entirely if the new user is a known invited member
--      (their email already exists in user_profiles with auth_user_id = NULL).
--   4. Update categories type constraint to include 'ambos'.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Fix categories type constraint to include 'ambos' ---------------------------
DO $$
BEGIN
  ALTER TABLE public.categories
    DROP CONSTRAINT IF EXISTS categories_type_check;
  ALTER TABLE public.categories
    ADD CONSTRAINT categories_type_check
    CHECK (type IN ('receita', 'despesa', 'ambos'));
EXCEPTION WHEN OTHERS THEN
  NULL; -- constraint may already be correct
END;
$$;

-- 2. Update trigger function -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  is_invited_member BOOLEAN;
BEGIN
  -- Check if this auth user was created from an invite (already in user_profiles)
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE email = NEW.email AND auth_user_id IS NULL
  ) INTO is_invited_member;

  -- Skip default data seeding for invited team members — they belong to an owner's
  -- workspace and will see the owner's data, not their own.
  IF is_invited_member THEN
    RETURN NEW;
  END IF;

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
  -- Never block user creation due to seeding failures
  RETURN NEW;
END;
$$;
