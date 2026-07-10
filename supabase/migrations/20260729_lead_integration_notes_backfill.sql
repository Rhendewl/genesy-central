-- ═══════════════════════════════════════════════════════════════════════════════
-- Backfill — aplica a separação notes/integration_notes (20260728) aos leads
-- que já existiam antes da mudança.
--
-- Antes de 20260728, tanto observações manuais quanto o texto composto
-- automaticamente por Formulários e Agendamentos caíam no mesmo campo
-- `notes`. Não é possível separar retroativamente as duas origens dentro de
-- um mesmo texto já misturado — então este backfill só move `notes` para
-- `integration_notes` (e limpa `notes`) nos leads cuja ÚNICA origem possível
-- para o conteúdo atual é automática:
--   • form_id IS NOT NULL            → lead criado/atualizado por resposta de formulário
--   • existe appointment_booking     → lead criado/sincronizado por agendamento de calendário
--
-- CAVEAT: se alguém já tinha editado manualmente as "Notas" desses leads
-- específicos antes desta migration (via modal do CRM), esse texto manual
-- também será movido para integration_notes junto com o automático — não há
-- como distinguir os dois depois que já foram salvos juntos. Leads sem
-- form_id e sem agendamento (fonte manual, meta_lead_ads, etc.) não são
-- tocados por este backfill.
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.leads
SET integration_notes = notes,
    notes             = NULL
WHERE notes IS NOT NULL
  AND integration_notes IS NULL
  AND (
    form_id IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.appointment_bookings b WHERE b.lead_id = leads.id
    )
  );
