-- ═══════════════════════════════════════════════════════════════════════════════
-- Conversas — idempotência na criação de jobs de fluxo.
--
-- enqueueConversationTrigger() fazia um INSERT incondicional: um retry do
-- EventBus, ou uma reentrega de webhook do WhatsApp, podia criar jobs
-- duplicados para o mesmo evento — e portanto mensagens duplicadas. Índice
-- parcial: linhas com dedupe_key NULL (ex.: job de "Testar fluxo") nunca são
-- restringidas por ele.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.conversation_flow_jobs
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS conversation_flow_jobs_dedupe_uq
  ON public.conversation_flow_jobs (flow_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
