# Objetivos BSC

O módulo evolui a implementação existente, com base no vídeo fornecido pelo usuário e na preferência confirmada em 20/10/2026: metas acumuladas por objetivo; mês somente como filtro de objetivos.

## Modelo e interface

- Quatro perspectivas: Financeira, Clientes, Processos internos, Aprendizado e crescimento. Objetivos antigos ficam sem perspectiva até classificação explícita.
- Mapa com uma linha por perspectiva, medidor de atingimento, cartões de objetivos e criação dentro da perspectiva. Detalhes abrem no painel lateral existente.
- Cada objetivo contém vários indicadores, cada um com descrição, unidade, valor inicial, meta e realizado acumulado. Salvar altera somente esse indicador; trocar o mês não modifica seus valores.
- Média dos indicadores forma o atingimento do objetivo; média dos objetivos forma o atingimento da perspectiva; média das perspectivas medidas forma o BSC geral. Pesos iguais em cada nível. Cancelados e objetivos sem indicadores não entram nas médias; a cobertura fica explícita.
- Metas de aumento e redução usam `(realizado - inicial)/(meta - inicial)`, limitado de 0 a 100%. Superar uma meta não compensa o não atingimento de outra. Valores reais são preservados integralmente.
- Subobjetivos continuam com sua hierarquia; cada objetivo com indicador participa uma vez da perspectiva em que foi classificado. Resultados não são automaticamente somados ao pai, evitando dupla contagem.
- O mês seleciona objetivos cuja faixa início/prazo intersecta aquele mês. Data ausente é uma ponta aberta; sem ambas as datas o objetivo aparece em todos os meses. Limpar filtros mostra todos os períodos. A tela mostra o resultado acumulado atual desses objetivos, não uma fotografia histórica.
- Gráficos: medidores HalfDonutGauge existentes do Dashboard Geral, barras de atingimento por perspectiva, cobertura de indicadores; aba Execução e lista mantém contadores, prazos, distribuição de status e execução por objetivo.
- Tarefas estratégicas são tarefas atuais vinculadas a objetivos. Painel da tarefa permite vincular/desvincular. No objetivo há botão mostrar/ocultar concluídas. A proteção contra limpeza das tarefas vinculadas já existia na migration anterior. Desvincular de todos os objetivos restaura a retenção operacional; não foi alterada a exclusão automática das tarefas comuns.
- Etiquetas seguem exclusivas de tarefas/objetivos. Autenticação, responsáveis, hierarquia, comentários, anexos e demais permissões existentes são reutilizados.

## Migration

`20261020130000_workspace_bsc.sql` acrescenta `workspace_objectives.perspective` e `workspace_objective_metrics.description`.

O arquivo já foi entregue e aplicado pelo usuário enquanto a escolha entre métricas mensais e acumuladas estava pendente. Por isso também contém `workspace_objective_metric_periods`, RLS e trigger de validação. Após a escolha por metas acumuladas, a aplicação não consulta nem grava essa tabela. Ela permanece sem uso para evitar remover estrutura ou dados já aplicados; não é necessário executar outro SQL. O arquivo aplicado não foi reescrito.

RLS dos objetivos/indicadores permanece a existente. A nova tabela tem isolamento por acesso ao objetivo. Não foram criadas políticas permissivas para usuários anônimos.

## Validação

- Testes da aplicação: 1.123 testes, 117 arquivos (inclui médias, redução de meta, ausência de indicadores, cancelamento e filtro de vigência).
- Teste PGlite: 16 cenários, incluindo isolamento entre empresas e validação da migration; schema-base reduzido, não substitui teste integral do banco de produção.
- Lint, typecheck e build de produção passaram. Avisos anteriores do lint continuam.
- Prévia visual usa dados fictícios e é removida antes da publicação; desktop e celular são conferidos.
- Supabase: novos campos confirmados por leitura REST; consultas anônimas não retornam linhas. Não foram criados objetivos de teste na produção.
