# Central do Instagram

O endereço `/marketing/automacoes` agora abre a Central do Instagram. A integração e as regras existentes de comentários, Direct e CRM são reaproveitadas.

## Ativação

1. Aplicar no SQL Editor do Supabase a migration `supabase/migrations/20261114003000_instagram_studio.sql` **antes do deploy**. Ela adiciona o tipo de mídia, os tipos dos arquivos e a miniatura à fila já existente, preservando registros anteriores.
2. Publicar a aplicação com o fluxo habitual (`npx vercel --prod --yes`).
3. Conferir a conta na central. Caso a permissão `instagram_business_content_publish` esteja ausente ou o token vencido, reconectar a conta.
4. O agendamento reutiliza `/api/cron/instagram-posts` e o job do Supabase configurado em `20261029171000_instagram_scheduled_posts_cron.sql`. Não cria outro cron. Se essa configuração anterior ainda não estiver instalada, seguir `docs/instagram-scheduled-posts.md`.

## Experiência

- Visão geral por conta, atalhos de formato, próximos envios e resumo das automações.
- Biblioteca com busca na legenda, filtros de status/formato e acesso às publicações sincronizadas no Instagram.
- Agenda mensal dos envios criados na plataforma; seleção de um dia abre sua lista. Publicações feitas fora da plataforma ficam na biblioteca sincronizada, não na agenda de envios.
- Criação com conta, arquivos, enquadramento, ordem de slides, legenda, texto alternativo e revisão obrigatória antes da confirmação.
- Reprogramação e cancelamento enquanto o envio ainda não foi adquirido pelo processamento.
- Automações existentes com palavras-chave, respostas públicas, Direct e criação de oportunidade no CRM.
- Datas e horários de publicação são interpretados em Fortaleza (UTC−3).

## Formatos disponíveis nesta versão

- Foto: uma imagem, preparada em JPEG 1080×1350.
- Carrossel: 2–10 imagens na ordem escolhida, todas em JPEG 1080×1350.
- Reel: um MP4 vertical 9:16, H.264/AAC, até 50 MB e de 3 segundos a 15 minutos, compartilhado também no feed.
- Story: uma imagem JPEG 1080×1920 ou um MP4 vertical 9:16, até 50 MB e de 3 a 60 segundos.

Imagens de origem podem ser JPG, PNG ou WebP de até 25 MB. A preparação oferece preservar a imagem inteira com fundo escuro ou preencher com recorte ao centro. A prévia usa o arquivo preparado. Os vídeos devem conter a edição final, incluindo áudio, textos e efeitos; a central não inclui editor de vídeo, biblioteca musical ou stickers interativos. A identificação de um Story é interna e não é sobreposta à mídia.

## Envio e consistência

Os arquivos vão diretamente para o Storage com URLs de upload assinadas, evitando o limite de corpo de requisição da hospedagem. O servidor valida conta/organização, autor, assinatura, tamanhos e dimensões JPEG antes de gravar a fila. O conteúdo de vídeo é validado pelo navegador e, na publicação, pelo Instagram; o servidor confere o tamanho e o MIME registrado no Storage.

“Publicar agora” entra na mesma fila durável com vencimento imediato. O processamento começa no próximo ciclo do cron (normalmente a cada minuto), mais o tempo de processamento do Instagram. O painel só mostra “Publicado” após a confirmação da fila. Não depende do navegador permanecer aberto.

O ticket assinado e o ID da publicação são reutilizados ao verificar um envio cuja resposta foi interrompida. O worker mantém checkpoints dos containers e consulta `PUBLISHED` antes de tentar publicar novamente. Não há reenvio automático com novos containers para posts que já tenham um container persistido.

As mídias originais são removidas após a publicação; a miniatura preparada permanece para o histórico. Cancelar um agendamento remove também essa miniatura. Envios antigos podem não ter miniatura. A biblioteca carrega até 100 registros recentes por fonte; os totais indicam os registros carregados, não o histórico completo da conta. Administradores gerenciam a fila; membros com acesso a Marketing veem o conteúdo sincronizado e as regras conforme as permissões existentes.

Uploads que forem abandonados antes de gravar a fila não têm limpeza automática nesta alteração.

## Validação

Testes locais cobrem formatos, fuso horário, limites, autoria/organização, acesso administrativo, arquivos divergentes, idempotência, bloqueio de reprogramação durante processamento, troca de contas, revisão antes do envio, retry da confirmação e os containers de Reel/Story. Não foram realizadas publicações reais no Instagram como teste.
