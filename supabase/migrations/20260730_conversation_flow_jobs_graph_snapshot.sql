-- ═══════════════════════════════════════════════════════════════════════════════
-- Conversas — congela o grafo (nodes + edges) de um fluxo no momento em que o
-- job é criado.
--
-- Sem isso, um job em espera que resume depois de o usuário editar o fluxo
-- (mover/apagar node, reconectar edge) leria o grafo ATUAL, não o que existia
-- quando o job foi enfileirado — a execução em andamento mudaria de
-- comportamento no meio do caminho. graph_snapshot congela { nodes, edges }
-- por job; nullable para não exigir backfill dos jobs já existentes (o
-- executor cai no comportamento atual — consulta ao vivo — quando null).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.conversation_flow_jobs
  ADD COLUMN IF NOT EXISTS graph_snapshot jsonb;
