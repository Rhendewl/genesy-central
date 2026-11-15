-- Existing minute scheduler: persist inbox first, then best-effort device push.
do $$ begin
 if not exists(select 1 from pg_extension where extname='pg_cron') or not exists(select 1 from pg_extension where extname='pg_net')
 or not exists(select 1 from vault.secrets where name='webhook_delivery_cron_secret') then
   raise exception 'Existing scheduler prerequisites are missing';
 end if;
 perform cron.schedule('crm-lead-reminders-tick','* * * * *',$job$
   select public.deliver_due_crm_reminders();
   select net.http_post(url:='https://dash.genesycompany.com/api/cron/crm-reminders',
     headers:=jsonb_build_object('Content-Type','application/json','X-Cron-Secret',
       (select decrypted_secret from vault.decrypted_secrets where name='webhook_delivery_cron_secret' limit 1)),
     body:='{}'::jsonb,timeout_milliseconds:=55000);
 $job$);
end $$;
