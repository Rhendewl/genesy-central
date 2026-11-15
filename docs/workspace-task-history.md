# Histórico de tarefas do Workspace

A partir desta alteração, conclusão não exclui tarefas. A tarefa fica em Concluído por 24 horas desde completed_at e então aparece na coluna virtual Ocultas, inicialmente escondida. A coluna é revelada por Mostrar ocultas. O status real continua concluido, preservando métricas, vínculos de objetivos, checklist, comentários e anexos. Reabrir a tarefa a devolve ao quadro ativo; concluir novamente inicia um novo prazo de 24 horas.

A rotina pg_cron workspace-completed-task-cleanup deve ser desativada com `supabase/migrations/20261029210000_workspace_preserve_completed_tasks.sql` antes de publicar. Não existe um novo processo de exclusão automática. Descartar continua sendo uma exclusão explícita com as permissões existentes.

O Workspace carrega o histórico com include_history=1, respeitando usuário, board e RLS. O endpoint lê todas as páginas e agrupa as consultas de responsáveis. As outras áreas continuam recebendo somente tarefas ativas/recentemente concluídas por padrão, sem alterar os indicadores existentes. O quadro recalcula a visibilidade a cada 30 segundos enquanto aberto.

A busca abrange título, descrição e notas, sem exigir acentos. O período personalizado pode usar criação, conclusão ou prazo, com início e fim inclusivos no horário de Fortaleza. Selecionar um período revela também a coluna Ocultas. Os detalhes mostram criação e conclusão; para registros legados sem completed_at, informa que a data não foi registrada, sem inventar uma data. Reordenar na coluna Concluído preserva completed_at.

Tarefas já apagadas pela limpeza anterior não podem ser reconstruídas por esta alteração. A preservação vale para os registros ainda existentes e para as novas tarefas.
