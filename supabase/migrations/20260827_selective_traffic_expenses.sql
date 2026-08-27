-- Contas de anúncios alimentam o módulo de Tráfego por padrão. Somente contas
-- escolhidas explicitamente também devem gerar despesas no Financeiro.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ad_platform_accounts'
      AND column_name = 'include_in_expenses'
  ) THEN
    ALTER TABLE public.ad_platform_accounts
      ADD COLUMN include_in_expenses boolean NOT NULL DEFAULT false;

    -- Remove lançamentos criados pela assimilação automática anterior. Eles
    -- serão recriados apenas para as contas habilitadas explicitamente.
    DELETE FROM public.expenses
    WHERE auto_imported = true
      AND external_ref LIKE 'meta::%';
  END IF;
END $$;

COMMENT ON COLUMN public.ad_platform_accounts.include_in_expenses IS
  'Quando true, o investimento desta conta de anúncios é sincronizado como despesa financeira.';
