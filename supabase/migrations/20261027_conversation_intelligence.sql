-- Official Cloud API only. No historical import. All writes through server/RPC.
begin;
create function public.ci_active(p_sdr uuid, p_tenant uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select exists(select 1 from user_profiles where auth_user_id=p_sdr and owner_id=p_tenant
 and is_active and role in ('admin','comercial','gestor_comercial')
 and (auth_user_id=owner_id or 'crm'=any(permissions)));
$$;
create table public.ci_connections (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references auth.users on delete cascade,
 sdr_id uuid not null references auth.users on delete cascade, waba_id text not null,
 phone_number_id text not null unique, display_phone text not null,
 status text not null check(status in ('connected','paused','reauthorization_required')),
 connected_at timestamptz not null default now(), last_event_at timestamptz,
 unique(tenant_id,sdr_id), unique(id,tenant_id,sdr_id)
);
create table public.ci_credentials (
 connection_id uuid primary key references ci_connections on delete cascade, encrypted_token text not null
);
create table public.ci_signup_sessions (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, sdr_id uuid not null,
 expires_at timestamptz not null default now()+interval '10 minutes'
);
create table public.ci_consents (
 id uuid primary key default gen_random_uuid(), connection_id uuid not null references ci_connections on delete cascade,
 tenant_id uuid not null, sdr_id uuid not null, contact_hash text not null, contact_label text not null,
 client_id uuid references agency_clients on delete cascade,
 evidence text not null check(length(evidence) between 10 and 500), policy_version text not null default '2026-10-27',
 allow_ai boolean not null default false, share_summary boolean not null default false,
 granted_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '90 days',
 revoked_at timestamptz, unique(connection_id,contact_hash),
 foreign key(connection_id,tenant_id,sdr_id) references ci_connections(id,tenant_id,sdr_id) on delete cascade
);
create table public.ci_messages (
 id uuid primary key default gen_random_uuid(), consent_id uuid not null references ci_consents on delete cascade,
 provider_id text not null, direction text not null check(direction in ('inbound','outbound')),
 sent_at timestamptz not null, received_at timestamptz not null default now(),
 kind text not null, encrypted_body text, unique(consent_id,provider_id)
);
create index ci_messages_period on ci_messages(consent_id,sent_at);
create table public.ci_analyses (
 consent_id uuid primary key references ci_consents on delete cascade,
 generated_at timestamptz not null default now(), model text not null, prompt_version text not null,
 source_ids uuid[] not null, findings jsonb not null
);
create table public.ci_audit (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, sdr_id uuid not null,
 action text not null, created_at timestamptz not null default now()
);
-- No token, message text or contact number in audit records.
create function public.ci_own(p_connection uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from ci_connections c where c.id=p_connection and c.sdr_id=auth.uid()
 and ci_active(c.sdr_id,c.tenant_id));
$$;
alter table ci_connections enable row level security;
alter table ci_credentials enable row level security;
alter table ci_signup_sessions enable row level security;
alter table ci_consents enable row level security;
alter table ci_messages enable row level security;
alter table ci_analyses enable row level security;
alter table ci_audit enable row level security;
revoke all on ci_connections,ci_credentials,ci_signup_sessions,ci_consents,ci_messages,ci_analyses,ci_audit from anon,authenticated;
grant select on ci_connections,ci_consents,ci_messages,ci_analyses to authenticated;
grant all on ci_connections,ci_credentials,ci_signup_sessions,ci_consents,ci_messages,ci_analyses,ci_audit to service_role;
create policy ci_connection_read on ci_connections for select to authenticated using(ci_own(id));
create policy ci_consent_read on ci_consents for select to authenticated using(ci_own(connection_id));
create policy ci_message_read on ci_messages for select to authenticated using(sent_at>=now()-interval '30 days' and exists(select 1 from ci_consents c where c.id=consent_id and ci_own(c.connection_id) and c.revoked_at is null and c.expires_at>now()));
create policy ci_analysis_read on ci_analyses for select to authenticated using(exists(select 1 from ci_consents c where c.id=consent_id and ci_own(c.connection_id) and c.revoked_at is null and c.expires_at>now()));
-- Lock connection then consent everywhere; revocation cannot race with webhook persistence.
create function public.ci_ingest(p_phone text,p_waba text,p_contact text,p_provider text,p_direction text,p_sent timestamptz,p_kind text,p_body text) returns boolean
language plpgsql security definer set search_path=public as $$
declare conn ci_connections; consent ci_consents;
begin
 select * into conn from ci_connections where phone_number_id=p_phone and waba_id=p_waba for update;
 if not found or conn.status<>'connected' or not ci_active(conn.sdr_id,conn.tenant_id) then return false; end if;
 select * into consent from ci_consents where connection_id=conn.id and contact_hash=p_contact for update;
 if not found or consent.revoked_at is not null or consent.expires_at<=now() or p_sent<consent.granted_at or p_sent>now()+interval '5 minutes' or p_sent<now()-interval '30 days' then return false; end if;
 insert into ci_messages(consent_id,provider_id,direction,sent_at,kind,encrypted_body)
 values(consent.id,p_provider,p_direction,p_sent,p_kind,p_body) on conflict do nothing;
 update ci_connections set last_event_at=now() where id=conn.id;
 return true;
end $$;
create function public.ci_revoke(p_id uuid,p_sdr uuid) returns void
language plpgsql security definer set search_path=public as $$
declare conn_id uuid;
begin
 select connection_id into conn_id from ci_consents where id=p_id and sdr_id=p_sdr;
 perform 1 from ci_connections where id=conn_id for update;
 update ci_consents set revoked_at=now() where id=p_id and sdr_id=p_sdr;
 delete from ci_messages where consent_id=p_id and exists(select 1 from ci_consents where id=p_id and sdr_id=p_sdr);
 delete from ci_analyses where consent_id=p_id and exists(select 1 from ci_consents where id=p_id and sdr_id=p_sdr);
 insert into ci_audit(tenant_id,sdr_id,action) select tenant_id,sdr_id,'consent_revoked_and_content_deleted' from ci_consents where id=p_id and sdr_id=p_sdr;
end $$;
create function public.ci_save_analysis(p_id uuid,p_sdr uuid,p_model text,p_ids uuid[],p_findings jsonb) returns boolean
language plpgsql security definer set search_path=public as $$
declare c ci_consents;
begin
 select * into c from ci_consents where id=p_id and sdr_id=p_sdr for update;
 if not found or c.revoked_at is not null or c.expires_at<=now() or not c.allow_ai or not ci_active(c.sdr_id,c.tenant_id) then return false; end if;
 if cardinality(p_ids)=0 or (select count(*) from ci_messages where consent_id=c.id and id=any(p_ids))<>cardinality(p_ids) then return false; end if;
 insert into ci_analyses(consent_id,model,prompt_version,source_ids,findings) values(c.id,p_model,'1',p_ids,p_findings)
 on conflict(consent_id) do update set generated_at=now(),model=excluded.model,source_ids=excluded.source_ids,findings=excluded.findings;
 return true;
end $$;
create function public.ci_purge() returns void language plpgsql security definer set search_path=public as $$
begin
 delete from ci_analyses a where exists(select 1 from ci_consents c where c.id=a.consent_id and (c.revoked_at is not null or c.expires_at<=now())) or exists(select 1 from ci_messages m where m.id=any(a.source_ids) and m.sent_at<now()-interval '30 days');
 delete from ci_messages m where sent_at<now()-interval '30 days' or exists(select 1 from ci_consents c where c.id=m.consent_id and (c.revoked_at is not null or c.expires_at<=now()));
 delete from ci_consents where coalesce(revoked_at,expires_at)<now()-interval '180 days';
 delete from ci_signup_sessions where expires_at<now();
 delete from ci_audit where created_at<now()-interval '180 days';
end $$;
revoke all on function ci_ingest(text,text,text,text,text,timestamptz,text,text),ci_revoke(uuid,uuid),ci_save_analysis(uuid,uuid,text,uuid[],jsonb),ci_purge() from public,anon,authenticated;
grant execute on function ci_ingest(text,text,text,text,text,timestamptz,text,text),ci_revoke(uuid,uuid),ci_save_analysis(uuid,uuid,text,uuid[],jsonb),ci_purge() to service_role;
revoke all on function ci_active(uuid,uuid),ci_own(uuid) from public,anon;
grant execute on function ci_active(uuid,uuid),ci_own(uuid) to authenticated,service_role;
create function public.ci_connect(p_tenant uuid,p_sdr uuid,p_waba text,p_phone text,p_display text,p_token text) returns uuid
language plpgsql security definer set search_path=public as $$
declare new_id uuid;
begin
 if not ci_active(p_sdr,p_tenant) then raise exception 'Inactive member'; end if;
 insert into ci_connections(tenant_id,sdr_id,waba_id,phone_number_id,display_phone,status) values(p_tenant,p_sdr,p_waba,p_phone,p_display,'connected') returning id into new_id;
 insert into ci_credentials(connection_id,encrypted_token) values(new_id,p_token);
 insert into ci_audit(tenant_id,sdr_id,action) values(p_tenant,p_sdr,'coexistence_connected');
 return new_id;
end $$;
revoke all on function ci_connect(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function ci_connect(uuid,uuid,text,text,text,text) to service_role;
create function public.ci_authorize(p_connection uuid,p_sdr uuid,p_contact text,p_label text,p_client uuid,p_evidence text,p_ai boolean,p_share boolean) returns uuid
language plpgsql security definer set search_path=public as $$
declare conn ci_connections; existing ci_consents; result_id uuid;
begin
 select * into conn from ci_connections where id=p_connection and sdr_id=p_sdr for update;
 if not found or not ci_active(conn.sdr_id,conn.tenant_id) then raise exception 'Not authorized'; end if;
 if p_client is not null and not exists(select 1 from agency_clients where id=p_client and user_id=conn.tenant_id) then raise exception 'Invalid client'; end if;
 if p_share and p_client is null then raise exception 'Client required'; end if;
 select * into existing from ci_consents where connection_id=conn.id and contact_hash=p_contact for update;
 if found then
  if existing.revoked_at is null and existing.expires_at>now() then raise exception 'Consent already active'; end if;
  delete from ci_analyses where consent_id=existing.id;
  delete from ci_messages where consent_id=existing.id;
  delete from ci_consents where id=existing.id;
 end if;
 insert into ci_consents(connection_id,tenant_id,sdr_id,contact_hash,contact_label,client_id,evidence,allow_ai,share_summary)
 values(conn.id,conn.tenant_id,p_sdr,p_contact,p_label,p_client,p_evidence,p_ai,p_share) returning id into result_id;
 insert into ci_audit(tenant_id,sdr_id,action) values(conn.tenant_id,p_sdr,'conversation_authorized');
 return result_id;
end $$;
revoke all on function ci_authorize(uuid,uuid,text,text,uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function ci_authorize(uuid,uuid,text,text,uuid,text,boolean,boolean) to service_role;
-- A lease prevents concurrent AI requests/costs for the same conversation.
create table public.ci_analysis_leases(consent_id uuid primary key references ci_consents on delete cascade,claimed_at timestamptz not null default now());
alter table ci_analysis_leases enable row level security;
revoke all on ci_analysis_leases from public,anon,authenticated;
grant all on ci_analysis_leases to service_role;
create function public.ci_claim_analysis(p_id uuid,p_sdr uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare claimed uuid;
begin
 if not exists(select 1 from ci_consents c where c.id=p_id and c.sdr_id=p_sdr and c.allow_ai and c.revoked_at is null and c.expires_at>now() and ci_active(c.sdr_id,c.tenant_id)) then return false; end if;
 insert into ci_analysis_leases(consent_id) values(p_id) on conflict(consent_id) do update set claimed_at=now() where ci_analysis_leases.claimed_at<now()-interval '1 minute' returning consent_id into claimed;
 return claimed is not null;
end $$;
revoke all on function ci_claim_analysis(uuid,uuid) from public,anon,authenticated;
grant execute on function ci_claim_analysis(uuid,uuid) to service_role;
commit;
