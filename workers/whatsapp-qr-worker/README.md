# WhatsApp QR Worker

Worker persistente para sessões WhatsApp Web via QR Code. O dashboard Next/Vercel
não deve manter a sessão aberta; ele chama este serviço por HTTP.

## Variáveis do worker

```env
PORT=3333
WHATSAPP_QR_WORKER_SECRET=mesmo-valor-configurado-no-dashboard
DASHBOARD_URL=https://dash.genesycompany.com
CONVERSATIONS_WORKER_SECRET=mesmo-segredo-do-webhook-no-dashboard
WHATSAPP_SESSIONS_DIR=sessions
```

`CONVERSATIONS_WORKER_SECRET` deve ser igual ao valor usado no app em
`CONVERSATIONS_WORKER_SECRET` ou, se você preferir reaproveitar, `CRON_SECRET`.

## Variáveis do dashboard

Na Vercel do dashboard:

```env
WHATSAPP_QR_WORKER_URL=https://url-publica-do-worker
WHATSAPP_QR_WORKER_SECRET=mesmo-valor-do-worker
CONVERSATIONS_WORKER_SECRET=segredo-para-o-worker-chamar-o-webhook
```

## Rodar localmente

```bash
cd workers/whatsapp-qr-worker
npm install
npm start
```

## Deploy recomendado

Use um ambiente com processo persistente e disco persistente, como Railway,
Render, Fly.io ou VPS. A pasta `sessions/` precisa sobreviver a reinicios para
evitar pedir QR Code o tempo todo.

## Contrato HTTP

Todas as chamadas exigem o header:

```txt
X-Worker-Secret: <WHATSAPP_QR_WORKER_SECRET>
```

Endpoints:

- `POST /accounts/:accountId/connect`
- `GET /accounts/:accountId/status`
- `POST /accounts/:accountId/disconnect`
- `POST /messages`

Payload de envio:

```json
{
  "accountId": "uuid-da-conta",
  "to": "5585999999999",
  "body": "Mensagem",
  "idempotencyKey": "uuid-da-mensagem"
}
```
