# Roletas de leads

CRM → Roletas permite criar e editar uma distribuição independente para cada formulário Genesy ou formulário Meta (identificado também pela página). Não há exclusão de roletas: pausar preserva a configuração, a sequência e as entradas pendentes.

1. Em Pipelines → Editar, defina o proprietário/responsável padrão de cada pipeline.
2. Para Meta, configure o formulário em Formulários Meta e mantenha a captura ativa.
3. Crie a roleta, escolha o formulário e uma etapa de entrada por pipeline participante.
4. Consulte o histórico e, após resolver uma indisponibilidade ou reativar uma roleta, use Reprocessar pendentes (até 25 por ação).

A roleta tem prioridade sobre o destino e responsável fixos do formulário. Formulários Genesy podem usar uma roleta sem integração CRM fixa. Outros campos configurados na integração (origem, tags, valor, sufixo e respostas) são preservados. Leads existentes não são redistribuídos. Alterar a composição ou ordem dos participantes reinicia a sequência; salvar sem alterar participantes preserva a posição.

## Garantias

- `crm_distribute_form_lead` bloqueia a linha da roleta antes de escolher o destino. Criação do lead, avanço da sequência, registro de distribuição, histórico inicial e vínculo da submissão Genesy pertencem à mesma transação.
- Idempotência por submissão Genesy ou `leadgen_id` Meta. Reenvios da mesma entrada não geram outro lead nem consomem outra vez. Isto não é deduplicação global por telefone/e-mail: novos formulários ou novas submissões podem representar novas oportunidades do mesmo contato.
- Pipeline, etapa e responsável são resolvidos no servidor e validados no mesmo workspace. A responsabilidade enviada no payload não substitui o proprietário da pipeline escolhida.
- Pipelines, etapas ou proprietários inativos são ignorados. Se ninguém estiver disponível ou a roleta estiver pausada, a entrada fica persistida como pendente. Não há encaminhamento para outra pipeline fora da roleta.
- Formulário Meta com captura desativada continua sem captar entradas; pausa da captura é diferente de pausa da roleta.
- Leitura e alteração de leads de roleta exigem acesso à pipeline e responsabilidade pelo lead, ou acesso administrativo. A RPC de cópia também verifica o responsável. Colaboradores não podem remover a identificação da roleta ou transferir esses leads para outro responsável/pipeline; administradores podem.
- O proprietário padrão recebe acesso à sua pipeline. A atribuição automática preexistente para leads manuais continua preservando um responsável explicitamente escolhido.
- Reprocessamentos utilizam o payload pendente atual, lido sob bloqueio, evitando sobrescrevê-lo com uma versão antiga carregada pela tela.

## Instalação e validação

Aplicar `supabase/migrations/20261116190000_crm_lead_roulette.sql` antes de publicar o código. Requer as migrations existentes do projeto, especialmente `20261029200000_crm_pipeline_default_assignee.sql`. A implementação não aplica migrations em produção e não publica o aplicativo automaticamente.

A RPC de ingestão é exclusiva de `service_role`. A RPC de configuração exige sessão administrativa. A API `/api/crm/roletas` verifica autenticação e administração antes de usar consultas de serviço, sempre limitadas ao proprietário do workspace.

Verificações locais:

- `node scripts/tests/crm-lead-roulette-db.mjs`: executa SQL em PostgreSQL embarcado (PGlite), cobrindo equilíbrio, roletas independentes, repetição, pendência, rollback, Meta, isolamento entre responsáveis, configuração administrativa e bloqueio de chamadas de ingestão por usuários comuns. PGlite serializa conexões; a proteção contra concorrência em produção depende do bloqueio de linha transacional PostgreSQL implementado na RPC.
- `node scripts/tests/crm-default-assignee-db.mjs`: regressão da atribuição preexistente.
- Vitest para CRM, formulários e captura Meta, incluindo configuração da tela e publicação do evento com o destino efetivamente distribuído.
- TypeScript e ESLint nos arquivos alterados.

Os eventos de automação são publicados depois do commit, seguindo o padrão atual de LeadService. Falha na publicação não desfaz a distribuição; não há outbox adicional nesta alteração. Falhas de ingestão antes de persistir a fila seguem a recuperação existente dos formulários/webhooks.

## Correção de carregamento em produção — 16/11/2026

O SQL estava aplicado no banco correto, com tabelas e permissões verificadas pelo SQL Editor. A leitura pela API retornava PGRST205 porque o cache do PostgREST não reconhecia as tabelas novas. `NOTIFY pgrst, 'reload schema'` não resolveu nesta instalação, repetindo o comportamento registrado durante a migração do servidor.

Foi feito force-update somente do serviço `supabase_supabase_rest` no Portainer, mantendo `postgrest/postgrest:v13.0.7`, com Re-pull image desmarcado. O serviço voltou a 1/1. Nenhuma credencial, permissão ou dado de lead foi alterado.

O atalho Roletas foi movido para depois de Formulários Meta. A API passou a registrar a consulta e o código de falha, substituindo o aviso genérico que sugeria incorretamente reaplicar a migration. Publicação: `dpl_5j45CNJT8ZaHqxBTNMVQpimMjcM2`.

Verificação final na sessão autenticada: Roletas carregou sem aviso, botão Nova roleta disponível e histórico vazio apresentado. Ordem confirmada: Formulários Meta → Roletas → Automações.


# Gestão de roletas — atualização

Implementação pronta; requer aplicar a migration 20261116210000_crm_roulette_management.sql antes da publicação. Exclusão lógica preserva histórico e leads, libera o formulário para outra roleta e impede apagar entradas pendentes. Ações de ativação independem da validação de destinos antigos. A migration substitui somente a restrição de unicidade das quatro colunas do formulário, preservando demais restrições; funções de distribuição mantêm transação e ignoram roletas excluídas.

Verificações: TypeScript, ESLint, testes da interface e testes de SQL PGlite (ativar/pausar, exclusão com pendências, preservação do histórico e reutilização do formulário).

A tentativa inicial de aplicar SQL no navegador foi rejeitada pela revisão automática devido à remoção ampla de restrições e alterações de funções. SQL revisado com alvo específico e definições explícitas. Nenhuma migration aplicada nesta atualização; aguarda aprovação ou aplicação pelo usuário. Não publicado.
