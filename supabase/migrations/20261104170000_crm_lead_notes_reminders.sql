-- Notes are append-only, with identity and timestamps supplied by the server.
create table public.crm_lead_notes (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 author_auth_id uuid references auth.users(id) on delete set null,
 author_profile_id uuid references public.user_profiles(id) on delete set null,
 author_name text not null, author_avatar text,
 body text not null check (length(btrim(body)) between 1 and 10000),
 created_at timestamptz not null default now()
);
create index on public.crm_lead_notes(lead_id,created_at desc,id desc);
alter table public.crm_lead_notes enable row level security;
revoke all on public.crm_lead_notes from anon,authenticated;
grant select on public.crm_lead_notes to authenticated;
grant all on public.crm_lead_notes to service_role;
create policy notes_visible_lead on public.crm_lead_notes for select to authenticated using (
 exists(select 1 from public.leads l where l.id=crm_lead_notes.lead_id)
);

create table public.crm_lead_reminders (
 id uuid primary key,
 lead_id uuid not null references public.leads(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 creator_auth_id uuid not null references auth.users(id) on delete cascade,
 recipient_profile_id uuid not null references public.user_profiles(id) on delete cascade,
 title text not null check(length(title) between 1 and 240), description text not null default '' check(length(description)<=4000),
 start_at timestamptz not null, end_at timestamptz not null check(end_at>start_at), timezone text not null,
 notice_minutes integer not null check(notice_minutes between 0 and 40320), notify_at timestamptz not null,
 status text not null default 'creating' check(status in ('creating','scheduled','google_error','cancelling','cancelled')),
 google_event_id text not null, google_event_url text, payload_hash text not null,
 locked_until timestamptz, notified_at timestamptz, error text,
 created_at timestamptz not null default now()
);
create index on public.crm_lead_reminders(notify_at) where status='scheduled' and notified_at is null;
create index on public.crm_lead_reminders(lead_id,creator_auth_id,start_at desc);
alter table public.crm_lead_reminders enable row level security;
revoke all on public.crm_lead_reminders from anon,authenticated;
grant select on public.crm_lead_reminders to authenticated;
grant all on public.crm_lead_reminders to service_role;
create policy own_reminders_visible_lead on public.crm_lead_reminders for select to authenticated using (
 creator_auth_id=auth.uid() and exists(select 1 from public.leads l where l.id=crm_lead_reminders.lead_id)
);

-- Inbox delivery is transactional and independent of an open browser or Vercel.
create function public.deliver_due_crm_reminders() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.crm_lead_reminders%rowtype; delivered integer:=0;
begin
 for r in select * from public.crm_lead_reminders where status='scheduled' and notified_at is null and notify_at<=now()
   order by notify_at limit 100 for update skip locked
 loop
   if exists(select 1 from public.user_profiles p where p.id=r.recipient_profile_id and p.auth_user_id=r.creator_auth_id and p.owner_id=r.owner_id and p.is_active) then
     insert into public.workflow_notifications(user_id,recipient_user_id,lead_id,title,body,source,action_url,event_id)
       values(r.owner_id,r.recipient_profile_id,r.lead_id,'Lembrete: '||r.title,
         'Horário: '||to_char(r.start_at at time zone r.timezone,'DD/MM/YYYY HH24:MI')||' ('||r.timezone||'). Abra o lead para continuar.',
         'crm_lead_reminder','/crm?lead='||r.lead_id::text,'crm-reminder:'||r.id::text)
       on conflict(event_id,recipient_user_id) where event_id is not null do nothing;
     delivered:=delivered+1;
   end if;
   update public.crm_lead_reminders set notified_at=now() where id=r.id;
 end loop;
 return delivered;
end $$;
revoke all on function public.deliver_due_crm_reminders() from public,anon,authenticated;
grant execute on function public.deliver_due_crm_reminders() to service_role;
