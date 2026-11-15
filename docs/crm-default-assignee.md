# Responsável padrão por pipeline

Configuração em CRM → Pipelines → Criar/Editar → Responsável padrão dos leads. O campo aceita usuários ativos do mesmo workspace, com login associado. O usuário selecionado precisa ter acesso à pipeline; esta configuração não altera permissões de acesso.

A coluna `crm_pipelines.default_assignee_id` é aplicada por um trigger BEFORE INSERT em leads, depois da normalização de proprietário/etapa e antes dos triggers AFTER INSERT e dos eventos do serviço. O fluxo abrange leads manuais, formulários, Meta, Instagram e outras integrações que gravam nessa tabela. Uma atribuição explícita, inclusive a configuração específica de uma integração, tem prioridade sobre o padrão. A regra não altera o responsável ao atualizar um lead existente ou ao mover etapas.

Cópias para outra pipeline usam primeiro o responsável explicitamente escolhido, depois o padrão da pipeline de destino e, na ausência dele, o fallback anterior. O histórico de atribuição e os registros de atividade mantêm os responsáveis efetivos; atribuição não é tratada como contato ou primeira interação.

Aplicar somente `supabase/migrations/20261029200000_crm_pipeline_default_assignee.sql`, seguido de publicação na Vercel. Não executar todo o histórico de migrations. A migração é independente da separação de etiquetas, que permanece protegida por NEXT_PUBLIC_CRM_PIPELINE_TAGS_ENABLED e depende de aprovação própria.

## Configuração autorizada de Ana Maria

Em 29/10/2026, a pipeline Ana Maria foi configurada com a usuária Ana Maria como padrão. Os 17 leads existentes da mesma pipeline e workspace receberam essa responsável, conforme pedido explícito. Não foram alterados os responsáveis de outras pipelines, nem os registros históricos de quem realizou atividades anteriores. Backup local dos identificadores/responsáveis anteriores em `/private/tmp/crm-ana-maria-assignment-before.json`.

## Validação

`scripts/tests/crm-default-assignee-db.mjs` executa PostgreSQL local temporário e confirma que os observadores AFTER INSERT recebem o responsável, preserva escolhas explícitas, valida proprietário/usuário ativo, cobre inserções com etapa e sem pipeline explícita, preserva leads anteriores e testa cópias entre pipelines. TypeScript e lint verificam os componentes e rotas.
