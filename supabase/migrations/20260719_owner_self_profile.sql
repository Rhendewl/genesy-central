-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Linha própria do dono em user_profiles (simetria de perfil pessoal)
--
-- Hoje só convidados têm linha em user_profiles; o dono é identificado
-- apenas pelo seu auth.uid(), sem um perfil pessoal simétrico (nome/foto/
-- cargo próprios). Isso obriga o código (CurrentMemberContext) a ramificar
-- toda hora em "sou dono, não tenho member row" vs "sou convidado, tenho".
--
-- Fix: todo dono existente ganha sua própria linha auto-referente
-- (owner_id = auth_user_id = seu próprio uid, role = 'admin'), e o trigger
-- de criação de conta passa a criar essa linha também para novos donos.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Backfill — todo auth.users sem NENHUMA linha em user_profiles ainda é,
--    por definição, um dono independente (convidados aceitos já têm sua
--    linha com auth_user_id preenchido pelo fluxo de convite).

INSERT INTO public.user_profiles (owner_id, auth_user_id, full_name, email, role, permissions, is_active)
SELECT
  au.id,
  au.id,
  COALESCE(
    (SELECT cp.owner_full_name FROM public.company_profile cp WHERE cp.user_id = au.id),
    split_part(au.email, '@', 1)
  ),
  au.email,
  'admin',
  '["dashboard","workspace","crm","clientes","financeiro","trafego","portais","formularios","configuracoes"]'::jsonb,
  true
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.auth_user_id = au.id
);
-- Sem ON CONFLICT: owner_id aqui é sempre um auth.users.id distinto por
-- linha (um dono novo por vez), não há como colidir dentro deste INSERT.
-- (O banco em produção não tem o UNIQUE(owner_id,email) que a migration
-- 007 previa — 20260426_complete_schema.sql recriou a tabela sem ele.)

-- 2. Trigger de criação de conta — também cria a linha self para novos donos --

CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  is_invited_member BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE email = NEW.email AND auth_user_id IS NULL
  ) INTO is_invited_member;

  -- Convidado aceitando o convite: não é um novo dono, não ganha linha self
  -- nem seed de dados (o UPDATE que liga auth_user_id acontece em /api/invite/accept).
  IF is_invited_member THEN
    RETURN NEW;
  END IF;

  -- Novo cadastro independente = novo dono: cria a linha self de perfil pessoal
  INSERT INTO public.user_profiles (owner_id, auth_user_id, full_name, email, role, permissions, is_active)
  VALUES (
    NEW.id, NEW.id,
    COALESCE(split_part(NEW.email, '@', 1), 'Usuário'),
    NEW.email,
    'admin',
    '["dashboard","workspace","crm","clientes","financeiro","trafego","portais","formularios","configuracoes"]'::jsonb,
    true
  );
  -- Sem ON CONFLICT aqui pelo mesmo motivo: NEW.id é sempre um auth.users.id
  -- recém-criado, nunca usado antes como owner_id.

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
  -- Nunca bloquear a criação da conta por falha no seeding/self-row
  RETURN NEW;
END;
$$;
