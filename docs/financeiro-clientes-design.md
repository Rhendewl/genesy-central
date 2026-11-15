# Financeiro e Clientes — navegação e leitura de dados

## Organização

- Receitas e Despesas começam com a ação de cadastro e quatro indicadores do período. Os indicadores de status/tipo podem filtrar os lançamentos.
- No desktop, a evolução e a composição aparecem antes da tabela. No mobile, os lançamentos usam cards com ações visíveis, e filtros/análise abrem sob demanda sem perder estado.
- Os gráficos usam todos os dias do mês, incluindo dias sem lançamentos. Há visualizações diária e acumulada. Cancelados não entram no gráfico de receitas.
- A composição por tipo/categoria também funciona como filtro. O controle de privacidade remove as séries dos gráficos e mascara valores/percentuais.
- A navegação entre submódulos continua horizontal e o período permite escolher diretamente um mês. Os cadastros abrem em um portal para evitar que o contêiner do módulo limite ou recorte o modal.
- A visão geral de Clientes oferece cards de rentabilidade, tabela, busca e ordenação. Clientes inativos continuam acessíveis. A concentração usa o MRR total da carteira como denominador.
- Em Notas, criar pasta usa apenas o ícone `FolderPlus`, sem a superfície visual do botão anterior.

## Significado dos números

- Receitas do mês: valores lançados no período, exceto cancelados. Não representa necessariamente o caixa recebido.
- Recebido, pendente e atrasado respeitam o status já armazenado. A data de recebimento exibida nos cards é `paid_date`; a data de lançamento continua sendo `date`.
- Evolução: `date` dos lançamentos, não a data efetiva do pagamento. A descrição no gráfico explicita essa base.
- Rentabilidade dos clientes: mensalidade contratada menos os custos atribuídos no período, incluindo parceiros. É apresentada como resultado estimado. O valor efetivamente recebido deve ser consultado em Receitas.
- Resumos e gráficos representam o período completo; os filtros operacionais limitam os lançamentos e a listagem de clientes.

## Verificação

- `npx vitest run src/components/financeiro/__tests__/FinancialRedesign.test.ts`
- `npm run build`
- Revisão visual dos componentes renderizados com dados fictícios no desktop, em 390×844 e em 320×700.
- Sem alteração de APIs, permissões ou migração SQL.
