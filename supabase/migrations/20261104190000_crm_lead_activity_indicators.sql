-- Only return flags for visible leads. Invoker rights preserve each table's RLS,
-- including the privacy of the current user's Google reminders.
create or replace function public.crm_lead_activity_indicators(p_lead_ids uuid[])
returns table(lead_id uuid, has_notes boolean, has_reminder boolean)
language sql stable security invoker set search_path=public,pg_temp
as $$
 select l.id,
   nullif(btrim(coalesce(l.notes,'')),'') is not null
     or exists(select 1 from public.crm_lead_notes n where n.lead_id=l.id),
   exists(select 1 from public.crm_lead_reminders r where r.lead_id=l.id
     and r.status='scheduled' and r.start_at>now())
 from public.leads l
 where l.id=any(p_lead_ids) and cardinality(p_lead_ids)<=500;
$$;
revoke all on function public.crm_lead_activity_indicators(uuid[]) from public,anon;
grant execute on function public.crm_lead_activity_indicators(uuid[]) to authenticated,service_role;
