-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Usuário edita o próprio perfil (nome/foto/cargo), sem poder
-- alterar papel/permissões/status/dono de si mesmo.
--
-- Hoje UPDATE em user_profiles só é permitido para o dono da conta
-- (auth.uid() = owner_id). Isso impede qualquer usuário — dono ou convidado
-- — de editar seu próprio nome/foto/cargo diretamente.
--
-- Fix: adiciona uma segunda política de UPDATE permitindo
-- auth.uid() = auth_user_id (o próprio usuário editar sua linha), reforçada
-- por um trigger BEFORE UPDATE que reverte as colunas privilegiadas (role,
-- permissions, is_active, owner_id) para o valor antigo sempre que quem
-- está editando não é o dono da conta — proteção no banco, não só na API.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "user_profiles_update_self" ON public.user_profiles;
CREATE POLICY "user_profiles_update_self" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM OLD.owner_id THEN
    NEW.role        := OLD.role;
    NEW.permissions := OLD.permissions;
    NEW.is_active   := OLD.is_active;
    NEW.owner_id    := OLD.owner_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.user_profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();
