\set ON_ERROR_STOP on
-- Owner-only, idempotent emergency suspension. Run with a unique incident_id.
\if :{?incident_id}
\else
  \echo 'incident_id is required'
  select 1/0;
\endif

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = pg_catalog;
do $$ begin
  if current_user <> 'postgres' then
    raise exception using errcode='42501', message='Community reporting suspension requires the database owner';
  end if;
end $$;
update report_retention.admission_state
set reporting_enabled=false,changed_at=clock_timestamp()
where singleton and protocol_version=2 and reporting_enabled;
insert into report_retention.admission_events(event_id,action)
values (:'incident_id'::uuid,'suspend') on conflict (event_id) do nothing;
commit;
