-- Isolated public-data intelligence. Writes and credentials remain server-only.
create table public.marketing_competitors (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references auth.users(id) on delete cascade,
 username text not null check (username ~ '^[a-z0-9_.]{1,30}$'), instagram_id text, name text,
 followers_count bigint, media_count bigint, active boolean not null default true,
 last_sync_at timestamptz, next_sync_at timestamptz not null default now(), sync_error text,
 partial boolean not null default true, created_at timestamptz not null default now(),
 unique(organization_id,username), unique(id,organization_id)
);
create table public.marketing_competitor_posts (
 id text not null, profile_id uuid not null, organization_id uuid not null,
 caption text, media_type text not null, permalink text, published_at timestamptz not null,
 like_count bigint check(like_count >= 0), comments_count bigint check(comments_count >= 0),
 collected_at timestamptz not null, primary key(profile_id,id),
 foreign key(profile_id,organization_id) references public.marketing_competitors(id,organization_id) on delete cascade
);
create table public.marketing_competitor_snapshots (
 id bigint generated always as identity primary key, profile_id uuid not null, organization_id uuid not null,
 collected_at timestamptz not null, followers_count bigint, media_count bigint, posts jsonb not null,
 foreign key(profile_id,organization_id) references public.marketing_competitors(id,organization_id) on delete cascade
);
create table public.marketing_competitor_analyses (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null, organization_id uuid not null,
 created_at timestamptz not null default now(), analysis text not null, source_ids jsonb not null, model text not null,
 foreign key(profile_id,organization_id) references public.marketing_competitors(id,organization_id) on delete cascade
);
create index on public.marketing_competitors(next_sync_at) where active;
create index on public.marketing_competitor_posts(organization_id,published_at desc);
create index on public.marketing_competitor_snapshots(profile_id,collected_at desc);
do $$ declare t text; begin
 foreach t in array array['marketing_competitors','marketing_competitor_posts','marketing_competitor_snapshots','marketing_competitor_analyses'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy marketing_read on public.%I for select to authenticated using (organization_id = auth.uid() or exists (select 1 from public.user_profiles p where p.auth_user_id=auth.uid() and p.owner_id=organization_id and p.is_active and (p.role=''admin'' or p.permissions ? ''marketing'')))',t);
 end loop;
end $$;
-- Atomically write the latest state and immutable observation; no partially saved sync.
create function public.save_competitor_observation(p_id uuid,p_org uuid,p_data jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare observed timestamptz := now();
begin
 perform 1 from marketing_competitors where id=p_id and organization_id=p_org for update;
 if not found then raise exception 'Profile not found'; end if;
 insert into marketing_competitor_posts(id,profile_id,organization_id,caption,media_type,permalink,published_at,like_count,comments_count,collected_at)
 select x.id,p_id,p_org,x.caption,x.media_type,x.permalink,x.published_at,x.like_count,x.comments_count,observed
 from jsonb_to_recordset(p_data->'posts') x(id text,caption text,media_type text,permalink text,published_at timestamptz,like_count bigint,comments_count bigint)
 on conflict(profile_id,id) do update set caption=excluded.caption,media_type=excluded.media_type,permalink=excluded.permalink,
 like_count=excluded.like_count,comments_count=excluded.comments_count,collected_at=excluded.collected_at;
 insert into marketing_competitor_snapshots(profile_id,organization_id,collected_at,followers_count,media_count,posts)
 values(p_id,p_org,observed,(p_data->>'followers_count')::bigint,(p_data->>'media_count')::bigint,p_data->'posts');
 update marketing_competitors set instagram_id=p_data->>'instagram_id',name=p_data->>'name',followers_count=(p_data->>'followers_count')::bigint,
 media_count=(p_data->>'media_count')::bigint,last_sync_at=observed,sync_error=null,partial=(p_data->>'partial')::boolean where id=p_id and organization_id=p_org;
end $$;
revoke all on function public.save_competitor_observation(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_competitor_observation(uuid,uuid,jsonb) to service_role;

alter table public.marketing_competitors add column next_analysis_at timestamptz not null default now();
create function public.limit_competitor_profiles() returns trigger language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,0));
 if (select count(*) from marketing_competitors where organization_id=new.organization_id)>=20 then raise exception 'Maximum 20 profiles'; end if;
 return new;
end $$;
create trigger competitor_profile_limit before insert on public.marketing_competitors for each row execute function public.limit_competitor_profiles();
