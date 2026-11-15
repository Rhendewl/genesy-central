-- Preserve contract snapshots when an agency client is deleted.
-- Deleting a contract does not delete its associated client.
begin;
alter table public.client_contract_documents drop constraint if exists client_contract_documents_client_id_fkey;
alter table public.client_contract_documents add constraint client_contract_documents_client_id_fkey foreign key(client_id) references public.agency_clients(id) on delete set null;
alter table public.client_contract_signers drop constraint if exists client_contract_signers_contract_id_fkey;
alter table public.client_contract_signers add constraint client_contract_signers_contract_id_fkey foreign key(contract_id) references public.client_contract_documents(id) on delete cascade;

create or replace function public.sign_client_contract(p_token_hash text,p_content_hash text,p_name text,p_document text,p_consent text,p_ip text,p_agent text) returns jsonb language plpgsql security definer set search_path=public as $$
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
  values(doc.user_id,doc.client_data->>'name',case when doc.client_data->>'company_type' in ('imobiliaria','corretor','construtora','outro') then doc.client_data->>'company_type' else 'outro' end,'ativo',coalesce((doc.client_data->>'monthly_fee')::numeric,0),doc.client_data->>'contact_name',doc.client_data->>'email',doc.client_data->>'phone',concat('Contrato: ',doc.title,E'\nCPF/CNPJ: ',doc.client_data->>'document',E'\nEndereço: ',doc.client_data->>'address')) returning id into new_client;
  update client_contract_documents set status='signed',completed_at=now(),client_id=new_client where id=doc.id;
  return jsonb_build_object('status','signed');
 end if;
 return jsonb_build_object('status','pending');
end $$;
commit;
