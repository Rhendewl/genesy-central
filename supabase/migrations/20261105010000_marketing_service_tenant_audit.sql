-- Authenticated writes still derive tenant and author from the session.
-- Trusted server reconciliations have no auth.uid(): keep their explicit tenant
-- and original author rather than replacing both with null.
create or replace function public.marketing_set_tenant_and_audit()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 if TG_OP='INSERT' then
  if coalesce(auth.role(),'')='service_role' then
   if NEW.organization_id is null or NEW.created_by is null then
    raise exception using errcode='23502', message='Server marketing writes require organization_id and created_by';
   end if;
  else
   NEW.organization_id:=public.effective_owner_id();
   NEW.created_by:=auth.uid();
  end if;
 else
  NEW.organization_id:=OLD.organization_id;
  NEW.created_by:=OLD.created_by;
 end if;
 if to_jsonb(NEW) ? 'updated_by' then
  NEW.updated_by:=coalesce(auth.uid(),NEW.updated_by);
 end if;
 if to_jsonb(NEW) ? 'updated_at' then NEW.updated_at:=now(); end if;
 return NEW;
end;
$$;
