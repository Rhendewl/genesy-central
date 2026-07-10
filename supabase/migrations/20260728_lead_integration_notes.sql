-- ═══════════════════════════════════════════════════════════════════════════════
-- Leads — separa observações manuais (Conversas) dos dados automáticos de
-- integração (Formulários, Agendamentos).
--
-- Até aqui, `leads.notes` recebia tanto observações digitadas manualmente
-- (CRM, e agora o módulo Conversas) quanto o texto composto automaticamente
-- pela resposta de formulário e pelo agendamento de calendário — misturando
-- as duas origens no mesmo campo. `integration_notes` passa a ser o destino
-- exclusivo dos dados automáticos; `notes` continua sendo só observações
-- manuais.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS integration_notes text;
