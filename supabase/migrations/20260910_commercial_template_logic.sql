-- Lógica condicional nos templates da Análise Comercial.
-- As regras usam o mesmo formato do módulo de Formulários e são copiadas para
-- o snapshot da coleta, preservando o fluxo histórico.

ALTER TABLE public.commercial_templates
  ADD COLUMN IF NOT EXISTS logic_rules jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.commercial_templates.logic_rules IS
  'Regras condicionais de navegação no formato LogicRule dos Formulários.';
