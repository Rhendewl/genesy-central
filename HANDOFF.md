# HANDOFF — Lancaster SaaS (Genesy)

**Data:** 2026-07-08
**Branch:** `main` (commit `ae6016a`, 102 commits)
**Deploy:** Vercel — push em `main` dispara deploy automático
**Testes:** 770/770 passing · 39 arquivos de teste
**Typecheck:** `npx tsc --noEmit` → EXIT 0
**Working tree:** limpo (sem alterações pendentes)

---

## O que é este projeto

SaaS multiusuário para gestão de operações de marketing/vendas de uma agência (ou empresa que gerencia tráfego pago, CRM, agendamentos e formulários para clientes). Cada conta tem um dono (owner), membros de equipe com papéis, e clientes finais que acessam portais públicos.

**Domínio de produção:** `dash.genesycompany.com`

---

## Checkpoint ativo — Conversas / WhatsApp QR (2026-07-09)

**Status:** implementação commitada e enviada para `main`.

**Commit:** `cc4f59f` — `feat: add conversations module and whatsapp worker`

### O que foi entregue

- Módulo **Conversas** adicionado em `/conversas`.
- Schema/RLS em `supabase/migrations/20260708_conversations_module.sql`.
- Cron de fluxos em `supabase/migrations/20260708_conversation_flow_jobs_cron.sql`.
- APIs de inbox, mensagens, conversas, fluxos, teste de fluxo, webhook inbound e cron.
- Executor de fluxos em `src/lib/conversations/flow-executor.ts`.
- Trigger service + consumer do Event Bus para eventos do CRM:
  - `src/lib/conversations/trigger-service.ts`
  - `src/lib/event-bus/conversations/consumers/crm-flow-trigger.ts`
  - inscrito em `src/lib/event-bus/platform.ts`
- Worker WhatsApp QR separado em `workers/whatsapp-qr-worker`.
- Provider QR do app agora chama worker HTTP via variáveis server-side:
  - `WHATSAPP_QR_WORKER_URL`
  - `WHATSAPP_QR_WORKER_SECRET`
  - `CONVERSATIONS_WORKER_SECRET`

### Estado externo já realizado

- SQL do cron de `conversation-flow-jobs-tick` foi aplicado no Supabase.
- `pg_cron` e `pg_net` estão habilitados.
- Consulta em `cron.job_run_details` mostrou `status = succeeded` para o job de Conversas.
- Railway: conta criada e repositório `Rhendewl/genesy-central` selecionado para o worker.
- O usuário estava na etapa de configurar o serviço Railway gerado a partir do repo.

### Próximo passo exato ao retomar

No Railway, no serviço do worker:

1. Em **Settings → Source**, definir **Root Directory**:
   ```txt
   workers/whatsapp-qr-worker
   ```
2. Em **Variables**, configurar:
   ```txt
   WHATSAPP_QR_WORKER_SECRET=<valor real gerado fora do Git>
   DASHBOARD_URL=https://dash.genesycompany.com
   CONVERSATIONS_WORKER_SECRET=<mesmo segredo aceito por /api/conversas/webhook/message>
   WHATSAPP_SESSIONS_DIR=/data/sessions
   LOG_LEVEL=info
   ```
3. Criar **Volume** com mount path:
   ```txt
   /data
   ```
4. Em **Networking**, gerar domínio público.
5. Testar:
   ```txt
   https://<worker>.up.railway.app/health
   ```
   Esperado:
   ```json
   {"ok":true}
   ```
6. Na Vercel do dashboard, configurar:
   ```txt
   WHATSAPP_QR_WORKER_URL=https://<worker>.up.railway.app
   WHATSAPP_QR_WORKER_SECRET=<mesmo valor do Railway>
   CONVERSATIONS_WORKER_SECRET=<mesmo valor do webhook>
   ```
7. Fazer redeploy da Vercel.
8. Testar em produção:
   - `/conversas` → Conectar WhatsApp
   - QR real deve aparecer
   - mensagem recebida deve cair no webhook `/api/conversas/webhook/message`
   - fluxo ativo deve criar job e cron deve executar.

### Notas de segurança

- Não registrar segredos reais no Git nem no `HANDOFF.md`.
- O arquivo de cron commitado em `main` está com placeholders; valores reais foram aplicados diretamente no Supabase.
- Se algum segredo real foi exposto em tela/chat, rotacionar antes de uso definitivo em produção.

### Validação local da etapa

```bash
npx tsc --noEmit
```

Resultado antes do commit: EXIT 0.

---

## Stack técnica

| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js | 14.2.35 (App Router) | Framework |
| TypeScript | 5.x | Linguagem |
| Supabase | 2.103.0 | Postgres + Auth + Storage + RLS |
| Tailwind CSS | 3.4.x | Estilo |
| shadcn/ui | `@base-ui/react` (NÃO `@radix-ui`) | Componentes |
| Zustand | 5.x | Estado global client-side |
| TipTap | 3.27.x | Rich text (Formulários, Notas) |
| Vitest | 4.1.9 | Testes |
| Resend | — | E-mails transacionais |
| OpenAI SDK / Anthropic SDK / Google Generative AI | — | Integrações de IA (uso pontual) |

**Atenção shadcn:** `TooltipTrigger` usa render prop, não `asChild`. Padrão fixo do projeto — não "corrigir" para `asChild`.

---

## Módulos ativos (estado atual)

| Módulo | Rota | Status |
|---|---|---|
| Auth + Middleware | `src/middleware.ts`, `/auth` | Completo |
| Dashboard Geral (contextual por papel) | `/` | Completo |
| CRM (Kanban + Pipelines + Automações) | `/crm` | Completo — inclui Workflow Engine |
| Financeiro | `/financeiro` | Completo |
| Tráfego Pago (Meta Ads) | `/trafego` | Completo |
| Clientes | `/clientes` | Completo |
| Portais (dashboard público do cliente) | `/portais`, `/portal/[slug]` | Completo |
| Formulários (builder + central de respostas) | `/formularios`, `/form/[slug]` | Completo |
| Agendamentos (booking público + Google Calendar) | `/agendamentos`, `/agendar/[slug]` | Completo — production-ready |
| Workspace (Tarefas/Notas/Objetivos/Calendário pessoal) | `/workspace` | Completo |
| Configurações (perfil, segurança, usuários, convites) | `/configuracoes` | Completo |
| ~~Criativos (canvas IA / DALL-E)~~ | — | **Removido** (commit `d3e733d`) |

**Nota importante:** o módulo Criativos (React Flow + SSE + DALL-E 3), documentado em memórias antigas como "completo", foi **removido do produto** no commit `d3e733d` ("motor de automações do CRM + tema claro completo + remoção do módulo Criativos"). Qualquer referência a ele em memória ou documentação anterior está obsoleta.

---

## Arquitetura multiusuário

- Fundação multiusuário implementada (`eacba8b`): cada conta tem um **owner** com perfil pessoal + Workspace 100% pessoal por padrão.
- Papéis e taxonomia de acesso corrigidos em `20260718_role_taxonomy_fix.sql` e `1051906` (dashboard contextual por papel + bloqueio real de acesso a Tráfego/Financeiro para papéis sem permissão).
- Convites de equipe: `/api/invite/send`, `/validate`, `/accept` + página `/convite/[token]`.
- Painel Equipe do admin: correção de RLS e responsável no CRM (`b1fa806`).
- RLS ativo em todas as tabelas — `service_role` bypassa, `authenticated` só vê dados próprios/compartilhados conforme papel.

---

## CRM — Workflow Engine (automações)

Motor de automações do CRM adicionado em `d3e733d` e refinado desde então:

- **Migrations:** `20260726_workflow_engine.sql`, `20260726_workflow_jobs_cron.sql`
- **Cron:** `/api/cron/workflow-jobs` — processa jobs agendados via `pg_cron`; protegido por `CRON_SECRET` compartilhado entre o cron do Supabase e a rota.
- Último commit (`ae6016a`) ajustou timeout do cron e reduziu o tamanho do lote por execução — atenção a isso se automações começarem a falhar por timeout de novo.
- APIs: `src/app/api/crm/automations/**` (regras, condições, ações, dashboard, histórico).
- Notificações por etapa de pipeline: `src/app/api/crm/notification-rules`.
- Event bus interno para disparo de eventos (`src/lib/event-bus/`), com retries e dead-letter (`bus.test.ts` cobre cenários de falha/offline).

---

## Módulo Agendamentos (production-ready)

Construído em sprints sucessivas, hoje completo:

- Painel admin: `/agendamentos/[id]` — múltiplos intervalos de disponibilidade, exceções, config.
- Página pública: `/agendar/[slug]` — layout isolado (`PublicLayout` dedicado, sem Dock/padding/fundo admin).
- Integração Google Calendar: OAuth 2.0 completo (`connect`/`callback`/`disconnect`/`status`/`events`), sync automático no momento da **criação** do booking (não apenas na confirmação) para sobreviver a shutdown serverless da Vercel.
- Integração com CRM: conversões vinculadas a agendamentos (`conversion-sources`, `calendars/[id]/conversions`).
- Concorrência tratada (`20260704_appointments_concurrency.sql`) para evitar double-booking.

---

## Módulo Workspace (pessoal)

Adicionado em `bd0210e`, expandido com multi-assignee e preferências de notificação:

- **Tarefas:** board Kanban pessoal/compartilhado, checklist, comentários, anexos (`workspace/tasks/**`).
- **Notas:** editor rich text (TipTap) com upload de imagem.
- **Objetivos:** steps, comentários, anexos.
- **Calendário:** agenda pessoal integrada.
- Banner de "visualizando como outro membro" (`WorkspaceViewingBanner.tsx`) para admins auditando o workspace de terceiros — RLS específica em `20260721_workspace_personal_rls.sql` e `20260722_workspace_admin_view.sql`.

---

## Módulo Formulários — estado detalhado

### Builder (editor 3 painéis)
- **Esquerda** `ContentSidebar.tsx` — lista estrutural (Welcome → Steps → Ending), dnd-kit.
- **Centro** `LivePreview.tsx` — preview always-on, Desktop/Tablet/Mobile.
- **Direita** — painel de propriedades condicional.
- Rich text via TipTap (`RichTextEditor.tsx`, modos `inline`/`block`).
- Upload de imagem: signed URL → Supabase Storage, bucket `criativos` (nome do bucket mantido por herança histórica, não indica dependência do módulo removido).

### Rota pública `/form/[slug]`
- Usa `h-dvh overflow-hidden` (não `min-h-[100dvh]`) em todos os estados — bug de tela branca resolvido definitivamente (causa raiz: altura não-definitiva + `overflow-hidden` clipando conteúdo).
- Cores hardcoded nos estados loading/not_found/error (CSS vars resolvem para tema escuro fixo no layout raiz).

### Central de Respostas (Sprint 7.1 + 7.2, completo)
- Paginação cursor (keyset) em `src/lib/respostas/cursor.ts`.
- Stats via RPC `get_submission_stats` — 1 pass agregado.
- Hooks `useRespostas` / `useRespostaDetail` (LRU cache 30 entradas) com optimistic update + rollback.
- PATCH whitelist rígido: `starred`, `archived`, `read_at`, `status`.

---

## Segurança — referência rápida

- API routes: sempre `supabase.auth.getUser()` antes de qualquer query.
- RLS ativo em todas as tabelas.
- Secrets de integrações (API keys) retornam sempre `"__masked__"` nas respostas de API.
- `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` nunca expostos ao cliente — apenas Server Components/API routes.
- Tokens OAuth (Meta, Google Calendar) criptografados com `TOKEN_ENCRYPTION_KEY` antes de persistir.

---

## Como rodar localmente

```bash
cd "lancaster-saas"

npm install
npm run dev                    # http://localhost:3000

npm test                       # run once (770 testes)
npm run test:watch
npm run test:coverage

npx tsc --noEmit                # typecheck
npm run build                   # build de produção
```

### Variáveis de ambiente (`.env.local`)

Ver `.env.local.example` para o template completo e comentado. Grupos principais:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=

# Meta Ads / Lead Ads
NEXT_PUBLIC_META_APP_ID=
META_APP_ID=
META_APP_SECRET=
META_VERIFY_TOKEN=
TOKEN_ENCRYPTION_KEY=

# Workflow Engine (cron)
CRON_SECRET=

# E-mail
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# IA (uso pontual — não há módulo Criativos ativo)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

Google Calendar usa OAuth próprio (client id/secret) — checar `src/app/api/google-calendar/` para variáveis específicas se for mexer nessa integração.

---

## Migrations — como estão organizadas

`supabase/migrations/` tem duas eras de nomenclatura:
- **Numéricas** (`001_initial.sql` ... `033_workflow_json.sql`): schema inicial até o módulo Criativos (hoje removido do produto, mas as tabelas/migrations permanecem no histórico).
- **Datadas** (`20260426_...` até `20260727_...`): tudo a partir da reestruturação de abril/2026 — forms, CRM pipelines, appointments, workspace, workflow engine, multiusuário.

`000_apply_all_idempotent.sql` existe para aplicar o schema completo de forma idempotente (útil para ambientes novos/reset).

**Não há migrations pendentes conhecidas** no momento — a única pendência registrada em handoffs anteriores (`20260626_analytics_events.sql`) já está aplicada (colunas `meta`/`idempotency_key` em `form_events` presentes no histórico de migrations até `20260727`).

---

## Links úteis

- **GitHub:** https://github.com/Rhendewl/genesy-central
- **Vercel:** https://vercel.com/dashboard (deploy automático no push para `main`)
- **Supabase:** https://supabase.com/dashboard/project/cvgraytzgbsmgpvsviav
- **Produção:** https://dash.genesycompany.com

---

## O que fazer a seguir (em aberto)

Sprint em andamento: **Conversas / WhatsApp QR**.

1. Finalizar deploy do worker no Railway seguindo o checkpoint acima.
2. Configurar env vars do worker no Railway e do dashboard na Vercel.
3. Redeploy da Vercel.
4. Testar conexão QR real no módulo `/conversas`.
5. Validar envio/recebimento e execução de fluxo ponta a ponta.
6. Depois disso, confirmar com o time se o cron do Workflow Engine segue estável em produção após o ajuste de `ae6016a`.
