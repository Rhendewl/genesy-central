# Workspace mobile

- As abas de submódulos permanecem horizontais e roláveis. A seleção de membro ocupa um botão com nome acessível, e o aviso de atuação em nome de outro membro continua visível.
- Em Tarefas, a primeira linha reúne o workspace selecionado, busca, opções e criação. A gestão de workspaces, Kanban/lista por ícones, histórico, notificações e filtros ficam sob demanda no celular. No desktop, os controles continuam expostos.
- Fechar a busca ou as opções apenas oculta os controles: filtros, busca, visualização e histórico permanecem selecionados. Trocar de workspace mantém o comportamento existente de seleção e persistência.
- Objetivos e Onboarding usam uma barra compacta com criação e opções. Notas mantém busca e criação em uma linha. Cabeçalhos repetidos do módulo ficam acessíveis sem ocupar espaço visual no mobile.
- Nenhuma migração SQL ou alteração de permissões. A gestão dos workspaces continua condicionada a `canManage`.

## Verificação

- Testes de preservação de filtros e busca, alternância de visualização, criação, seleção de workspace, permissões, histórico e navegação por abas.
- Revisão visual dos controles e cards reais renderizados com dados fictícios em 320×700 e 390×844, com opções abertas e recolhidas.
- `npx vitest run src/components/workspace/__tests__/WorkspaceMobile.test.ts src/lib/workspace/__tests__/task-filters.test.ts src/lib/workspace/__tests__/task-board.test.ts`
- `npm run build`
