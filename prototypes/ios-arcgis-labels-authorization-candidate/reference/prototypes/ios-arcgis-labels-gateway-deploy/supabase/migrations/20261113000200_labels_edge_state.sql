begin;
create role label_pilot_runtime login inherit nosuperuser nocreatedb nocreaterole noreplication;
grant label_pilot_gateway to label_pilot_runtime;
revoke execute on function label_pilot.issue(jsonb,uuid,bigint,bigint) from label_pilot_gateway;
revoke execute on function label_pilot.revoke(uuid) from label_pilot_gateway;

alter table label_pilot.control
  add column ingress_minute bigint not null default -1,
  add column ingress_count integer not null default 0,
  add column ingress_limit integer not null default 240 check (ingress_limit between 1 and 1000),
  add column oauth_minute bigint not null default -1,
  add column oauth_count integer not null default 0,
  add column oauth_limit integer not null default 12 check (oauth_limit between 1 and 60),
  add column installation_limit integer not null default 500 check (installation_limit between 1 and 500),
  add column lineage_limit integer not null default 1000 check (lineage_limit between 1 and 1000),
  add column daily_limit integer not null default 10000 check (daily_limit between 1 and 10000),
  add column minute_limit integer not null default 60 check (minute_limit between 1 and 60),
  add column installation_active_limit integer not null default 4 check (installation_active_limit between 1 and 4),
  add column active_limit integer not null default 64 check (active_limit between 1 and 64);

create table label_pilot.pending_challenges (id uuid primary key, expires_at bigint not null);
create index on label_pilot.pending_challenges (expires_at);
create index on label_pilot.leases (spki);

-- One row for the current UTC day. No request IDs, paths, or identities.
create table label_pilot.telemetry (
  id boolean primary key check (id),
  utc_day bigint not null default -1,
  counters jsonb not null default '{}'::jsonb
);
insert into label_pilot.telemetry(id) values (true);

create function label_pilot.record_outcome(outcome text, elapsed_ms integer) returns void
language plpgsql security definer set search_path = pg_catalog as $$
declare
  current_day bigint := floor(extract(epoch from clock_timestamp()) / 86400)::bigint;
  previous_day bigint;
  totals jsonb;
  bucket text;
begin
  if outcome is null or outcome not in ('ok','authorization_denied','quota_exhausted',
    'provider_failed','provider_timeout','unavailable','cancelled','invalid','tile_dispatch_intent','oauth_dispatch_intent') or elapsed_ms is null
    or elapsed_ms < 0 or elapsed_ms > 10000 then return; end if;
  bucket := case when elapsed_ms <= 50 then 'latency_le_50' when elapsed_ms <= 250 then 'latency_le_250'
    when elapsed_ms <= 1000 then 'latency_le_1000' else 'latency_gt_1000' end;
  select utc_day, counters into strict previous_day, totals from label_pilot.telemetry where id for update;
  if current_day > previous_day then totals := '{}'::jsonb; end if;
  totals := jsonb_set(totals, array[outcome], to_jsonb(least(2147483647::bigint, coalesce((totals->>outcome)::bigint, 0) + 1)));
  if outcome not in ('tile_dispatch_intent','oauth_dispatch_intent') then
    totals := jsonb_set(totals, array[bucket], to_jsonb(least(2147483647::bigint, coalesce((totals->>bucket)::bigint, 0) + 1)));
  end if;
  update label_pilot.telemetry set utc_day = greatest(current_day, previous_day), counters = totals where id;
end
$$;

create function label_pilot.preflight() returns text
language plpgsql security definer set search_path = pg_catalog as $$
declare
  current_minute bigint := floor(extract(epoch from clock_timestamp()) / 60)::bigint;
begin
  update label_pilot.control set
    ingress_count = case when ingress_minute < current_minute then 1 else ingress_count + 1 end,
    ingress_minute = greatest(ingress_minute, current_minute)
    where id and enabled and (ingress_minute < current_minute or ingress_count < ingress_limit);
  return case when found then 'ok' else 'limited' end;
end
$$;

create function label_pilot.new_challenge(challenge uuid) returns bigint
language plpgsql security definer set search_path = pg_catalog as $$
declare
  current_ms bigint := label_pilot.tick(0);
  expiry bigint := current_ms + 120000;
begin
  if not (select enabled from label_pilot.control where id) then return null; end if;
  delete from label_pilot.pending_challenges where expires_at <= current_ms;
  if (select count(*) from label_pilot.pending_challenges) >= 1024 then return null; end if;
  insert into label_pilot.pending_challenges values (challenge, expiry);
  return expiry;
end
$$;

create function label_pilot.reserve_oauth() returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
declare current_minute bigint := floor(extract(epoch from clock_timestamp()) / 60)::bigint;
begin
  update label_pilot.control set
    oauth_count = case when oauth_minute < current_minute then 1 else oauth_count + 1 end,
    oauth_minute = greatest(oauth_minute, current_minute)
    where id and enabled and (oauth_minute < current_minute or oauth_count < oauth_limit);
  return found;
end
$$;

create function label_pilot.challenge_is_pending(challenge uuid) returns boolean
language sql volatile security definer set search_path = pg_catalog as $$
  select c.enabled and exists (
    select from label_pilot.pending_challenges p
    where p.id = challenge and p.expires_at > greatest(c.last_ms, floor(extract(epoch from clock_timestamp()) * 1000)::bigint)
  ) from label_pilot.control c where c.id
$$;

create function label_pilot.admit(candidate jsonb, challenge uuid, challenge_expiry bigint, at_ms bigint)
returns text language plpgsql security definer set search_path = pg_catalog as $$
declare
  current_ms bigint := label_pilot.tick(0);
  issued_expiry bigint;
begin
  if not (select enabled from label_pilot.control where id) then return 'disabled'; end if;
  if abs(current_ms - at_ms) > 30000 then return 'denied'; end if;
  delete from label_pilot.pending_challenges where id = challenge and expires_at > current_ms
    returning expires_at into issued_expiry;
  if not found then return 'denied'; end if;
  if exists (select from label_pilot.leases where spki = candidate->>'spki'
    and installation <> candidate->>'installation') then return 'denied'; end if;
  return label_pilot.issue(candidate, challenge, least(challenge_expiry, issued_expiry), current_ms);
end
$$;

create or replace function label_pilot.reserve(lease_id uuid, request_id uuid, at_ms bigint) returns text
language plpgsql security definer set search_path = pg_catalog as $$
declare
  current_ms bigint := label_pilot.tick(0);
  bound label_pilot.leases%rowtype;
  arrivals bigint[];
  policy label_pilot.control%rowtype;
begin
  select * into strict policy from label_pilot.control where id;
  if not policy.enabled then return 'disabled'; end if;
  if abs(current_ms - at_ms) > 30000 then return 'denied'; end if;
  select * into bound from label_pilot.leases where id = lease_id and not revoked;
  if not found or exists (select from label_pilot.replays where lease = lease_id and id = request_id)
    then return 'denied'; end if;
  select array(select t from unnest(i.arrivals) t where t > current_ms - 60000)
    into arrivals from label_pilot.ingress i where i.id = bound.installation;
  if not found and (select count(*) from label_pilot.ingress) >= 10000 then return 'limited'; end if;
  if coalesce(cardinality(arrivals), 0) >= policy.minute_limit then return 'limited'; end if;
  insert into label_pilot.ingress values (bound.installation, current_ms, array_append(arrivals, current_ms))
    on conflict (id) do update set last_ms = excluded.last_ms, arrivals = excluded.arrivals;
  if policy.attempts >= policy.daily_limit or
     (select attempts from label_pilot.installation_daily where id = bound.installation) >= policy.installation_limit or
     (select attempts from label_pilot.lineage_daily where id = bound.lineage) >= policy.lineage_limit or
     (select count(*) from label_pilot.active) >= policy.active_limit or
     (select count(*) from label_pilot.active where installation = bound.installation) >= policy.installation_active_limit or
     (select count(*) from label_pilot.replays where lease = lease_id) >= 512 then return 'limited'; end if;
  insert into label_pilot.replays values (lease_id, request_id);
  insert into label_pilot.active values (lease_id, request_id, bound.installation);
  insert into label_pilot.installation_daily values (bound.installation, 1)
    on conflict (id) do update set attempts = installation_daily.attempts + 1;
  insert into label_pilot.lineage_daily values (bound.lineage, 1)
    on conflict (id) do update set attempts = lineage_daily.attempts + 1;
  update label_pilot.control set attempts = attempts + 1 where id;
  return 'ok';
end
$$;

create or replace function label_pilot.finish(lease_id uuid, request_id uuid, at_ms bigint) returns text
language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform label_pilot.tick(0);
  delete from label_pilot.active where lease = lease_id and id = request_id;
  if found and (select enabled from label_pilot.control where id) and
     exists (select from label_pilot.leases where id = lease_id and not revoked) then return 'ok'; end if;
  return 'denied';
end
$$;

create function label_pilot.pilot_disable() returns void
language plpgsql set search_path = pg_catalog as $$
begin
  perform label_pilot.set_enabled(false);
  delete from label_pilot.pending_challenges;
end
$$;

create function label_pilot.cleanup_expired() returns void
language plpgsql set search_path = pg_catalog as $$
declare current_ms bigint := label_pilot.tick(0);
begin
  delete from label_pilot.pending_challenges where expires_at <= current_ms;
end
$$;

-- Offline-only operator action. The operator must close ingress and fence
-- egress, then prove all old workers have stopped before invoking this.
create function label_pilot.recover_after_drain() returns bigint
language plpgsql set search_path = pg_catalog as $$
declare recovered bigint;
begin
  perform 1 from label_pilot.control where id and not enabled for update;
  if not found then raise exception 'pilot_must_be_disabled'; end if;
  if exists (select from label_pilot.leases where not revoked) then raise exception 'leases_must_be_revoked'; end if;
  delete from label_pilot.active;
  get diagnostics recovered = row_count;
  return recovered;
end
$$;

alter table label_pilot.leases enable row level security;
alter table label_pilot.challenges enable row level security;
alter table label_pilot.pending_challenges enable row level security;
alter table label_pilot.replays enable row level security;
alter table label_pilot.active enable row level security;
alter table label_pilot.telemetry enable row level security;

revoke all on label_pilot.pending_challenges, label_pilot.telemetry from public;
revoke all on function label_pilot.preflight(), label_pilot.new_challenge(uuid),
  label_pilot.admit(jsonb,uuid,bigint,bigint), label_pilot.reserve_oauth(), label_pilot.challenge_is_pending(uuid),
  label_pilot.pilot_disable(), label_pilot.cleanup_expired(), label_pilot.recover_after_drain(),
  label_pilot.record_outcome(text,integer) from public;
grant execute on function label_pilot.preflight(), label_pilot.new_challenge(uuid),
  label_pilot.admit(jsonb,uuid,bigint,bigint), label_pilot.reserve_oauth(), label_pilot.challenge_is_pending(uuid),
  label_pilot.record_outcome(text,integer)
  to label_pilot_gateway;
commit;
