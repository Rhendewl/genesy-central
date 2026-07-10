-- ═══════════════════════════════════════════════════════════════════════════════
-- Remove o módulo Conversas por completo — decisão do produto de descontinuar
-- o módulo (WhatsApp/Fluxos). Isso é DESTRUTIVO: apaga permanentemente todo
-- histórico de conversas, mensagens e fluxos já criados. Não há como desfazer
-- depois de aplicado (a não ser restaurando de um backup do Supabase).
--
-- Não edita as migrations históricas do módulo (20260708_conversations_module,
-- 20260709_conversations_permissions, 20260730/31/32) — só desfaz o que elas
-- fizeram, nesta migration nova.
--
-- Depois de aplicar esta migration:
--   1. Apague/pause manualmente o serviço "whatsapp-qr-worker" no Railway —
--      esta migration não tem acesso a essa infraestrutura.
--   2. Se você criou o secret do Vault (conversation_flow_cron_secret) na
--      migration 20260732, pode remover com:
--        select vault.delete_secret(id) from vault.secrets
--        where name = 'conversation_flow_cron_secret';
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Cron: desagenda o executor de fluxos.
DO $$
BEGIN
  PERFORM cron.unschedule('conversation-flow-jobs-tick');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 2. Tabelas — CASCADE cobre as FKs entre elas (jobs → nodes, messages →
-- flows/jobs, etc.) sem precisar acertar a ordem manualmente.
DROP TABLE IF EXISTS public.conversation_flow_logs         CASCADE;
DROP TABLE IF EXISTS public.conversation_flow_runs         CASCADE;
DROP TABLE IF EXISTS public.conversation_flow_jobs         CASCADE;
DROP TABLE IF EXISTS public.conversation_flow_edges        CASCADE;
DROP TABLE IF EXISTS public.conversation_flow_nodes        CASCADE;
DROP TABLE IF EXISTS public.conversation_flows             CASCADE;
DROP TABLE IF EXISTS public.conversation_messages          CASCADE;
DROP TABLE IF EXISTS public.conversation_threads           CASCADE;
DROP TABLE IF EXISTS public.conversation_contacts          CASCADE;
DROP TABLE IF EXISTS public.conversation_whatsapp_accounts CASCADE;

-- 3. Funções auxiliares criadas só para este módulo (confirmado: nenhuma
-- outra migration as usa).
DROP FUNCTION IF EXISTS public.can_access_profile_scope(uuid);
DROP FUNCTION IF EXISTS public.current_member_is_admin();
DROP FUNCTION IF EXISTS public.current_profile_id();

-- 4. Remove a permissão "conversas" que a migration 20260709 tinha adicionado
-- aos perfis existentes (não afeta o ROLE_DEFAULT_PERMISSIONS de novos
-- convites, que já foi atualizado no código).
UPDATE public.user_profiles
SET permissions = permissions - 'conversas'
WHERE permissions ? 'conversas';
