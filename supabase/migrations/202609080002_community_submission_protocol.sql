-- LP244.21C HARD PRE-LAUNCH CUTOVER. Local preparation only; separate deployment approval.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table report_retention.replay_evidence (
  token_digest bytea primary key check (octet_length(token_digest)=32),
  first_accepted_at timestamptz not null default clock_timestamp()
);
alter table report_retention.replay_evidence enable row level security;
revoke all on report_retention.replay_evidence from public,anon,authenticated,service_role;

create function report_retention.preserve_replay_evidence() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin raise exception using errcode='42501',message='Replay evidence is append-only'; end $$;
create trigger replay_evidence_immutable before update or delete on report_retention.replay_evidence
for each row execute function report_retention.preserve_replay_evidence();
create trigger replay_evidence_no_truncate before truncate on report_retention.replay_evidence
for each statement execute function report_retention.preserve_replay_evidence();

-- LP244.21D: transient provenance for live observations. Cascades at cleanup;
-- it is NOT retained in the permanent replay ledger or historical aggregates.
create table report_retention.observation_receipts (
  report_id uuid primary key references public.reports(id) on delete cascade,
  token_digest bytea not null unique references report_retention.replay_evidence(token_digest),
  original_submitted_at timestamptz not null
);
alter table report_retention.observation_receipts enable row level security;
revoke all on report_retention.observation_receipts from public,anon,authenticated,service_role;
create trigger observation_receipt_immutable before update on report_retention.observation_receipts
for each row execute function report_retention.preserve_replay_evidence();

-- No raw token or device/condition reference is retained in this ledger.
-- UUID bytes are canonicalized before hashing (case cannot bypass uniqueness).
create function report_retention.claim_operation(token text) returns boolean
language plpgsql set search_path=pg_catalog as $$
declare claimed bytea;
begin
  if token is null or token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  insert into report_retention.replay_evidence(token_digest)
    values (extensions.digest(uuid_send(token::uuid),'sha256'))
    on conflict do nothing returning token_digest into claimed;
  return claimed is not null;
end $$;

-- Only bounded, non-identifying status and the normal public condition projection
-- leave the RPC. A retry never discloses the original submitter or original row.
create function report_retention.public_report(report_id uuid) returns jsonb
language sql stable set search_path=pg_catalog as $$
  select jsonb_build_object('id',r.id,'created_at',r.created_at,'crossing_id',r.crossing_id,
    'crossing_name',r.crossing_name,'railroad',r.railroad,'lat',r.lat,'lng',r.lng,
    'report_type',r.report_type,'severity',r.severity,'detail',r.detail,'source',r.source,
    'confidence',r.confidence,'expires_at',r.expires_at)
  from public.reports r where r.id=report_id
$$;

create function public.submit_community_observation(submission_token text, report jsonb, reporter_device_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare new_id uuid; key text;
begin
  if submission_token is null or submission_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(report) is distinct from 'object' or octet_length(report::text)>12000
    or reporter_device_id is null or length(reporter_device_id) not between 1 and 128
    or position(lower(submission_token) in lower(report::text))>0
    or position(lower(submission_token) in lower(reporter_device_id))>0 then
    return jsonb_build_object('status','invalid_request');
  end if;
  for key in select jsonb_object_keys(report) loop
    if key <> all(array['crossing_id','crossing_name','railroad','lat','lng','report_type','severity','detail','source','confidence','expires_at']) then
      return jsonb_build_object('status','invalid_request');
    end if;
  end loop;
  if coalesce(report->>'report_type','') in ('','cleared','hazard_cleared')
    or coalesce(report->>'crossing_id','')=''
    or coalesce(report->>'crossing_name','')=''
    or coalesce(report->>'severity','')=''
    or coalesce(report->>'detail','') ~* 'lifecycle_report_id:' then
    return jsonb_build_object('status','invalid_request');
  end if;
  -- A supplied UUIDv4 is independent protocol input; never synthesize one for legacy callers.
  -- Unique insert waits for a concurrent claimant's commit/rollback, atomically.
  if not report_retention.claim_operation(submission_token) then
    return jsonb_build_object('status','already_processed');
  end if;
  insert into public.reports(crossing_id,crossing_name,railroad,lat,lng,report_type,severity,
    detail,source,confidence,device_id,expires_at)
  values (report->>'crossing_id',report->>'crossing_name',report->>'railroad',
    (report->>'lat')::double precision,(report->>'lng')::double precision,report->>'report_type',
    report->>'severity',report->>'detail','user',report->>'confidence',reporter_device_id,
    least(coalesce((report->>'expires_at')::timestamptz,clock_timestamp()+interval '90 minutes'),clock_timestamp()+interval '90 minutes'))
  returning id into new_id;
  insert into report_retention.observation_receipts(report_id,token_digest,original_submitted_at)
    select id,extensions.digest(uuid_send(submission_token::uuid),'sha256'),original_submitted_at
    from public.reports where id=new_id;
  return jsonb_build_object('status','accepted','report',report_retention.public_report(new_id));
exception when others then
  -- PL/pgSQL exception subtransaction rolls back BOTH ledger claim and row/link.
  -- Never propagate row, body, token, SQLERRM or device information in an error.
  return jsonb_build_object('status','retryable_failure');
end $$;

create function public.mutate_community_observation(operation_id text, observation_id uuid,
  action text, changes jsonb default '{}'::jsonb, reporter_device_id text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare original public.reports%rowtype; key text;
begin
  if operation_id is null or operation_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or action is null or action not in ('confirm','edit','clear') or observation_id is null
    or jsonb_typeof(changes) is distinct from 'object' or octet_length(changes::text)>8000
    or position(lower(operation_id) in lower(changes::text))>0 then
    return jsonb_build_object('status','invalid_request');
  end if;
  for key in select jsonb_object_keys(changes) loop
    if action<>'edit' or key<>all(array['detail','severity']) then
      return jsonb_build_object('status','invalid_request');
    end if;
  end loop;
  if not report_retention.claim_operation(operation_id) then
    return jsonb_build_object('status','already_processed');
  end if;
  select * into original from public.reports where id=observation_id for update;
  if not found or original.cleanup_after<=clock_timestamp() then
    return jsonb_build_object('status','gone');
  end if;
  -- Community confirmations/clears preserve the existing community workflow.
  -- Edits require the original device association while it exists. This remains
  -- pseudonymous device possession, not a claim of registered-account identity.
  if action='edit' and not exists (select 1 from report_retention.device_links
    where report_id=observation_id and device_id=reporter_device_id) then
    return jsonb_build_object('status','forbidden');
  end if;
  if action='clear' then
    update public.reports set report_type=case when crossing_id like 'hazard-%' then 'hazard_cleared' else 'cleared' end,
      confidence='Community clearing received',expires_at=least(cleanup_after,clock_timestamp()+interval '30 minutes')
      where id=observation_id;
  elsif action='confirm' then
    if original.report_type in ('cleared','hazard_cleared') then return jsonb_build_object('status','gone'); end if;
    update public.reports set confidence='Community confirmation received' where id=observation_id;
  else
    update public.reports set detail=coalesce(changes->>'detail',detail),severity=coalesce(changes->>'severity',severity)
      where id=observation_id;
  end if;
  return jsonb_build_object('status','accepted','report',report_retention.public_report(observation_id));
exception when others then
  return jsonb_build_object('status','retryable_failure');
end $$;

-- Terminal cancellation consumes an operation identity without storing its payload.
-- It lets a bounded client discard a stale pending payload without making its ID reusable.
create function public.cancel_community_operation(operation_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if operation_id is null or operation_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return jsonb_build_object('status','invalid_request');
  end if;
  if report_retention.claim_operation(operation_id) then return jsonb_build_object('status','cancelled'); end if;
  return jsonb_build_object('status','already_processed');
end $$;

-- Hard cutover: existing direct INSERT and UPDATE cannot reach the owner RPC path.
revoke insert on public.reports from public,anon,authenticated,service_role;
do $$ declare c record; begin
  for c in select attname from pg_attribute where attrelid='public.reports'::regclass and attnum>0 and not attisdropped loop
    execute format('revoke insert (%I) on public.reports from public,anon,authenticated,service_role',c.attname);
  end loop;
end $$;
revoke all on all functions in schema report_retention from public,anon,authenticated,service_role;
revoke all on function public.submit_community_observation(text,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.mutate_community_observation(text,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.submit_community_observation(text,jsonb,text) to anon,authenticated;
grant execute on function public.mutate_community_observation(text,uuid,text,jsonb,text) to anon,authenticated;
revoke all on function public.cancel_community_operation(text) from public,anon,authenticated,service_role;
grant execute on function public.cancel_community_operation(text) to anon,authenticated;
commit;
