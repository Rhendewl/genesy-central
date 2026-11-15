# Análise do CRM: chegada e tempo entre etapas

## Ativação

1. Aplicar `supabase/migrations/20261113120000_crm_arrival_and_stage_timing.sql` no banco de produção antes do deploy.
2. Publicar o código. A aba `Leads` passa a se chamar `Análise do CRM`; o id interno `leads` permanece compatível.
3. Verificar uma chegada Meta, mover um lead entre duas etapas personalizadas e conferir o histórico na ficha e na análise da pipeline.

A migração foi testada em PostgreSQL local com PGlite. Ela não foi aplicada automaticamente ao banco online.

## Definições

- `leads.received_at`: instante original de chegada, independente da data comercial editável `entered_at`. Novas inclusões recebem o horário do banco por padrão. Meta preserva `created_time` da API ou do webhook, inclusive numa recuperação tardia; a data comercial usa America/Fortaleza.
- Registros antigos ficam com hora desconhecida, salvo quando o evento original da Meta permite recuperá-la. Não usar `updated_at`, a hora de uma tentativa de entrega ou meia-noite como chegada.
- `crm_lead_stage_history`: histórico existente com `moved_at`; a RPC transacional também registra `from_stage_id`, incluindo etapas sem coluna legada. O banco mantém os mesmos controles de proprietário/RLS.
- Primeiro atendimento: primeira passagem da etapa inicial para a próxima etapa ativa de atendimento, com uma amostra por lead e início na chegada original. Descartes, saltos e saídas após retornos não contam como primeiro atendimento. É um indicador de processo, não uma confirmação de conversa. Sem chegada conhecida, o avanço é preservado e o tempo fica desconhecido. O cartão da etapa inicial usa exatamente essas mesmas amostras e a mesma medida selecionada (média, mediana ou P90).
- Permanência concluída: tempo entre entrada e saída reais de uma etapa. Permanência em aberto: tempo desde a última entrada até agora. Vendas e perdas encerram a espera. Retornos geram novas passagens; salvamentos na mesma etapa não reiniciam a contagem.
- Mediana, média e P90 usam somente amostras medidas; a interface informa o tamanho da amostra. Lacunas no histórico não recebem tempos estimados.
- A seleção acompanha a coorte de chegada no período até o momento atual, e não apenas movimentos ocorridos durante o período. Filtros de pipeline e responsável são respeitados. A meta em minutos é uma referência local da análise, sem alterar automações.
- Tempos corridos, sem calendário de horário comercial. Datas e horas em America/Fortaleza.

## Validação

`node scripts/tests/crm-stage-timing-db.mjs`

`npx vitest run src/lib/crm/__tests__/operation-analytics.test.ts src/components/crm/__tests__/OperationAnalytics.test.ts src/components/crm/__tests__/LeadCardActivity.test.ts src/components/crm/__tests__/CrmListView.test.ts src/lib/__tests__/meta-lead-capture.test.ts`

`npx tsc --noEmit`

`npm run build`

## Revisão visual de 13/11/2026

O usuário informou que aplicou a migração SQL. Esta revisão de interface não adiciona outra migração.

- Tempo de saída apresentado em cartões por etapa, agrupados por pipeline. A média é a medida inicial; mediana e P90 ficam disponíveis no mesmo controle.
- Barras relativas por pipeline e destaque para a etapa com maior tempo de saída medido. Passagens concluídas e espera atual mantêm rótulos distintos.
- Cada cartão abre o detalhamento dos tempos e dos destinos observados. A tabela completa permanece recolhida para consulta.
- Período escolhido em um único calendário de intervalo, com início/fim por dois cliques, ordem inversa normalizada e atalhos de período.
- Pipeline com busca, seleção múltipla, cores e rótulo visível também no celular. Filtros preservados durante atualização dos dados.
- Comparação visual por responsável e fila de prioridade em cartões com tempo de espera, sem dar destaque a datas de entrada na visão geral.
- Layout revisado com dados fictícios em desktop e em viewport de 390 px. Testes de filtro de responsável, expansão de etapa, troca de medida, intervalo e seleção múltipla executados.

## Ajuste de consistência de 13/11/2026

- Cabeçalho e etapa inicial compartilham as mesmas amostras de primeiro atendimento. O histórico completo de saídas, inclusive retornos, continua disponível separadamente.
- Aguardando atendimento inclui todos os leads atualmente na primeira etapa. Em retornos, a espera e o alerta de atraso usam a última entrada, sem alterar o tempo histórico do primeiro atendimento.
- O cartão de meta exibe o prazo explicitamente (por exemplo, “Atendidos em até 15 min”) e informa a quantidade de primeiros atendimentos medidos. A meta é o limite selecionado no filtro, em tempo corrido.
- Expansão de etapa agora fica dentro do mesmo bloco do cartão, imediatamente abaixo do botão, com id acessível próprio; antes ficava após toda a grade da pipeline e podia aparecer fora da tela.
- Regressões testadas com média de 36 minutos e saídas adicionais muito longas, perdas, saltos, reentradas, fila atual e mudança do prazo. Nenhuma nova migração SQL.

## Navegação mobile compacta de 13/11/2026

- No celular, a navegação usa novamente abas horizontais com ícones, rolagem lateral e controle de privacidade dos valores. As opções continuam limitadas pelo perfil de acesso.
- No funil, a barra de navegação permanece no fluxo da página para não sobrepor os controles e as etapas.
- No funil, pipeline, quantidade de leads e atalhos para busca, opções e novo cadastro ficam em uma única linha. Busca e opções abrem sob demanda; fechar não desmonta os controles nem apaga busca, período ou visualização.
- Kanban/lista, período e configurações permanecem no painel de opções. O atalho “+” usa o mesmo cadastro existente. A busca recebe foco ao abrir.
- Filtros da análise também ficam recolhidos no celular, com resumo de pipeline/período. A versão desktop conserva suas barras de navegação e filtros.
- Verificação visual com dados fictícios em viewports de 320×700 e 390×844. Testes de navegação, preservação de estado e abertura de cadastro; sem nova migração SQL.

## Ajustes de filtros, cadastro e formulários Meta

- No mobile, a linha de opções mostra Kanban/lista por ícones, período e configurações, sem quebrar linha. Os ícones preservam nomes acessíveis e indicação da visualização selecionada.
- A janela de novo lead ocupa a área abaixo do dock superior, com rolagem interna até o botão de criação. Revisão visual em 320×700 com dados fictícios.
- Formulários Meta permitem definir um valor fixo por novo lead. A configuração é carregada novamente ao abrir a página e preserva responsável, destino e respostas. Novos títulos seguem `Nome do lead | Nome do formulário`; leads existentes permanecem inalterados.
- Aplicar `supabase/migrations/20261113193000_meta_form_deal_value.sql` antes de publicar. O valor padrão é zero e a configuração pode ser alterada ou zerada a qualquer momento.
