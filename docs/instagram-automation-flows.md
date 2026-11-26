# Automações do Instagram em fluxos (nodes)

Evolução do submódulo de automações de comentários e Direct: a sequência linear de até 5 mensagens virou um **fluxo de blocos ligados**, editado num canvas dentro da Central do Instagram.

## Blocos

| Bloco | Saídas | O que faz |
|---|---|---|
| Gatilho | Em seguida | Mesmo gatilho de antes (comentário, DM, resposta a story, botão) + palavras-chave e resposta pública. Fica nas colunas da automação, para o webhook continuar casando pelo índice. |
| Mensagem | Em seguida, ou uma saída por botão "Continua o fluxo" (+ "Não tocou" opcional) | Texto com até 3 botões: link (`web_url`) ou resposta (`postback`). Botão de resposta pausa o fluxo até o toque. |
| Atraso | Em seguida | Agenda o próximo bloco para depois de N minutos/horas/dias. |
| Esperar resposta | Respondeu / Sem resposta | Pausa até o lead mandar uma DM ou até o tempo limite. A resposta fica em `variables.lastReply`. |
| Condição | Sim / Não | Última resposta contém (lista separada por vírgula), contato tem tag, lead veio de anúncio. |
| Ação | Em seguida | Cria/reaproveita oportunidade no CRM ou adiciona uma tag ao contato. |

Código compartilhado (servidor e navegador) em `src/lib/instagram-automation/flow/`: tipos, validação, conversão das automações antigas e regras de execução puras.

## Regras da Meta aplicadas

- **Comentário dá direito a uma única resposta privada.** A primeira mensagem alcançável a partir do gatilho sai como resposta privada; qualquer outra mensagem antes de uma interação (botão de resposta ou "Esperar resposta" → "Respondeu") é erro de validação.
- **Janela padrão de 24h** contada da última mensagem do lead no Direct (`contacts.last_message_at`). Comentários não abrem essa janela.
- **Janela de até 7 dias** para conversas iniciadas por anúncio Click to Direct: o webhook lê `referral.source = ADS` e grava `contacts.ad_window_until`.
- A validação avisa quando um atraso empurra a mensagem para além de 23h (só será entregue a leads de anúncio) e bloqueia além de 7 dias. Em execução, mensagens fora da janela são `skipped` e o fluxo termina.

## Execução

1. O webhook grava o evento e o contato. Antes de procurar automações, tenta **retomar um fluxo em espera** do contato:
   - toque em botão: o payload `igflow:<run>:<node>:<botão>` identifica o run e o ramo exato;
   - DM comum: retoma o run mais recente esperando `reply`.
   Toque em botão de um run que já seguiu adiante é ignorado (não dispara outra automação).
2. Um novo run guarda `flow_snapshot` (o fluxo da hora do disparo), então editar a automação não afeta quem já está no meio dela.
3. O worker executa um bloco por job (`action_type = flow_node`). Esperas criam um job `flow_timeout`, enfileirado **antes** de o run virar `waiting`; uma resposta cancela esse job. Esperas sem saída de timeout fecham o run em 7 dias.
4. Limite de 60 blocos executados por run (proteção contra laços).
5. Locks expirados: blocos que enviam mensagem (`trigger`, `message`) vão para `dead_letter` (entrega no máximo uma vez); os demais voltam para `retry`.

Automações salvas no editor antigo (`flow IS NULL`) são convertidas em tempo de execução por `legacyStepsToFlow`, com o mesmo comportamento. Jobs antigos já enfileirados (`public_reply`, `private_reply`, `dm`, `crm`) continuam sendo processados pelo caminho legado.

## Banco (`20261125210000_instagram_automation_flows.sql`)

- `marketing_instagram_automations.flow jsonb`
- `marketing_instagram_contacts`: `last_message_at`, `ad_window_until`, `opted_out_at` (flag de opt-out, com backfill a partir dos eventos), `tags text[]`
- `marketing_instagram_automation_runs`: `flow_snapshot`, `current_node_id`, `waiting_for` (`reply` | `button`), `wait_until`, `variables`; status ganha `waiting`
- `marketing_instagram_automation_jobs.action_type` ganha `flow_node` e `flow_timeout`
- Métrica "Ações" passa a contar só jobs de envio/CRM (`payload.counted = true` nos blocos do fluxo)

## API

`POST`/`PUT /api/marketing/instagram/automations` aceitam `flow`. Com `flow`, `steps` e os campos de CRM da automação ficam vazios (o CRM vive nos blocos). Rascunhos podem ser salvos com pendências; `active`/`paused` exigem o fluxo válido. O `PATCH` de ativação agora valida a conexão, os escopos e o fluxo antes de ativar.

## Outras mudanças

- Limite preventivo por contato subiu de 5 para 12 mensagens/24h por automação (fluxos com botões e follow-ups enviam mais que a sequência linear).
- DMs não sobrescrevem mais o `username` do contato aprendido num comentário.
