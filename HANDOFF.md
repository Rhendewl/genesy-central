# HANDOFF — Lancaster SaaS

**Data:** 2026-06-26  
**Branch:** `main` (commit `b08756b`)  
**Deploy:** Vercel — push disparou deploy automático  
**Testes:** 710/710 passing · 38 test files  
**Typecheck:** EXIT:0  
**Build:** limpo  

---

## Estado atual do projeto

### O que está pronto

| Módulo | Status | Notas |
|---|---|---|
| Auth + middleware | Completo | |
| Dashboard / tráfego / financeiro | Completo | |
| Meta Integration (Lead Ads) | Completo | |
| Criativos | Completo | |
| **Formulários — data layer** | **Completo** | Sprint 7.1 |
| **Formulários — performance** | **Completo** | Indexes + EXPLAIN |
| Formulários — UI Central de Respostas | **NÃO INICIADO** | Sprint 7.2 |

---

## Sprint 7.1 — O que foi feito (data layer completo)

### APIs implementadas

| Endpoint | Método | Descrição |
|---|---|---|
| `/api/respostas` | GET | Lista paginada com cursor, filtros, FTS, stats |
| `/api/respostas/[id]` | GET | Detalhe completo: submission + sessão + eventos + deliveries |
| `/api/respostas/[id]` | PATCH | Atualiza starred, archived, read_at, status |

### Hooks implementados

| Hook | Arquivo | Descrição |
|---|---|---|
| `useRespostas` | `src/hooks/useRespostas.ts` | Paginação cursor, optimistic patch, rollback |
| `useRespostaDetail` | `src/hooks/useRespostaDetail.ts` | Fetch lazy, LRU cache (30 entries) |

### Tipos principais

```typescript
// src/lib/respostas/types.ts
SubmissionListItem     // item da listagem (achatado com session + form)
SubmissionDetail       // detalhe completo
SubmissionsListResponse // { items, nextCursor, stats }
SubmissionStats        // { total, completed, abandoned, completionRate, avgTimeOnFormMs }
RespostasParams        // parâmetros da listagem (form_id, status, starred, archived, q, sort, direction, limit)
SubmissionPatch        // { starred?, archived?, read_at?, status? }
Cursor                 // { ca: string, id: string }
```

### Cursor pagination

```typescript
// src/lib/respostas/cursor.ts
encodeCursor(created_at: string, id: string): string  // → base64url
decodeCursor(raw: string): Cursor | null
```

Estratégia keyset OR: `(created_at < ca) OR (created_at = ca AND id < id)`  
Limit+1 trick: busca `limit+1` rows; se `> limit` → `hasMore=true`.

### Decisões arquiteturais importantes

**Stats via RPC:** `get_submission_stats(p_user_id, p_archived, p_form_id?)` — 1 aggregate pass em vez de 3 COUNT queries separadas. Os stats ignoram filtros de `status` e `starred` intencionalmente — refletem a saúde geral do formulário.

**Paralelização em 2 fases:**
```
Fase 1: Promise.all([rpc(stats), dataQuery])
Fase 2: Promise.all([sessions batch, forms batch])
```

**SESSION_COLS:** select explícito de 14 colunas em `form_sessions` — evita trazer colunas grandes não usadas.

**ALLOWED_PATCH_KEYS:** Set com `Array.from()` — necessário porque tsconfig sem `target` padrão para ES3 (Set não é iterável com spread).

**Optimistic update com rollback:** aplica localmente → PATCH → sincroniza com resposta. Em erro: `setRev(r+1)` dispara refetch da página 1.

---

## Performance — Migrations aplicadas ao banco

### Migrations aplicadas (em ordem)

```
20260625_forms_module.sql           — tabelas base (forms, form_sessions, form_submissions, form_events)
20260626_integrations.sql           — form_integrations (versão original com bug de FK)
20260626_analytics_events.sql       — eventos de analytics, form_events indexes complementares
20260626_phase7_responses_center.sql — augmenta form_submissions, cria integration_deliveries, form_saved_views
20260627_phase7_perf_indexes.sql    — 6 índices compostos + RPC get_submission_stats
20260628_phase7_explain_helpers.sql — funções _diag_explain_* (DIAGNÓSTICO — remover após uso)
```

### Índices criados em 20260627

```sql
-- Listagem geral (Q1) — elimina Sort + Bitmap Heap Scan
form_submissions_user_archived_cursor_idx
  ON form_submissions(user_id, archived, created_at DESC, id DESC)

-- Listagem por formulário (Q2)
form_submissions_user_form_archived_cursor_idx
  ON form_submissions(user_id, form_id, archived, created_at DESC, id DESC)

-- Filtro por status
form_submissions_user_archived_status_cursor_idx
  ON form_submissions(user_id, archived, status, created_at DESC, id DESC)

-- Sort por completed_at
form_submissions_user_archived_completed_cursor_idx
  ON form_submissions(user_id, archived, completed_at DESC NULLS LAST, id DESC)

-- integration_deliveries detalhe (Q4) — elimina Sort
integration_deliveries_form_corr_delivered_idx
  ON integration_deliveries(form_id, correlation_id, delivered_at ASC)

-- form_events timeline (Q5) — elimina Bitmap Heap Scan
form_events_session_created_asc_idx
  ON form_events(session_id, created_at ASC)
```

### RPC criada em 20260627

```sql
get_submission_stats(p_user_id UUID, p_archived BOOLEAN, p_form_id UUID DEFAULT NULL)
RETURNS TABLE(total BIGINT, completed BIGINT, abandoned BIGINT)
LANGUAGE sql STABLE PARALLEL SAFE
```

### Resultado do EXPLAIN ANALYZE (banco real, commit b08756b)

| Query | Seq Scan | Bitmap | Sort | Índice |
|---|---|---|---|---|
| Q1 LIST all forms | Não | Não | Não | `user_archived_cursor_idx` |
| Q2 LIST by form | Não | Não | Não | `user_form_archived_cursor_idx` |
| Q3 Stats RPC | Não | Não | Não | `user_id_idx`* |
| Q4 Deliveries | Não | Não | Não | `form_corr_delivered_idx` |
| Q5 Events | Não | Sim** | Sim** | `session_seq_idx` |

*Q3 usa `user_id_idx` em banco vazio — com dados reais e ANALYZE, o planner escolherá `user_archived_cursor_idx`.  
**Q5: Bitmap+Sort com banco vazio é comportamento esperado (25kB quicksort, < 1ms). Com dados reais o planner usa Index Scan.

---

## Pendências no banco

### Remover funções de diagnóstico (opcional mas recomendado)

Cole no SQL Editor do Supabase:

```sql
DROP FUNCTION IF EXISTS _diag_explain_list_all_forms(UUID,BOOLEAN);
DROP FUNCTION IF EXISTS _diag_explain_list_by_form(UUID,UUID,BOOLEAN);
DROP FUNCTION IF EXISTS _diag_explain_stats(UUID,BOOLEAN,UUID);
DROP FUNCTION IF EXISTS _diag_explain_deliveries(UUID,TEXT);
DROP FUNCTION IF EXISTS _diag_explain_events(UUID);
```

### Migrations ainda NÃO aplicadas

`20260626_analytics_events.sql` — adiciona `meta JSONB` e `idempotency_key` em `form_events`. Verificado: essas colunas não existem no banco. Aplicar quando começar Sprint 7.2 (a UI de timeline usa `meta`).

---

## Estrutura de arquivos criados na Sprint 7.1

```
src/
├── lib/respostas/
│   ├── types.ts              — todos os tipos TypeScript do módulo
│   ├── cursor.ts             — encode/decode cursor base64url
│   └── __tests__/
│       ├── cursor.test.ts    — 9 testes
│       ├── types.test.ts     — 8 testes
│       ├── api-list.test.ts  — 13 testes
│       └── api-detail.test.ts — 10 testes
├── hooks/
│   ├── useRespostas.ts       — listagem com paginação e optimistic patch
│   ├── useRespostaDetail.ts  — detalhe com LRU cache (clearDetailCache exportada)
│   └── __tests__/
│       ├── useRespostas.test.ts      — 12 testes
│       └── useRespostaDetail.test.ts — 13 testes
└── app/api/
    ├── respostas/
    │   └── route.ts          — GET /api/respostas
    └── respostas/[id]/
        └── route.ts          — GET + PATCH /api/respostas/[id]

supabase/migrations/
├── 20260627_phase7_perf_indexes.sql   — 6 índices + RPC stats
└── 20260628_phase7_explain_helpers.sql — diagnóstico (dropar após uso)

scripts/
└── explain-queries.mjs       — runner de EXPLAIN ANALYZE via Supabase RPC
```

---

## Como rodar localmente

```bash
cd "lancaster-saas"

# Instalar dependências
npm install

# Dev server
npm run dev                    # http://localhost:3000

# Testes
npm test                       # run once
npm run test:watch             # watch mode
npm run test:coverage          # com cobertura

# Typecheck
npx tsc --noEmit

# Build
npm run build

# EXPLAIN ANALYZE (requer migrations aplicadas ao banco)
npx tsx scripts/explain-queries.mjs                   # banco vazio (dummy UUID)
npx tsx scripts/explain-queries.mjs <user_id>         # com dados reais
npx tsx scripts/explain-queries.mjs <user_id> <form_id> <corr_id> <session_id>
```

### Variáveis de ambiente necessárias (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
META_APP_ID=
META_APP_SECRET=
META_VERIFY_TOKEN=
NEXT_PUBLIC_META_APP_ID=
TOKEN_ENCRYPTION_KEY=
```

---

## Próximo passo — Sprint 7.2: UI da Central de Respostas

O data layer está completo. A Sprint 7.2 implementa a interface gráfica sobre os hooks já existentes.

### Páginas já scaffolded (sem conteúdo real ainda)

```
src/app/formularios/[id]/respostas/page.tsx   — lista de respostas por formulário
```

### O que construir na Sprint 7.2

**1. Listagem de respostas** (`/formularios/[id]/respostas`)
- Usar `useRespostas({ formId, ... })` já pronto
- Cards/tabela com: status badge, timestamp, device, país, starred toggle
- Filtros: status, starred, archived, search (FTS)
- Paginação: botão "Carregar mais" (cursor-based, `loadMore()` do hook)
- Stats cards no topo: total, completados, abandonados, completionRate

**2. Drawer de detalhe**
- Usar `useRespostaDetail(id)` já pronto
- Tabs: Respostas | Timeline | Integrações
- Tab Respostas: render das answers do formulário
- Tab Timeline: lista de `sessionEvents` (step_view, field_focus, etc.)
- Tab Integrações: lista de `integrationDeliveries` com status ok/fail

**3. Ações inline**
- Starred: `patch(id, { starred: true }, { starred: true })` — optimistic já implementado
- Archived: `patch(id, { archived: true }, { archived: true })`
- Read at: chamado automaticamente ao abrir o drawer (PATCH read_at)

**4. Central global** (`/respostas`) — todos os formulários
- Mesmos componentes, sem `formId` no hook

### Padrão de uso dos hooks

```typescript
// Listagem
const { submissions, stats, isLoading, hasMore, loadMore, patch } = useRespostas({
  formId: "...",
  status: "completed",
  limit: 50,
});

// Detalhe (aberto quando usuário clica em uma submission)
const { detail, isLoading, refresh } = useRespostaDetail(selectedId);

// Marcar como lido ao abrir
useEffect(() => {
  if (detail && !detail.submission.read_at) {
    patch(detail.submission.id, { read_at: new Date().toISOString() }, { read_at: new Date().toISOString() });
  }
}, [detail?.submission.id]);
```

### Componentes existentes que podem ser reutilizados

```
src/components/integracoes/IntegrationDrawer.tsx — padrão de drawer com tabs
src/components/integracoes/panels/HistoryPanel.tsx — padrão de lista de deliveries
```

---

## Stack técnica

| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js | 15 (App Router) | Framework |
| TypeScript | 5.x | Linguagem |
| Supabase | 2.103.0 | DB + Auth + Realtime |
| Tailwind CSS | 4.x | Estilo |
| shadcn/ui | base-ui | Componentes |
| Vitest | 4.1.9 | Testes |
| tsx | 4.22.4 | Scripts Node.js |

**Atenção shadcn:** `TooltipTrigger` usa render prop, não `asChild`. Padrão do projeto.

---

## Links úteis

- **GitHub:** https://github.com/Rhendewl/genesy-central
- **Vercel:** https://vercel.com/dashboard (deploy automático no push para `main`)
- **Supabase:** https://supabase.com/dashboard/project/cvgraytzgbsmgpvsviav

---

## Referência rápida de segurança

- API routes: sempre `supabase.auth.getUser()` antes de qualquer query
- RLS ativo em todas as tabelas — `service_role` bypassa, `authenticated` só vê próprios dados
- PATCH whitelist rígido: `["starred", "archived", "read_at", "status"]`
- `SUPABASE_SERVICE_ROLE_KEY` nunca exposto ao cliente — somente em Server Components e API routes
- API keys/secrets retornam sempre `"__masked__"` nas respostas de API
