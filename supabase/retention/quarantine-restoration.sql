-- EXPLICIT RECOVERY ONLY. Run only after external network/API isolation.
-- Re-run after all forward migrations, which may reinstate client grants.
-- Never run against production without separate owner authorization.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
revoke all on schema report_retention,history_capture from public,anon,authenticated,service_role;
revoke all on all tables in schema report_retention,history_capture from public,anon,authenticated,service_role;
revoke all on all functions in schema public,report_retention,history_capture from public,anon,authenticated,service_role;
revoke all on public.reports from public,anon,authenticated,service_role;
do $$ declare target record; begin
 for target in select n.nspname,c.relname,a.attname from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
 where a.attnum>0 and not a.attisdropped and c.relkind in ('r','v','m','p') and (n.nspname in ('report_retention','history_capture') or c.oid='public.reports'::regclass) loop
  execute format('revoke all (%I) on %I.%I from public,anon,authenticated,service_role',target.attname,target.nspname,target.relname);
 end loop;
 if exists(select 1 from pg_publication where puballtables) then raise exception 'All-table publication requires isolated manual removal'; end if;
 for target in select pubname,schemaname,tablename from pg_publication_tables where schemaname in ('report_retention','history_capture') or schemaname='public' and tablename='reports' loop
  execute format('alter publication %I drop table %I.%I',target.pubname,target.schemaname,target.tablename);
 end loop;
end $$;
commit;
