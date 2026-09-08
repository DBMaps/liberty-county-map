-- DESTRUCTIVE, EXPLICIT LOCAL/ISOLATED RECOVERY OPERATION. Not certification.
-- Apply current forward schema first; quarantine immediately afterward.
-- Unknown replay evidence is NEVER synthesized. Missing ledger stays blocked.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table public.reports,report_retention.device_links,report_retention.observation_receipts,report_retention.replay_evidence in access exclusive mode;
do $$ begin
 if exists(select 1 from pg_roles r cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
  where r.rolname in ('anon','authenticated','service_role') and c.relkind in ('r','v','m','p')
  and (n.nspname in ('report_retention','history_capture') or c.oid='public.reports'::regclass)
  and (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
 or exists(select 1 from pg_roles r cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where r.rolname in ('anon','authenticated','service_role') and n.nspname in ('public','report_retention','history_capture') and has_function_privilege(r.oid,p.oid,'EXECUTE'))
 then raise exception 'Recovery must remain quarantined'; end if;
end $$;
-- Untrustworthy rows are deleted, not aggregated with invented provenance.
delete from public.reports r where r.device_id is not null
 or r.original_submitted_at is null or not isfinite(r.original_submitted_at) or r.original_submitted_at>statement_timestamp()
 or r.created_at is distinct from r.original_submitted_at
 or r.linkage_deadline is distinct from r.original_submitted_at+interval '4320 hours'
 or r.cleanup_after is distinct from r.original_submitted_at+interval '3576 hours'
 or not exists(select 1 from report_retention.observation_receipts o join report_retention.replay_evidence e using(token_digest) where o.report_id=r.id and o.original_submitted_at=r.original_submitted_at and r.original_submitted_at<=e.first_accepted_at)
 or r.crossing_id ~ '^hazard(?:-cleared)?-.+-[0-9]{10,}$'
 or exists(select 1 from report_retention.device_links l where l.report_id=r.id and l.device_id<>'' and position(l.device_id in concat_ws(' ',r.crossing_id,r.crossing_name,r.detail,r.railroad,r.confidence,r.source))>0)
 or exists(select 1 from regexp_matches(row_to_json(r)::text,'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}','g') m join report_retention.replay_evidence e on e.token_digest=extensions.digest(uuid_send(m[1]::uuid),'sha256'));
delete from history_capture.historical_events;
delete from history_capture.writer_monitoring_events;
delete from history_capture.retention_runs;
do $$ begin
 if report_retention.run_cleanup()<0 then raise exception 'Recovery cleanup failed; quarantine remains required'; end if;
end $$;
commit;
