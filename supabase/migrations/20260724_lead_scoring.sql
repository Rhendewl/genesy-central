-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Lead Scoring — IQ (Inteligência de Qualificação) e IE (Índice de
-- Evolução), dois indicadores independentes 0-100 por lead.
--
-- IQ: calculado uma vez a partir das respostas do formulário (nunca
-- recalculado automaticamente depois) — ver LeadScoreEngine.calculateIQ.
-- IE: recalculado automaticamente a cada mudança de etapa na Pipeline — ver
-- LeadScoreEngine.calculateIE.
--
-- Ambos nullable: null = "não aplicável" (formulário sem pergunta ponderada,
-- ou lead ainda sem etapa atribuída), não é o mesmo que 0.
-- ═══════════════════════════════════════════════════════════════════════════════

-- IF NOT EXISTS em cada passo — seguro rodar de novo caso uma execução
-- anterior tenha aplicado só parte disto.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS iq_score integer,
  ADD COLUMN IF NOT EXISTS ie_score integer;

DO $$ BEGIN
  ALTER TABLE public.leads ADD CONSTRAINT leads_iq_score_check CHECK (iq_score IS NULL OR (iq_score BETWEEN 0 AND 100));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.leads ADD CONSTRAINT leads_ie_score_check CHECK (ie_score IS NULL OR (ie_score BETWEEN 0 AND 100));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_iq_score ON public.leads (iq_score) WHERE iq_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_ie_score ON public.leads (ie_score) WHERE ie_score IS NOT NULL;
