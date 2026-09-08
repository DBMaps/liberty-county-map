
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create table public.reports (
 id uuid primary key default gen_random_uuid(), crossing_id text not null,
 crossing_name text not null, railroad text, lat double precision not null,
 lng double precision not null, report_type text not null,severity text not null,
 detail text,source text default 'user',confidence text,device_id text,
 created_at timestamptz default now(),expires_at timestamptz default now()+interval '90 minutes');
alter table reports enable row level security;
grant all on reports to anon,authenticated,service_role;
grant select(device_id) on reports to anon;
create policy read_all on reports for select using (true);
create policy insert_all on reports for insert with check (true);
create publication supabase_realtime for table reports;
create schema history_capture;
create table history_capture.historical_events(id uuid default gen_random_uuid(), source_report_id text, envelope jsonb);
create table history_capture.writer_monitoring_events(id uuid default gen_random_uuid(), detail jsonb);
create table history_capture.retention_runs(id uuid default gen_random_uuid(), detail jsonb);
grant usage on schema history_capture to anon,authenticated,service_role;
grant all on all tables in schema history_capture to anon,authenticated,service_role;
insert into history_capture.historical_events(source_report_id,envelope) values ('legacy-id','{"device_id":"fixture-device"}');
insert into history_capture.writer_monitoring_events(detail) values ('{"device_id":"fixture-device"}');
insert into history_capture.retention_runs(detail) values ('{"copiedReport":"legacy-id"}');
insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity,device_id,created_at)
select 'DOT-'||age,'Crossing',30,-95,'blocked','high','fixture-device',
 now() - make_interval(days=>age) from unnest(array[100,149,180,181]) age;
insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity,device_id,created_at)
values ('MISSING','Crossing',30,-95,'blocked','high','fixture-device',null),
 ('FUTURE','Crossing',30,-95,'blocked','high','fixture-device',now()+interval '1 day'),
 ('hazard-fixture-device-1788888888888','Hazard',30,-95,'flooded','high','fixture-device',now());
