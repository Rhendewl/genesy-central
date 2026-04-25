-- =============================================================================
-- Migration 002 — Adiciona campo deal_value à tabela leads
-- Aplicar no Supabase Dashboard > SQL Editor
-- =============================================================================

-- Adiciona a coluna deal_value (valor do negócio em reais)
-- numeric(14,2): suporta até R$ 999.999.999.999,99
-- default 0: compatível com registros antigos
alter table leads
  add column if not exists deal_value numeric(14,2) not null default 0
    check (deal_value >= 0);

-- Garante que registros anteriores tenham valor 0 (não null)
update leads set deal_value = 0 where deal_value is null;
