-- Additive reviewer authority: one credential-state row, no report records/jobs.
begin;
create schema if not exists google_review;
revoke all on schema google_review from public,anon,authenticated,service_role;
create table if not exists google_review.credentials (
  id text primary key check(id ~ '^grr_[a-f0-9]{32}$'),
  credential_hash text not null check(credential_hash ~ '^[a-f0-9]{64}$'),
  revision text not null check(revision ~ '^[a-f0-9]{32}$'),
  enabled boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  window_started_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 0 check(attempts between 0 and 61),
  last_verified_at timestamptz,
  last_denied_at timestamptz,
  successful_verifications integer not null default 0 check(successful_verifications between 0 and 1000000000),
  denials integer not null default 0 check(denials between 0 and 1000000000),
  last_access_at timestamptz
);
-- An existing incompatible object aborts the transaction; it is not replaced.
do $$ begin
  if (select count(*) from pg_attribute where attrelid='google_review.credentials'::regclass and attnum>0 and not attisdropped)<>12
    or exists(select 1 from pg_attribute where attrelid='google_review.credentials'::regclass and attnum>0 and not attisdropped
      and (attname,atttypid::regtype::text) not in (('id','text'),('credential_hash','text'),('revision','text'),('enabled','boolean'),
        ('created_at','timestamp with time zone'),('window_started_at','timestamp with time zone'),('attempts','integer'),
        ('last_verified_at','timestamp with time zone'),('last_denied_at','timestamp with time zone'),
        ('successful_verifications','integer'),('denials','integer'),('last_access_at','timestamp with time zone')))
    then raise exception 'Incompatible reviewer credential schema'; end if;
end $$;
alter table google_review.credentials enable row level security;
revoke all on table google_review.credentials from public,anon,authenticated,service_role;

-- Define once; a rerun verifies the exact body and privileges rather than
-- replacing a potentially changed function. Only credential metadata is input.
do $definition$
declare
  function_oid regprocedure;
  function_body text=$body$
declare
  credential google_review.credentials%rowtype;
  stamp timestamptz=clock_timestamp();
begin
  if p_action is null or p_action not in ('login','verified','denied','report') or
    p_credential is null or p_credential !~ '^grr_[a-f0-9]{32}$' then return null; end if;
  if p_action='login' then
    if p_digest is null or p_digest !~ '^[a-f0-9]{64}$' or p_revision is not null then return null; end if;
  elsif p_digest is not null or p_revision is null or p_revision !~ '^[a-f0-9]{32}$' then return null;
  end if;
  select * into credential from google_review.credentials where id=p_credential for update;
  if not found then return null; end if;
  if p_action in ('login','report') then
    if stamp>=credential.window_started_at+interval '1 minute' or stamp<credential.window_started_at then
      credential.window_started_at=stamp;credential.attempts=0;
    end if;
    credential.attempts=least(credential.attempts+1,61);
    update google_review.credentials set window_started_at=credential.window_started_at,attempts=credential.attempts
      where id=p_credential;
  end if;
  if not credential.enabled or credential.attempts>60 or
    (p_action='login' and credential.credential_hash<>p_digest) or
    (p_action<>'login' and credential.revision<>p_revision) or p_action='denied' then
    update google_review.credentials set last_denied_at=stamp,denials=least(denials+1,1000000000)
      where id=p_credential;
    return null;
  end if;
  if p_action='verified' then
    update google_review.credentials set last_verified_at=stamp,successful_verifications=least(successful_verifications+1,1000000000)
      where id=p_credential;
  elsif p_action='report' then
    update google_review.credentials set last_access_at=stamp where id=p_credential;
  end if;
  return jsonb_build_object('credentialId',credential.id,'credentialRevision',credential.revision);
end
$body$;
begin
  function_oid=to_regprocedure('public.gridly_google_review_authorize(text,text,text,text)');
  if function_oid is null then
    execute format('create function public.gridly_google_review_authorize(p_action text,p_credential text,p_digest text,p_revision text) returns jsonb language plpgsql security definer set search_path=pg_catalog as %L',function_body);
  elsif not exists(select 1 from pg_proc where oid=function_oid and prosrc=function_body and prosecdef
    and prorettype='jsonb'::regtype and proconfig=array['search_path=pg_catalog']) then
    raise exception 'Existing reviewer authority differs; review before changing it';
  end if;
end
$definition$;
revoke all on function public.gridly_google_review_authorize(text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.gridly_google_review_authorize(text,text,text,text) to service_role;
commit;
