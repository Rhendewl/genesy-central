-- Signed documents are immutable snapshots; all signature transitions are atomic.
create table public.contract_profiles (
 user_id uuid primary key references auth.users(id), name text not null default '', document text not null default '', address text not null default ''
);
create table public.contract_templates (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 name text not null, body text not null, created_at timestamptz not null default now()
);
create table public.client_contract_documents (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 title text not null, body text not null, content_hash text not null, client_data jsonb not null,
 client_id uuid references public.agency_clients(id), status text not null default 'pending' check(status in ('pending','signed','cancelled')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '30 days'), completed_at timestamptz
);
create table public.client_contract_signers (
 id uuid primary key, contract_id uuid not null references public.client_contract_documents(id),
 name text not null, email text not null, role text not null check(role in ('cliente','socio','testemunha','contratada')),
 token_hash text not null unique, signed_at timestamptz, signed_name text, signed_document text,
 consent_text text, document_hash text, ip text, user_agent text
);
create index on public.client_contract_documents(user_id,created_at desc);
create index on public.client_contract_signers(contract_id);
alter table public.contract_profiles enable row level security;
alter table public.contract_templates enable row level security;
alter table public.client_contract_documents enable row level security;
alter table public.client_contract_signers enable row level security;
create policy contract_profile_owner on public.contract_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy contract_template_owner on public.contract_templates for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy contract_document_owner on public.client_contract_documents for select to authenticated using(user_id=auth.uid());
create policy contract_signer_owner on public.client_contract_signers for select to authenticated using(exists(select 1 from public.client_contract_documents d where d.id=contract_id and d.user_id=auth.uid()));
-- Public traffic never receives direct table access. Mutations run via server-only RPCs.
revoke all on public.client_contract_documents,public.client_contract_signers from anon,authenticated;
grant select on public.client_contract_documents,public.client_contract_signers to authenticated;
grant all on public.contract_profiles,public.contract_templates to authenticated;
grant all on public.contract_profiles,public.contract_templates,public.client_contract_documents,public.client_contract_signers to service_role;

create function public.issue_client_contract(p_doc jsonb,p_signers jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare doc_id uuid;
begin
 insert into client_contract_documents(id,user_id,title,body,content_hash,client_data)
 values((p_doc->>'id')::uuid,(p_doc->>'user_id')::uuid,p_doc->>'title',p_doc->>'body',p_doc->>'content_hash',p_doc->'client_data') returning id into doc_id;
 insert into client_contract_signers(id,contract_id,name,email,role,token_hash)
 select (s->>'id')::uuid,doc_id,s->>'name',s->>'email',s->>'role',s->>'token_hash' from jsonb_array_elements(p_signers) s;
 return doc_id;
end $$;
create function public.sign_client_contract(p_token_hash text,p_content_hash text,p_name text,p_document text,p_consent text,p_ip text,p_agent text) returns jsonb language plpgsql security definer set search_path=public as $$
declare signer client_contract_signers; doc client_contract_documents; new_client uuid;
begin
 select * into signer from client_contract_signers where token_hash=p_token_hash;
 if not found then raise exception 'Link inválido'; end if;
 -- Always lock the document first: concurrent last signatures cannot create duplicate clients.
 select * into doc from client_contract_documents where id=signer.contract_id for update;
 if doc.status='cancelled' or doc.expires_at<now() then raise exception 'Contrato cancelado ou link expirado'; end if;
 if doc.content_hash<>p_content_hash then raise exception 'O documento mudou. Recarregue a página'; end if;
 select * into signer from client_contract_signers where id=signer.id for update;
 if signer.signed_at is not null then return jsonb_build_object('status',doc.status,'already_signed',true); end if;
 update client_contract_signers set signed_at=now(),signed_name=p_name,signed_document=p_document,consent_text=p_consent,document_hash=doc.content_hash,ip=p_ip,user_agent=p_agent where id=signer.id;
 if not exists(select 1 from client_contract_signers where contract_id=doc.id and signed_at is null) then
  insert into agency_clients(user_id,name,company_type,status,monthly_fee,contact_name,contact_email,contact_phone,notes)
  values(doc.user_id,doc.client_data->>'name','outro','ativo',coalesce((doc.client_data->>'monthly_fee')::numeric,0),doc.client_data->>'contact_name',doc.client_data->>'email',doc.client_data->>'phone',concat('Contrato: ',doc.title,E'\nCPF/CNPJ: ',doc.client_data->>'document',E'\nEndereço: ',doc.client_data->>'address')) returning id into new_client;
  update client_contract_documents set status='signed',completed_at=now(),client_id=new_client where id=doc.id;
  return jsonb_build_object('status','signed');
 end if;
 return jsonb_build_object('status','pending');
end $$;
revoke all on function public.issue_client_contract(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.sign_client_contract(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.issue_client_contract(jsonb,jsonb) to service_role;
grant execute on function public.sign_client_contract(text,text,text,text,text,text,text) to service_role;

create function public.guard_contract_snapshot() returns trigger language plpgsql set search_path=public as $$
begin
 if new.body is distinct from old.body or new.content_hash is distinct from old.content_hash or new.client_data is distinct from old.client_data or new.user_id is distinct from old.user_id or new.title is distinct from old.title then
  raise exception 'O contrato gerado não pode ser alterado. Cancele e gere outro documento';
 end if;
 if old.status in ('signed','cancelled') and new.status<>old.status then raise exception 'Contrato já finalizado'; end if;
 return new;
end $$;
create trigger contract_snapshot_immutable before update on public.client_contract_documents for each row execute function public.guard_contract_snapshot();
