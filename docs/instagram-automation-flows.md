# Automações do Instagram em fluxos (nodes)

Evolução do submódulo de automações de comentários e Direct: a sequência linear de até 5 mensagens virou um **fluxo de blocos ligados**, editado num canvas dentro da Central do Instagram.

## Blocos

| Bloco | Saídas | O que faz |
|---|---|---|
| Gatilho | Em seguida | Mesmo gatilho de antes (comentário, DM, resposta a story, botão) + palavras-chave e resposta pública. Fica nas colunas da automação, para o webhook continuar casando pelo índice. |
| Mensagem | Em seguida, ou uma saída por botão "Continua o fluxo" (+ "Não tocou" opcional) | Texto com até 3 botões: link (`web_url`) ou resposta (`postback`). Botão de resposta pausa o fluxo até o toque. |
| Atraso | Em seguida | Pausa de segundos a dias e segue sozinho. Em pausas de até 1 min pode mostrar "digitando…" (`sender_action: typing_on`). No canvas é um relógio redondo. |
| Aguardar resposta | Respondeu / (Resposta inválida) / Sem resposta | Para até o lead escrever no Direct ou até o tempo limite. Pode salvar a resposta como Nome, WhatsApp, E-mail ou campo personalizado; WhatsApp e e-mail são validados e ganham a saída "Resposta inválida". |
| Condição | Sim / Não | Última resposta contém (lista separada por vírgula), contato tem tag, lead veio de anúncio. |
| Ação | Em seguida | CRM: cria o lead com nome (perfil do Instagram ou resposta coletada), WhatsApp em `contact`, e-mail, tags do contato e as demais respostas nas observações; se o lead já existe, completa nome/WhatsApp/e-mail. Tag: adiciona uma tag ao contato. |

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

## Variáveis nas mensagens

`{primeiro_nome}`, `{nome}`, `{usuario}`, `{whatsapp}`, `{email}`, `{resposta}` e o slug de cada campo personalizado (`Cidade de interesse` → `{cidade_de_interesse}`). O nome vem da User Profile API (`GET /{IGSID}?fields=name,username`), buscado uma vez por contato e guardado em `marketing_instagram_contacts.full_name`; a Meta só libera o perfil depois que a pessoa falou com a conta no Direct. Variável sem valor some do texto junto com o espaço antes dela.

## Velocidade

- O webhook responde à Meta e, em seguida, executa o fluxo no próprio servidor (`driveInstagramRuns`): blocos seguidos e pausas de até 60 s rodam na hora.
- O worker drena a fila em sequência por até 20 s a cada chamada e passa a rodar a cada 10 s (`20261126020000_instagram_flows_v2.sql`), cobrindo pausas longas e tempos limite.
- Isso depende do app rodar como servidor Node contínuo (Coolify). Em ambiente serverless, o trabalho após a resposta pode ser interrompido; o worker continua cobrindo.

## Editor

- Ligações com ímã: ao arrastar, o bloco mais próximo (em cima dele ou com a entrada a ~70 px) é escolhido e a linha encaixa.
- Duplicar bloco: botão no painel ou Ctrl/⌘ + D (a cópia vai logo abaixo, sem ligações).
- Cards pretos com brilho da cor do tipo no canto superior esquerdo, no padrão dos outros módulos.
- Zoom com Ctrl/⌘ + rolagem (ou pinça no trackpad), centrado no cursor; rolagem sem tecla move o quadro.
- Tema escuro: barra superior e painel do bloco em vidro quase preto com blur. Tema claro inalterado.

## Cards dos fluxos

Cada card mostra: quantas pessoas **entraram no fluxo**, a % que **concluiu** (anel), **concluíram**, **envios realizados** (mensagens, respostas públicas e ações de CRM) e **com falha**. O brilho do card segue o status (verde ativa, âmbar pausada, cinza rascunho). "Ver insights" abre a aba Insights já no fluxo.

## Insights

Aba "Insights" ao lado de "Fluxos": escolhe o fluxo e o período (7, 30 ou 90 dias). Dados vêm de `GET /api/marketing/instagram/automations/{id}/insights?days=` (`src/lib/instagram-automation/insights.ts`), sem SQL novo.

- **Principais**: entraram (com variação vs. período anterior e mini gráfico), concluíram (%), interagiram (responderam ou tocaram em botão; contador `variables.interactions` da execução), viraram lead no CRM.
- **Faixa**: envios realizados, tempo médio até concluir, em andamento agora, deixaram dados, com falha.
- **Entradas e conclusões por dia** (fuso America/Fortaleza), **funil** por bloco (pessoas distintas que chegaram em cada bloco, sem os atrasos), **botões mais tocados**, **horário de chegada**, **dados coletados**, **onde o fluxo foi interrompido** e **últimas pessoas** com WhatsApp/e-mail coletados.
- Execuções anteriores a esta versão não têm o contador de interações; para elas, "Interagiram" considera só toques em botão registrados.
