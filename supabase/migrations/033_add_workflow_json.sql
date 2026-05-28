-- ─────────────────────────────────────────────────────────────────────────────
-- Lancaster SaaS — Migration 033: Adiciona workflow_json em criativo_projetos
-- ─────────────────────────────────────────────────────────────────────────────
-- Armazena o grafo executável (nodes + edges) de cada projeto.
-- Esse JSON é a fonte de verdade da engine de execução.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE criativo_projetos
  ADD COLUMN IF NOT EXISTS workflow_json JSONB DEFAULT NULL;

-- Remove campos que eram exclusivos do wizard e não fazem sentido no canvas
-- (objetivo, publico, oferta, tom, estilo_visual, segmento agora vivem
--  dentro de nodes específicos do workflow)
-- Mantemos os campos por compatibilidade mas deixam de ser obrigatórios.
ALTER TABLE criativo_projetos
  ALTER COLUMN objetivo DROP NOT NULL,
  ALTER COLUMN publico   DROP NOT NULL,
  ALTER COLUMN oferta    DROP NOT NULL;
