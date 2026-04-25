-- =============================================================================
-- Lancaster SaaS — Schema inicial + RLS
-- Aplicar no Supabase Dashboard > SQL Editor
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- =============================================================================
-- TAGS
-- =============================================================================
create table if not exists tags (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#7d99ad',
  created_at timestamptz not null default now()
);

alter table tags enable row level security;

create policy "tags: user owns rows"
  on tags for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Default tags (inserted on first login via trigger) ────────────────────────
-- See trigger: on_auth_user_created (below)

-- =============================================================================
-- LEADS
-- =============================================================================
create table if not exists leads (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  contact     text not null,
  kanban_column text not null default 'abordados'
                check (kanban_column in (
                  'abordados','em_andamento','formulario_aplicado',
                  'reuniao_agendada','reuniao_realizada','no_show','venda_realizada'
                )),
  tags        uuid[] not null default '{}',
  notes       text,
  deal_value  numeric(14,2) not null default 0 check (deal_value >= 0),
  entered_at  date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table leads enable row level security;

create policy "leads: user owns rows"
  on leads for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_updated_at
  before update on leads
  for each row execute procedure update_updated_at();

-- =============================================================================
-- LEAD MOVEMENTS (histórico de movimentações)
-- =============================================================================
create table if not exists lead_movements (
  id          uuid primary key default uuid_generate_v4(),
  lead_id     uuid not null references leads(id) on delete cascade,
  from_column text not null,
  to_column   text not null,
  moved_at    timestamptz not null default now()
);

alter table lead_movements enable row level security;

-- Acesso via lead → user_id (sem expor user_id direto)
create policy "lead_movements: user owns via lead"
  on lead_movements for all
  using (
    exists (
      select 1 from leads l
      where l.id = lead_movements.lead_id
        and l.user_id = auth.uid()
    )
  );

-- =============================================================================
-- CATEGORIES (categorias financeiras)
-- =============================================================================
create table if not exists categories (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#7d99ad',
  type       text not null default 'ambos'
               check (type in ('receita','despesa','ambos')),
  created_at timestamptz not null default now()
);

alter table categories enable row level security;

create policy "categories: user owns rows"
  on categories for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- LANÇAMENTOS (receitas e despesas)
-- =============================================================================
create table if not exists lancamentos (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('receita','despesa')),
  description text not null,
  amount      numeric(12,2) not null check (amount > 0),
  date        date not null default current_date,
  category_id uuid references categories(id) on delete set null,
  notes       text,
  source      text default 'manual'
                check (source in (
                  'manual','trafego_investimento','trafego_venda','crm_venda'
                )),
  created_at  timestamptz not null default now()
);

alter table lancamentos enable row level security;

create policy "lancamentos: user owns rows"
  on lancamentos for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- CLIENTES RECORRENTES (MRR)
-- =============================================================================
create table if not exists clientes_recorrentes (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  monthly_value numeric(12,2) not null check (monthly_value > 0),
  start_date    date not null default current_date,
  status        text not null default 'ativo' check (status in ('ativo','inativo')),
  created_at    timestamptz not null default now()
);

alter table clientes_recorrentes enable row level security;

create policy "clientes_recorrentes: user owns rows"
  on clientes_recorrentes for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- INVESTIMENTOS DIÁRIOS (tráfego pago)
-- =============================================================================
create table if not exists investimentos_diarios (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  date             date not null,
  amount_invested  numeric(12,2) not null default 0 check (amount_invested >= 0),
  followers_gained integer not null default 0,
  reach            integer not null default 0,
  messages         integer not null default 0,
  meetings         integer not null default 0,
  amount_sold      numeric(12,2) not null default 0 check (amount_sold >= 0),
  recurring_value  numeric(12,2) not null default 0 check (recurring_value >= 0),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- One record per user per day
  unique (user_id, date)
);

alter table investimentos_diarios enable row level security;

create policy "investimentos_diarios: user owns rows"
  on investimentos_diarios for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger investimentos_diarios_updated_at
  before update on investimentos_diarios
  for each row execute procedure update_updated_at();

-- =============================================================================
-- TRIGGER: seed default tags + categories on new user sign-up
-- =============================================================================
create or replace function on_auth_user_created()
returns trigger language plpgsql security definer as $$
begin
  -- Default tags
  insert into tags (user_id, name, color) values
    (new.id, 'Tráfego Pago',         '#7d99ad'),
    (new.id, 'Social',               '#5b87a0'),
    (new.id, 'Indicação',            '#4a7a95'),
    (new.id, 'Corretor',             '#3d6d88'),
    (new.id, 'Dono de Imobiliária',  '#22c55e');

  -- Default categories
  insert into categories (user_id, name, color, type) values
    (new.id, 'Tráfego Pago',  '#ef4444', 'despesa'),
    (new.id, 'Vendas',        '#22c55e', 'receita'),
    (new.id, 'Recorrência',   '#10b981', 'receita'),
    (new.id, 'Operacional',   '#f59e0b', 'despesa'),
    (new.id, 'Marketing',     '#7d99ad', 'ambos');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure on_auth_user_created();

-- =============================================================================
-- REALTIME — habilitar publicação nas tabelas principais
-- Execute após aplicar o schema no Supabase Dashboard:
--   Realtime > Tables > enable for: leads, lancamentos,
--   clientes_recorrentes, investimentos_diarios
-- =============================================================================
