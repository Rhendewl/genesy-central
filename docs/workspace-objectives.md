# Workspace: objetivos e etiquetas próprias

## Comportamento

- Amplia `/workspace/objetivos`, sem substituir registros existentes: CRUD, horizonte curto/médio/longo, status, prioridade, descrição, início/prazo, múltiplos responsáveis e hierarquia.
- Objetivos principais agregam etapas existentes e tarefas vinculadas dos descendentes. Cada tarefa conta uma vez dentro da árvore; o indicador geral deduplica tarefas entre árvores. A contagem respeita os dados visíveis pela RLS.
- Metas mensuráveis têm nome, unidade, valor inicial, alvo e valor atual. A porcentagem considera o deslocamento desde o inicial; aceita crescimento e redução e limita o mostrador a 0–100%. O valor atual não é truncado. Metas não modificam a execução ou o status do objetivo.
- Dashboard com contadores, próximos prazos, medidores `HalfDonutGauge` reutilizados do Dashboard Geral, distribuição por status e metas individuais. Não há série histórica temporal; os gráficos mostram o estado atual.
- Filtros de título, horizonte, status, responsável, prioridade, prazo e etiquetas. Múltiplas etiquetas usam interseção.
- Blocos possuem criação, renomeação e exclusão. Tarefas existentes podem ser vinculadas, movidas entre blocos e desvinculadas. Novas tarefas usam a API atual e o mesmo painel de edição, responsáveis, etiquetas, conclusão, comentários e anexos.
- `workspace_tags` é um catálogo independente por organização do Workspace, compartilhado apenas entre tarefas e objetivos. A migration copia somente etiquetas antigas referenciadas nesses recursos, mantendo IDs. CRM/Marketing continuam com `tags`; novas tarefas originadas no Marketing não herdam suas etiquetas.

## Banco e permissões

Aplicar **somente** `supabase/migrations/20261017120000_workspace_objective_planning.sql` no banco existente, antes de publicar o código. Não executar todo o histórico: o repositório tem migrations históricas incompletas documentadas em `instagram-automations.md`.

A migration é transacional e deve ser executada uma única vez. Acrescenta campos em `workspace_objectives` e cria `workspace_tags`, `workspace_objective_blocks`, `workspace_objective_task_links` e `workspace_objective_metrics`. Mantém etapas, comentários e anexos anteriores.

RLS reutiliza proprietário, responsável e administrador atuais. Atribuições e vínculos precisam pertencer à mesma organização; pai e filho à mesma área pessoal de Workspace. Há validação de datas, valores, etiquetas e bloqueio de ciclos no banco. Proprietário/criador do objetivo são imutáveis. A API verifica autorização antes de remover anexos na exclusão.

Excluir objetivo remove seus blocos, vínculos e metas; subobjetivos ficam independentes e tarefas não são excluídas por cascade. Excluir bloco deixa seus vínculos sem bloco. Tarefas concluídas vinculadas ficam excluídas da limpeza automática após 24h. Se perderem todos os vínculos, a retenção normal volta a valer. O Kanban mantém sua regra visual atual; os detalhes de objetivos continuam acessando as tarefas retidas.

## Validação e publicação

- `npm run lint` (avisos antigos do projeto podem permanecer).
- `npx tsc --noEmit`.
- `npm test` (116 arquivos / 1.117 testes no fechamento desta implementação).
- `npm run build` (precisa de acesso às fontes Google já usadas pelo projeto).
- `NODE_PATH=<node_modules com @electric-sql/pglite> node scripts/tests/workspace-objectives-db.mjs`: 12 cenários sobre migration, RLS, hierarquia, metadados e exclusões. Usa schema-base reduzido; não substitui homologação do schema real.
- Prévia visual dos componentes com dados fictícios conferida em desktop e 390px, sem overflow horizontal ou erros no console. A rota temporária foi removida; nenhuma fixture pública é entregue.

Publicação: aplicar migration, conferir tabelas/policies/cron no Supabase, realizar smoke test autenticado e então seguir o deploy por `main`/Vercel. O acesso Supabase disponível nesta execução expõe REST, mas nenhuma função SQL; a migration não foi aplicada e produção não foi atualizada. A versão não deve ser promovida antes da migration. Fluxos autenticados completos no banco real ainda precisam ser homologados.
