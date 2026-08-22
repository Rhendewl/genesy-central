# Automações do Instagram — auditoria e operação

## Estado encontrado antes desta implementação

### Implementado

- Aplicação Next.js 14 com rotas server-side e Supabase/Postgres multiusuário.
- O módulo Marketing resolve a organização pelo proprietário e libera leitura para membros ativos com a permissão `marketing`; somente proprietário/administrador gerencia conexões.
- Instagram orgânico conectado pelo **Instagram API with Instagram Login**.
- OAuth com `state` assinado e validade de 15 minutos.
- Token armazenado com AES-256-GCM (`TOKEN_ENCRYPTION_KEY`), nunca devolvido pela API do dashboard.
- Troca por token de longa duração, renovação próxima ao vencimento e sincronização de perfil, mídia e insights.
- Worker protegido por `CRON_SECRET` para a sincronização periódica.
- Integração Meta Ads/Lead Ads separada, pelo Facebook Login, com páginas, formulários e webhook `leadgen` para criação no CRM.
- Padrões reutilizáveis de fila, retry, lock expirado e dead letter já existiam nos webhooks de formulários.

### Não implementado anteriormente

- O OAuth orgânico solicitava somente `instagram_business_basic` e `instagram_business_manage_insights`.
- Não havia permissões de comentários ou mensagens, assinatura de `comments`/`messages`, receptor de webhook do objeto `instagram`, gatilhos, sequências ou respostas pela API.
- Não havia idempotência, fila durável, métricas nem vínculo CRM para interações orgânicas.
- O webhook existente em `/api/meta/webhook` processa apenas `object=page` e `field=leadgen`; ele não é um webhook de Instagram Direct.

### Anomalia histórica preservada

O arquivo `supabase/migrations/20260756_marketing_module.sql` contém somente o caractere `a`, embora as migrations posteriores e a aplicação dependam das tabelas `marketing_*`. Isso indica que o banco existente recebeu esse schema por outra execução/versão, mas um ambiente criado do zero apenas com o histórico atual não é reproduzível. O arquivo não foi reescrito nesta entrega porque reconstruir uma migration histórica sem um dump do schema implantado pode divergir da produção. Antes de preparar um ambiente novo, gere um schema dump do Supabase atual e recupere essa migration separadamente.

## Implementação adicionada

- Nova tela: `/marketing/automacoes`.
- Gatilhos suportados: comentário, mensagem recebida, resposta a story e postback de botão.
- Correspondência: contém, texto exato, prefixo ou qualquer texto; comparação ignora caixa, acentos e espaços repetidos.
- Resposta pública a comentário e uma resposta privada ao comentário.
- Sequências configuráveis para conversas iniciadas pelo usuário, limitadas à janela de 24 horas.
- Criação idempotente de oportunidade em uma pipeline/etapa do CRM.
- Persistência do evento antes de qualquer efeito externo e deduplicação por conta + ID do evento Meta.
- Jobs por etapa com agendamento, claim atômico, lock expirável, backoff, limite de tentativas e dead letter.
- Métricas por automação: gatilhos, ações concluídas, execuções concluídas e falhas/parciais.
- Assinatura `X-Hub-Signature-256` obrigatória no novo webhook quando o app secret está configurado.

### Dados da oportunidade no CRM

Cada automação pode configurar origem, responsável e valor inicial do negócio,
além da pipeline e etapa. As origens são compartilhadas com leads manuais e
formulários. O vínculo estruturado fica em `leads.origin_id`; o slug continua
espelhado em `leads.source` para preservar relatórios, CAPI e exportações.

## Dependências externas obrigatórias

O código não consegue concluir sozinho os itens abaixo; eles pertencem ao painel e ao processo de aprovação da Meta:

1. No Meta App Dashboard, habilitar **Instagram API with Instagram Login** para o app usado por `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET`.
2. Obter acesso adequado em App Review para:
   - `instagram_business_basic`
   - `instagram_business_manage_insights`
   - `instagram_business_manage_comments`
   - `instagram_business_manage_messages`
3. Configurar o callback do objeto Instagram como:
   - URL: `https://dash.genesycompany.com/api/marketing/instagram/webhook`
   - Verify token: o valor de `INSTAGRAM_VERIFY_TOKEN` (ou `META_VERIFY_TOKEN` como fallback)
4. Assinar no painel os campos `comments`, `messages`, `messaging_postbacks` e `messaging_seen`.
5. Reautorizar cada conta já conectada. Tokens antigos não ganham novos escopos automaticamente.
6. Confirmar no Instagram profissional que apps conectados podem acessar mensagens.
7. Aplicar as migrations `20260822_instagram_automations.sql` e `20260822_instagram_automations_cron.sql`.
8. Confirmar que o Vault contém `webhook_delivery_cron_secret` com o mesmo valor de `CRON_SECRET`. Se `pg_cron`/`pg_net` não estiverem disponíveis, chamar `/api/cron/instagram-automations` a cada minuto por um scheduler externo.
9. Aplicar `20260822050000_crm_lead_origins.sql` antes de usar os novos padrões de CRM.

## Variáveis necessárias

```text
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
INSTAGRAM_VERIFY_TOKEN=...
INSTAGRAM_GRAPH_VERSION=v24.0
TOKEN_ENCRYPTION_KEY=... # 64 caracteres hexadecimais
CRON_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`META_APP_ID`, `META_APP_SECRET` e `META_VERIFY_TOKEN` continuam funcionando como fallback, mas separar as credenciais do Instagram reduz o acoplamento com Meta Ads/Lead Ads.

## Limites da plataforma aplicados

- Um comentário permite apenas uma resposta privada e ela deve ser enviada dentro do prazo permitido pela Meta. Uma nova sequência só pode continuar depois que a pessoa responder no Direct.
- DMs comuns só são enviadas quando a conversa foi iniciada pelo usuário; a sequência configurada termina antes de 24 horas.
- O webhook pode ser entregue mais de uma vez. A chave única impede respostas ou leads duplicados.
- Eventos `is_echo`/`is_self` são ignorados para impedir loops.

Referência operacional oficial mantida pela Meta: [Instagram API collection](https://www.postman.com/meta/workspace/instagram/overview).
