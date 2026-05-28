-- Migration 033: Adicionar workflow_json e tornar campos opcionais
-- Necessário para o fluxo de criação rápida (apenas nome) no canvas

-- 1. Torna campos opcionais (removendo NOT NULL)
ALTER TABLE criativo_projetos
  ALTER COLUMN objetivo DROP NOT NULL,
  ALTER COLUMN publico  DROP NOT NULL,
  ALTER COLUMN oferta   DROP NOT NULL;

-- 2. Adiciona coluna workflow_json para armazenar o grafo do canvas
ALTER TABLE criativo_projetos
  ADD COLUMN IF NOT EXISTS workflow_json JSONB DEFAULT NULL;
