-- Nome pessoal do dono da conta — usado no cumprimento do Dashboard Geral
-- ("Bom dia, {nome}"). Dono não tem linha em user_profiles (só membros de
-- equipe convidados têm), então não há hoje nenhum lugar com esse nome.
ALTER TABLE public.company_profile ADD COLUMN IF NOT EXISTS owner_full_name text;
