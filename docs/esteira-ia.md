# Esteira das IAs (`/esteira`)

Mostra em tempo real o que os agentes de IA do Telegram estão fazendo — **Alfred** (tráfego e criativos de clientes) e **Bruce** (conteúdo do @lancastermatos) — do pedido até o que está no ar, e deixa o owner/admin **aprovar ou pedir ajuste pela plataforma**. A equipe humana não entra aqui (fica no Workspace).

## Como funciona

```
Alfred/Bruce (servidor dos agentes)
  └─ bash ../ferramentas/esteira.sh item|evento|aprendizado '<json>'
       └─ POST /api/esteira/agente/*  (Bearer ESTEIRA_AGENT_SECRET)
            └─ esteira_itens / esteira_eventos / esteira_aprendizados (service role)
                 └─ Realtime → /esteira atualiza sozinha (owner/admin, por RLS)

Painel /esteira
  └─ Aprovar / Ajustar / Salvar regra / Descartar
       └─ POST /api/esteira/itens/:id/decisao · /api/esteira/aprendizados/:id/decisao
            └─ cron (1 min) no servidor dos agentes: esteira-decisoes.sh
                 └─ POST /api/esteira/agente/decisoes (entrega uma única vez, esteira_claim_decisoes)
                      └─ escreve "[Esteira] …" na sessão tmux do agente, que segue o fluxo
```

- Etapas: `pedido → produzindo → esperando → aprovado → no_ar`, mais `concluido` e `cancelado`. Cada item é identificado por `agente + ref` (o agente escolhe a `ref` e reusa até o fim).
- Voltar um item para `esperando` abre uma nova rodada de aprovação (limpa a decisão anterior).
- Aprovar pela plataforma move o item para `aprovado`; pedir ajuste volta para `produzindo` com a nota.

## Arquivos

- `supabase/migrations/20261125100000_esteira_ia.sql` — tabelas, RLS (leitura owner/admin; escrita só service role), Realtime e `esteira_claim_decisoes`.
- `src/app/api/esteira/agente/*` — rotas dos agentes (públicas no middleware; validam o segredo).
- `src/app/api/esteira/*` — rotas do painel (sessão; owner ou admin).
- `src/lib/esteira/` — validação (`payload.ts`), regras de negócio (`service.ts`), autenticação (`auth.ts`) e cálculos da tela (`board.ts`), com testes em `__tests__/`.
- `src/hooks/useEsteira.ts`, `src/components/esteira/EsteiraBoard.tsx`, `src/app/esteira/page.tsx` — tela.
- `scripts/esteira-agentes/` — o que vai para o servidor dos agentes: `esteira.sh`, `esteira-decisoes.sh` e o trecho de instruções `CLAUDE-esteira.md`.

## Configuração

Variáveis do app (Coolify):

| Variável | O que é |
|---|---|
| `ESTEIRA_AGENT_SECRET` | segredo compartilhado com os agentes (mínimo 32 caracteres). Sem ele, as rotas dos agentes respondem 503. |
| `ESTEIRA_OWNER_ID` | `auth.users.id` do dono da conta para onde vão os dados dos agentes. |

No servidor dos agentes: `/home/agentes/agentes/esteira.env` (chmod 600) com `ESTEIRA_URL=https://dash.genesycompany.com` e o mesmo `ESTEIRA_AGENT_SECRET`, e no crontab do usuário `agentes`: `* * * * * bash /home/agentes/agentes/ferramentas/esteira-decisoes.sh`.

## Exemplo

```bash
bash ../ferramentas/esteira.sh item '{"agente":"alfred","ref":"luna-criativos-2511","titulo":"3 criativos de lançamento","cliente":"Luna","etapa":"produzindo","passo":"Gerando a variação 2 de 3","progresso":66}'
```
