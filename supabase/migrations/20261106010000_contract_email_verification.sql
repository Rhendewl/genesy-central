-- Server-only challenges. Atomic rate limits and attempt counting across instances.
create table public.contract_signature_challenges (
 signer_id uuid primary key references public.client_contract_signers(id) on delete cascade,
 code_hash text not null, sent_at timestamptz not null default now(), attempts integer not null default 0
);
alter table public.contract_signature_challenges enable row level security;
revoke all on public.contract_signature_challenges from anon, authenticated;
create function public.request_contract_signature_code(p_signer uuid,p_hash text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 insert into contract_signature_challenges(signer_id,code_hash) values(p_signer,p_hash)
 on conflict(signer_id) do update set code_hash=excluded.code_hash,sent_at=now(),attempts=0 where contract_signature_challenges.sent_at < now()-interval '60 seconds';
 return found;
end $$;
create function public.verify_contract_signature_code(p_signer uuid,p_hash text) returns boolean language plpgsql security definer set search_path=public as $$
declare challenge contract_signature_challenges;
begin
 select * into challenge from contract_signature_challenges where signer_id=p_signer for update;
 if not found or challenge.sent_at < now()-interval '10 minutes' or challenge.attempts>=5 then return false; end if;
 update contract_signature_challenges set attempts=attempts+1 where signer_id=p_signer;
 if challenge.code_hash<>p_hash then return false; end if;
 delete from contract_signature_challenges where signer_id=p_signer;
 return true;
end $$;
revoke all on function public.request_contract_signature_code(uuid,text),public.verify_contract_signature_code(uuid,text) from public,anon,authenticated;
grant execute on function public.request_contract_signature_code(uuid,text),public.verify_contract_signature_code(uuid,text) to service_role;
