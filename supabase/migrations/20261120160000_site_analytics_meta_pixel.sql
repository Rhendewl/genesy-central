-- Pixel do Facebook (Meta) no Site Genesy: configuração e registro dos eventos enviados.
alter table public.site_analytics_settings
  add column if not exists meta_pixel_enabled boolean not null default false,
  add column if not exists meta_pixel_id text check (meta_pixel_id is null or meta_pixel_id ~ '^[0-9]{6,20}$'),
  add column if not exists meta_capi_token_encrypted text,
  add column if not exists meta_test_event_code text;

create table if not exists public.site_analytics_pixel_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_key text not null,
  session_id uuid references public.site_analytics_sessions(id) on delete set null,
  event_name text not null,
  event_id text not null,
  channel text not null check (channel in ('browser','server')),
  status text not null check (status in ('sent','blocked','failed')),
  error text,
  created_at timestamptz not null default now(),
  unique (event_id, channel)
);
create index if not exists site_pixel_events_user_created_idx on public.site_analytics_pixel_events(user_id, created_at desc);

alter table public.site_analytics_pixel_events enable row level security;
drop policy if exists "site analytics owner pixel events" on public.site_analytics_pixel_events;
create policy "site analytics owner pixel events" on public.site_analytics_pixel_events
  for select using (user_id = auth.uid());

comment on table public.site_analytics_pixel_events is 'Eventos do Pixel do Facebook enviados pelo site (navegador) e pela API de Conversões (servidor).';
