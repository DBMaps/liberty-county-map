-- Only the proof-verifying Edge Function's service role may execute the
-- existing atomic protocol-v2 writers. Leave reporting disabled during cutover.
begin;
do $$ begin
  if not exists (select 1 from report_retention.admission_state
    where singleton and protocol_version=2 and not reporting_enabled) then
    raise exception 'Paid reporting authorization requires the reporting-off checkpoint';
  end if;
end $$;

revoke execute on function public.submit_community_observation(text,jsonb,text) from public,anon,authenticated;
revoke execute on function public.mutate_community_observation(text,uuid,text,jsonb,text) from public,anon,authenticated;
revoke execute on function public.cancel_community_operation(text) from public,anon,authenticated;
grant execute on function public.submit_community_observation(text,jsonb,text) to service_role;
grant execute on function public.mutate_community_observation(text,uuid,text,jsonb,text) to service_role;
grant execute on function public.cancel_community_operation(text) to service_role;

create table report_retention.admission_events (
  event_id uuid primary key,
  action text not null check (action in ('activate','suspend','resume')),
  recorded_at timestamptz not null default clock_timestamp()
);
alter table report_retention.admission_events enable row level security;
revoke all on report_retention.admission_events from public,anon,authenticated,service_role;
commit;
