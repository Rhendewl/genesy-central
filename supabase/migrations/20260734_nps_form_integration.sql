-- ═══════════════════════════════════════════════════════════════════════════════
-- Formulários de NPS — adiciona 'nps' como adapter válido em form_integrations.
--
-- form_integrations.adapter tem um CHECK constraint criado inline na tabela
-- (nome auto-gerado pelo Postgres, não necessariamente
-- "form_integrations_adapter_check" — a tabela foi recriada uma vez no
-- histórico, ver 20260626_phase7_responses_center.sql). Em vez de arriscar
-- um DROP CONSTRAINT com o nome errado (que silenciosamente não faria nada),
-- localiza o constraint de verdade pelo catálogo do Postgres antes de trocar.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  existing_constraint text;
BEGIN
  SELECT con.conname INTO existing_constraint
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'form_integrations'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%adapter%';

  IF existing_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.form_integrations DROP CONSTRAINT %I', existing_constraint);
  END IF;

  ALTER TABLE public.form_integrations
    ADD CONSTRAINT form_integrations_adapter_check
    CHECK (adapter IN ('meta-pixel', 'ga4', 'webhook', 'crm', 'nps'));
END $$;
