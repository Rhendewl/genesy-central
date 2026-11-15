# Agendamento de posts do Instagram

O diálogo de publicação oferece Agora ou Programar, com data e horário explícitos em America/Fortaleza (UTC−3). A antecedência mínima é de cinco minutos. Slides e legenda são uma cópia do momento da confirmação: alterações posteriores no projeto não modificam a publicação programada.

## Ativação

1. Aplicar somente `supabase/migrations/20261029170000_instagram_scheduled_posts.sql` no Supabase existente. Não executar o histórico inteiro de migrations.
2. Publicar na Vercel com o CRON_SECRET já usado pelos outros workers.
3. Aplicar `supabase/migrations/20261029171000_instagram_scheduled_posts_cron.sql`. O pg_cron do Supabase chama `/api/cron/instagram-posts` a cada minuto usando o segredo existente no Vault. Isso funciona com o plano Hobby da Vercel, que limita seus próprios crons a uma execução diária. Configurar INSTAGRAM_SCHEDULER_SECRET_SHA256 na Vercel com a impressão digital SHA-256 do segredo existente no Vault, sem copiar o segredo em texto claro. O endpoint também aceita CRON_SECRET quando disponível.

A fila é acessível somente pela service role. As rotas de consulta, criação e cancelamento verificam administrador e organização. O cron exige o segredo configurado; nenhum token do Instagram é enviado ao navegador.

## Operação

O worker assume uma publicação por execução, com trava atômica de dez minutos. Salva cada container criado e o container principal antes de publicar. Se uma confirmação se perder, consulta o mesmo container antes de repetir o envio. Um resultado incerto na criação de um container pode deixar um container não publicado; nunca se publica sem antes persistir seu identificador.

Imagens ficam no bucket criativos e recebem URLs temporárias apenas quando chega a hora do envio. Não são criados containers Meta no momento do agendamento. Após publicação ou cancelamento, os arquivos são removidos. Publicações com falha conservam os arquivos para diagnóstico. Há até oito tentativas com intervalo progressivo em erros; processamento normal do Instagram continua no próximo ciclo.

A lista do diálogo mostra as 30 publicações mais recentes por data programada, com conta, data, status e último erro. É possível cancelar somente antes do início do processamento. O horário indica início do processamento; filas ou processamento do Instagram podem atrasar a conclusão. A conta deve continuar conectada e autorizada na data escolhida.

## Validação

Testes cobrem agendamento sem envio imediato, conversão do horário de Fortaleza, rejeição de data passada, ordem das imagens, consulta de container já publicado e repetição após falha de confirmação. Não foi criado nenhum agendamento real nem postado conteúdo para testar.

## Calendário editorial

O agendador reconcilia a fila de envios com `marketing_contents` a cada ciclo, incluindo agendamentos anteriores à integração. O mesmo ID identifica um agendamento e sua publicação no calendário. Publicações imediatas e stories confirmados entram primeiro na fila durável com status publicado; isso permite recuperar a sincronização editorial após falha temporária sem repetir o post no Instagram.

Status: scheduled/publishing → Agendado, published → Publicado, cancelled → Cancelado, failed → Planejado com a falha registrada em notas. Publicados usam a data efetiva da confirmação; agendados usam a data escolhida. A comparação de valores evita reescrever registros inalterados a cada minuto. Os registros automáticos são somente leitura no calendário; o cancelamento acontece na Central do Instagram ou no diálogo do gerador. Os conteúdos planejados manualmente seguem o fluxo existente.

O contexto de Marketing atualiza ao concluir um envio/agendamento, ao voltar à janela e a cada minuto com a página visível. A sincronização do Instagram associa o ID da mídia ao conteúdo editorial e adiciona link e miniatura quando disponíveis, mantendo as métricas ligadas ao mesmo conteúdo.

Publicações imediatas anteriores ao armazenamento durável não podem ser identificadas com segurança como enviadas pelo app. Não se importam indiscriminadamente todos os posts da conta para evitar duplicar conteúdos manuais ou atribuir ao app posts feitos fora dele.

A Central do Instagram amplia esse fluxo para Reels e Stories, com prévia e agenda visual. Aplicar também a migration `20261114003000_instagram_studio.sql` antes de publicar essa versão. Consulte `docs/instagram-studio.md` para os formatos, limites e a retenção de miniaturas.
