-- LP244.33: Google Play UGC moderation, deletion, and retention closure.
-- Prepared locally. Production remains fail-closed until an owner applies and
-- certifies this migration through the normal deployment runbook.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path = pg_catalog;
select pg_advisory_xact_lock(24433, 1);

create schema if not exists moderation;
create schema if not exists privacy_ops;
revoke all on schema moderation, privacy_ops from public, anon, authenticated, service_role;

alter table public.reports
  add column moderation_state text not null default 'visible'
  constraint reports_moderation_state_check
  check (moderation_state in ('visible','quarantined','removed'));
create index reports_moderation_state_cleanup_idx
  on public.reports(moderation_state, cleanup_after);

-- RLS and column grants are separate boundaries. The moderation state is not
-- added to the existing public projection, and this restrictive policy makes
-- quarantined/removed rows disappear from every anon/authenticated SELECT.
create policy moderation_public_visibility_boundary
  on public.reports as restrictive for select to anon, authenticated
  using (moderation_state = 'visible');

create table moderation.complaints (
  id uuid primary key default extensions.gen_random_uuid(),
  operation_digest bytea not null unique check (octet_length(operation_digest)=32),
  target_report_id uuid references public.reports(id) on delete set null,
  target_report_digest bytea not null check (octet_length(target_report_digest)=32),
  reason text not null check (reason in ('dangerous_content','false_information','harassment','hate_or_abuse','spam','other')),
  reporter_device_digest bytea check (reporter_device_digest is null or octet_length(reporter_device_digest)=32),
  created_at timestamptz not null default clock_timestamp(),
  status text not null default 'open' check (status in ('open','reviewing','resolved','escalated')),
  action text check (action is null or action in ('no_action','quarantine','remove','source_suppression')),
  reviewed_at timestamptz,
  notes text check (notes is null or length(notes)<=2000),
  retain_until timestamptz not null default (clock_timestamp()+interval '148 days'),
  check (retain_until <= created_at + interval '149 days')
);
create index complaints_queue_idx on moderation.complaints(status, created_at);
create index complaints_target_idx on moderation.complaints(target_report_id);
create index complaints_reporter_rate_idx on moderation.complaints(reporter_device_digest, created_at);
alter table moderation.complaints enable row level security;

create table moderation.action_log (
  id bigint generated always as identity primary key,
  complaint_id uuid references moderation.complaints(id) on delete set null,
  target_report_digest bytea not null check (octet_length(target_report_digest)=32),
  action text not null check (action in ('no_action','quarantine','remove','source_suppression')),
  outcome text not null check (length(outcome) between 1 and 120),
  created_at timestamptz not null default clock_timestamp(),
  retain_until timestamptz not null,
  check (retain_until <= created_at + interval '180 days')
);
alter table moderation.action_log enable row level security;

create table moderation.source_suppressions (
  device_digest bytea primary key check (octet_length(device_digest)=32),
  complaint_id uuid references moderation.complaints(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  reason text not null check (length(reason) between 1 and 120),
  check (expires_at <= created_at + interval '180 days')
);
alter table moderation.source_suppressions enable row level security;

create table privacy_ops.deletion_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  operation_digest bytea not null unique check (octet_length(operation_digest)=32),
  target_report_id uuid references public.reports(id) on delete set null,
  target_report_digest bytea not null check (octet_length(target_report_digest)=32),
  requester_device_digest bytea check (requester_device_digest is null or octet_length(requester_device_digest)=32),
  created_at timestamptz not null default clock_timestamp(),
  status text not null default 'verified' check (status in ('verified','completed','denied')),
  outcome text check (outcome is null or outcome in ('delete','quarantine','deny')),
  reviewed_at timestamptz,
  completed_at timestamptz,
  notes text check (notes is null or length(notes)<=2000),
  retain_until timestamptz not null default (clock_timestamp()+interval '148 days'),
  check (retain_until <= created_at + interval '149 days')
);
create index deletion_requests_queue_idx on privacy_ops.deletion_requests(status, created_at);
create index deletion_requests_target_idx on privacy_ops.deletion_requests(target_report_id);
alter table privacy_ops.deletion_requests enable row level security;

revoke all on all tables in schema moderation, privacy_ops from public, anon, authenticated, service_role;
revoke all on all sequences in schema moderation, privacy_ops from public, anon, authenticated, service_role;

create function moderation.reject_action_log_change() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
  if TG_OP='DELETE' and old.retain_until<=clock_timestamp() then return old; end if;
  raise exception using errcode='42501', message='Moderation action evidence is append-only';
end $$;
create trigger moderation_action_log_immutable before update or delete on moderation.action_log
for each row execute function moderation.reject_action_log_change();
create trigger moderation_action_log_no_truncate before truncate on moderation.action_log
for each statement execute function moderation.reject_action_log_change();

-- This trigger runs before report_retention_origin alphabetically, while the
-- raw device value exists only in NEW. No stable source token is public.
create function moderation.reject_suppressed_source() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.device_id is not null and exists (
    select 1 from moderation.source_suppressions s
    where s.device_digest=extensions.digest(convert_to(new.device_id,'UTF8'),'sha256')
      and s.expires_at>clock_timestamp()
  ) then
    raise exception using errcode='42501', message='Community reporting is unavailable for this source';
  end if;
  return new;
end $$;
create trigger report_moderation_source_suppression before insert on public.reports
for each row execute function moderation.reject_suppressed_source();

create function moderation.submit_complaint(
  operation_id text, target_id uuid, complaint_reason text, reporter_device_id text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  op_digest bytea;
  reporter_digest bytea;
  report_digest bytea;
begin
  if operation_id is null
     or operation_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or target_id is null
     or complaint_reason not in ('dangerous_content','false_information','harassment','hate_or_abuse','spam','other')
     or reporter_device_id is null or length(reporter_device_id) not between 1 and 128 then
    return jsonb_build_object('status','invalid_request');
  end if;
  op_digest := extensions.digest(uuid_send(operation_id::uuid),'sha256');
  if exists (select 1 from moderation.complaints where operation_digest=op_digest) then
    return jsonb_build_object('status','already_processed');
  end if;
  if not exists (select 1 from public.reports r where r.id=target_id
    and r.moderation_state='visible' and r.cleanup_after>clock_timestamp()) then
    return jsonb_build_object('status','gone');
  end if;
  reporter_digest := extensions.digest(convert_to(reporter_device_id,'UTF8'),'sha256');
  if (select count(*) from moderation.complaints
      where reporter_device_digest=reporter_digest
        and created_at>clock_timestamp()-interval '1 hour') >= 10 then
    return jsonb_build_object('status','rate_limited');
  end if;
  report_digest := extensions.digest(uuid_send(target_id),'sha256');
  if exists (select 1 from moderation.complaints where target_report_id=target_id
    and reporter_device_digest=reporter_digest and reason=complaint_reason
    and created_at>clock_timestamp()-interval '24 hours') then
    return jsonb_build_object('status','already_processed');
  end if;
  insert into moderation.complaints(
    operation_digest,target_report_id,target_report_digest,reason,reporter_device_digest
  ) values (op_digest,target_id,report_digest,complaint_reason,reporter_digest);
  return jsonb_build_object('status','accepted');
exception when unique_violation then
  return jsonb_build_object('status','already_processed');
when others then
  return jsonb_build_object('status','retryable_failure');
end $$;

create function public.submit_community_moderation_report(
  operation_id text, target_report_id uuid, reason text, reporter_device_id text
) returns jsonb
language sql security invoker set search_path='' as $$
  select moderation.submit_complaint(operation_id,target_report_id,reason,reporter_device_id)
$$;

create function privacy_ops.request_deletion(
  operation_id text, target_id uuid, reporter_device_id text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  op_digest bytea;
  requester_digest bytea;
  request_id uuid;
begin
  if operation_id is null
     or operation_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or target_id is null
     or reporter_device_id is null or length(reporter_device_id) not between 1 and 128 then
    return jsonb_build_object('status','invalid_request');
  end if;
  op_digest := extensions.digest(uuid_send(operation_id::uuid),'sha256');
  select id into request_id from privacy_ops.deletion_requests where operation_digest=op_digest;
  if found then
    return jsonb_build_object('status','already_processed','request_id',request_id);
  end if;
  -- Device possession is the strongest available proof in this no-account app.
  -- A different device cannot request deletion of another source's report.
  if not exists (select 1 from report_retention.device_links l
    join public.reports r on r.id=l.report_id
    where l.report_id=target_id and l.device_id=reporter_device_id
      and r.cleanup_after>clock_timestamp()) then
    return jsonb_build_object('status','forbidden');
  end if;
  requester_digest := extensions.digest(convert_to(reporter_device_id,'UTF8'),'sha256');
  insert into privacy_ops.deletion_requests(
    operation_digest,target_report_id,target_report_digest,requester_device_digest
  ) values (
    op_digest,target_id,extensions.digest(uuid_send(target_id),'sha256'),requester_digest
  ) returning id into request_id;
  return jsonb_build_object('status','accepted','request_id',request_id);
exception when unique_violation then
  return jsonb_build_object('status','already_processed');
when others then
  return jsonb_build_object('status','retryable_failure');
end $$;

create function public.request_community_report_deletion(
  operation_id text, target_report_id uuid, reporter_device_id text
) returns jsonb
language sql security invoker set search_path='' as $$
  select privacy_ops.request_deletion(operation_id,target_report_id,reporter_device_id)
$$;

-- Owner-only operations. They remain in non-exposed schemas and receive no API
-- role grants. The runbooks require an owner transaction and bounded notes.
create function moderation.apply_action(
  complaint_id uuid, requested_action text, review_notes text default null
) returns text
language plpgsql security invoker set search_path='' as $$
declare
  complaint moderation.complaints%rowtype;
  source_device text;
  source_digest bytea;
  suppression_expiry timestamptz;
  outcome_text text;
begin
  if requested_action not in ('no_action','quarantine','remove','source_suppression')
     or (review_notes is not null and length(review_notes)>2000) then
    raise exception using errcode='22023', message='Invalid moderation action';
  end if;
  select * into complaint from moderation.complaints where id=complaint_id for update;
  if not found then raise exception using errcode='P0002', message='Complaint not found'; end if;

  if requested_action='quarantine' then
    update public.reports set moderation_state='quarantined' where id=complaint.target_report_id;
    outcome_text := 'target_quarantined';
  elsif requested_action='remove' then
    update public.reports set moderation_state='removed' where id=complaint.target_report_id;
    outcome_text := 'target_removed';
  elsif requested_action='source_suppression' then
    select l.device_id,least(r.linkage_deadline,clock_timestamp()+interval '180 days')
      into source_device,suppression_expiry
    from report_retention.device_links l join public.reports r on r.id=l.report_id
    where l.report_id=complaint.target_report_id;
    if source_device is null then
      raise exception using errcode='55000', message='Source linkage is no longer available';
    end if;
    source_digest := extensions.digest(convert_to(source_device,'UTF8'),'sha256');
    insert into moderation.source_suppressions(device_digest,complaint_id,expires_at,reason)
      values (source_digest,complaint.id,suppression_expiry,'moderator abuse prevention')
      on conflict (device_digest) do update set
        complaint_id=excluded.complaint_id,
        expires_at=least(moderation.source_suppressions.expires_at,excluded.expires_at),
        reason=excluded.reason;
    update public.reports r set moderation_state='removed'
      from report_retention.device_links l
      where r.id=l.report_id and l.device_id=source_device and r.cleanup_after>clock_timestamp();
    outcome_text := 'source_suppressed_and_current_reports_removed';
  else
    outcome_text := 'no_action';
  end if;

  update moderation.complaints set status='resolved',action=requested_action,
    reviewed_at=clock_timestamp(),notes=nullif(review_notes,'') where id=complaint.id;
  insert into moderation.action_log(complaint_id,target_report_digest,action,outcome,retain_until)
    values (complaint.id,complaint.target_report_digest,requested_action,outcome_text,
      complaint.retain_until+interval '31 days');
  return outcome_text;
end $$;

create function privacy_ops.complete_deletion_request(
  request_id uuid, requested_outcome text, review_notes text default null
) returns text
language plpgsql security invoker set search_path='' as $$
declare request privacy_ops.deletion_requests%rowtype;
begin
  if requested_outcome not in ('delete','quarantine','deny')
     or (review_notes is not null and length(review_notes)>2000) then
    raise exception using errcode='22023', message='Invalid deletion outcome';
  end if;
  select * into request from privacy_ops.deletion_requests where id=request_id for update;
  if not found then raise exception using errcode='P0002', message='Deletion request not found'; end if;
  if request.status<>'verified' then return 'already_completed'; end if;

  if requested_outcome='delete' then
    delete from public.reports where id=request.target_report_id;
  elsif requested_outcome='quarantine' then
    update public.reports set moderation_state='quarantined' where id=request.target_report_id;
  end if;
  update privacy_ops.deletion_requests set
    target_report_id=null,requester_device_digest=null,
    status=case when requested_outcome='deny' then 'denied' else 'completed' end,
    outcome=requested_outcome,reviewed_at=clock_timestamp(),completed_at=clock_timestamp(),
    notes=nullif(review_notes,''),retain_until=least(retain_until,clock_timestamp()+interval '90 days')
  where id=request.id;
  return requested_outcome;
end $$;

create function moderation.run_compliance_cleanup() returns bigint
language plpgsql security definer set search_path='' as $$
declare removed bigint; total_removed bigint := 0;
begin
  perform pg_advisory_xact_lock(24433,180);
  delete from moderation.source_suppressions where expires_at<=clock_timestamp();
  get diagnostics removed=row_count; total_removed:=total_removed+removed;
  update moderation.complaints set target_report_id=null,reporter_device_digest=null
    where retain_until<=clock_timestamp() and (target_report_id is not null or reporter_device_digest is not null);
  get diagnostics removed=row_count; total_removed:=total_removed+removed;
  delete from moderation.action_log where retain_until<=clock_timestamp();
  get diagnostics removed=row_count; total_removed:=total_removed+removed;
  delete from moderation.complaints where retain_until<=clock_timestamp()-interval '31 days';
  get diagnostics removed=row_count; total_removed:=total_removed+removed;
  update privacy_ops.deletion_requests set target_report_id=null,requester_device_digest=null
    where retain_until<=clock_timestamp() and (target_report_id is not null or requester_device_digest is not null);
  get diagnostics removed=row_count; total_removed:=total_removed+removed;
  delete from privacy_ops.deletion_requests where retain_until<=clock_timestamp();
  get diagnostics removed=row_count; total_removed:=total_removed+removed;
  return total_removed;
end $$;

-- Ensure definer-backed report projections and mutation results cannot reveal a
-- row after a moderator hides it, even when called by an owner RPC.
create or replace function report_retention.public_report(report_id uuid) returns jsonb
language sql stable set search_path=pg_catalog as $$
  select jsonb_build_object('id',r.id,'created_at',r.created_at,'crossing_id',r.crossing_id,
    'crossing_name',r.crossing_name,'railroad',r.railroad,'lat',r.lat,'lng',r.lng,
    'report_type',r.report_type,'severity',r.severity,'detail',r.detail,'source',r.source,
    'confidence',r.confidence,'expires_at',r.expires_at)
  from public.reports r where r.id=report_id and r.moderation_state='visible'
    and r.cleanup_after>statement_timestamp()
$$;

revoke all on all functions in schema moderation, privacy_ops from public, anon, authenticated, service_role;
revoke all on function public.submit_community_moderation_report(text,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.request_community_report_deletion(text,uuid,text) from public,anon,authenticated,service_role;

-- The public wrappers are exposed; the implementation functions are callable
-- only through those wrappers because these schemas are not API-exposed.
grant usage on schema moderation, privacy_ops to anon, authenticated;
grant execute on function moderation.submit_complaint(text,uuid,text,text) to anon, authenticated;
grant execute on function privacy_ops.request_deletion(text,uuid,text) to anon, authenticated;
grant execute on function public.submit_community_moderation_report(text,uuid,text,text) to anon, authenticated;
grant execute on function public.request_community_report_deletion(text,uuid,text) to anon, authenticated;

-- No tables, sequences, owner actions, cleanup functions, or source identifiers
-- are granted to an API role. Production reporting remains disabled by the
-- existing admission-state contract; this migration does not enable it.
commit;
