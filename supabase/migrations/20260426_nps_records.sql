-- ─────────────────────────────────────────────────────────────────────────────
-- NPS Records — Satisfação Mensal de Clientes
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.nps_records (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  client_id        uuid not null references public.agency_clients(id) on delete cascade,
  reference_month  text not null,       -- formato YYYY-MM
  score            smallint not null check (score >= 0 and score <= 10),
  comment          text,
  channel          text not null default 'manual'
                   check (channel in ('manual', 'formulario', 'whatsapp', 'outro')),
  responsible      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Impede duplicata: um registro por cliente por mês
  unique (user_id, client_id, reference_month)
);

-- Atualiza updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger nps_records_updated_at
  before update on public.nps_records
  for each row execute function public.set_updated_at();

-- RLS
alter table public.nps_records enable row level security;

create policy "nps_records_select" on public.nps_records
  for select using (auth.uid() = user_id);

create policy "nps_records_insert" on public.nps_records
  for insert with check (auth.uid() = user_id);

create policy "nps_records_update" on public.nps_records
  for update using (auth.uid() = user_id);

create policy "nps_records_delete" on public.nps_records
  for delete using (auth.uid() = user_id);

-- Índices
create index nps_records_user_id_idx       on public.nps_records (user_id);
create index nps_records_client_id_idx     on public.nps_records (client_id);
create index nps_records_reference_month_idx on public.nps_records (reference_month);
