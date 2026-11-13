-- Draft for a dedicated nonproduction database. Apply as the migration owner.
begin;
create schema label_pilot;
create role label_pilot_gateway nologin;
revoke all on schema label_pilot from public;

create table label_pilot.control (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  last_ms bigint not null default 0,
  utc_day bigint not null default -1,
  attempts integer not null default 0
);
insert into label_pilot.control default values;

create table label_pilot.leases (
  id uuid primary key,
  spki text not null check (spki ~ '^[A-Za-z0-9_-]{122}$'),
  expires_at bigint not null,
  installation text not null check (installation ~ '^[A-Za-z0-9_-]{1,64}$'),
  lineage text not null check (lineage ~ '^[A-Za-z0-9_-]{1,64}$'),
  revoked boolean not null default false
);
create index on label_pilot.leases (expires_at);
create table label_pilot.challenges (id uuid primary key, expires_at bigint not null);
create index on label_pilot.challenges (expires_at);
create table label_pilot.replays (
  lease uuid not null references label_pilot.leases on delete cascade,
  id uuid not null,
  primary key (lease, id)
);
create table label_pilot.active (
  lease uuid not null,
  id uuid not null,
  installation text not null,
  primary key (lease, id)
);
create index on label_pilot.active (installation);
create table label_pilot.installation_daily (id text primary key, attempts integer not null);
create table label_pilot.lineage_daily (id text primary key, attempts integer not null);
create table label_pilot.ingress (
  id text primary key,
  last_ms bigint not null,
  arrivals bigint[] not null
);
create index on label_pilot.ingress (last_ms);

-- Serialize the bounded pilot's short state transitions. No network operation
-- holds this lock. The DB clock and high-water mark cover queueing and clock skew.
create function label_pilot.tick(at_ms bigint) returns bigint
language plpgsql set search_path = pg_catalog as $$
declare
  current_ms bigint;
  current_day bigint;
  previous_day bigint;
begin
  select greatest(last_ms, at_ms, floor(extract(epoch from clock_timestamp()) * 1000)::bigint), utc_day
    into strict current_ms, previous_day from label_pilot.control where id for update;
  current_day := current_ms / 86400000;
  if current_day > previous_day then
    delete from label_pilot.installation_daily;
    delete from label_pilot.lineage_daily;
    update label_pilot.control set utc_day = current_day, attempts = 0 where id;
  end if;
  update label_pilot.control set last_ms = current_ms where id;
  delete from label_pilot.leases where expires_at <= current_ms;
  delete from label_pilot.challenges where expires_at <= current_ms;
  delete from label_pilot.ingress where last_ms <= current_ms - 60000;
  return current_ms;
end
$$;

create function label_pilot.issue(candidate jsonb, challenge uuid, challenge_expiry bigint, at_ms bigint)
returns text language plpgsql security definer set search_path = pg_catalog as $$
declare
  current_ms bigint := label_pilot.tick(at_ms);
  expiry bigint := (candidate->>'expiresAt')::bigint;
begin
  if not (select enabled from label_pilot.control where id) then return 'disabled'; end if;
  if expiry <= current_ms or expiry > current_ms + 300000 or challenge_expiry <= current_ms or
     challenge_expiry > current_ms + 120000 or
     exists (select from label_pilot.challenges where id = challenge) then return 'denied'; end if;
  if (select count(*) from label_pilot.leases) >= 10000 or
     (select count(*) from label_pilot.challenges) >= 10000 then return 'limited'; end if;
  insert into label_pilot.challenges values (challenge, challenge_expiry);
  insert into label_pilot.leases (id, spki, expires_at, installation, lineage)
    values ((candidate->>'id')::uuid, candidate->>'spki', expiry, candidate->>'installation', candidate->>'lineage');
  return 'ok';
end
$$;

create function label_pilot.get_lease(lease_id uuid) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object('spki', spki, 'expiresAt', expires_at, 'revoked', revoked)
    from label_pilot.leases where id = lease_id
$$;

create function label_pilot.reserve(lease_id uuid, request_id uuid, at_ms bigint) returns text
language plpgsql security definer set search_path = pg_catalog as $$
declare
  current_ms bigint := label_pilot.tick(at_ms);
  bound label_pilot.leases%rowtype;
  arrivals bigint[];
begin
  if not (select enabled from label_pilot.control where id) then return 'disabled'; end if;
  select * into bound from label_pilot.leases where id = lease_id and not revoked;
  if not found or exists (select from label_pilot.replays where lease = lease_id and id = request_id)
    then return 'denied'; end if;
  select array(select t from unnest(i.arrivals) t where t > current_ms - 60000)
    into arrivals from label_pilot.ingress i where i.id = bound.installation;
  if not found and (select count(*) from label_pilot.ingress) >= 10000 then return 'limited'; end if;
  if coalesce(cardinality(arrivals), 0) >= 60 then return 'limited'; end if;
  insert into label_pilot.ingress values (bound.installation, current_ms, array_append(arrivals, current_ms))
    on conflict (id) do update set last_ms = excluded.last_ms, arrivals = excluded.arrivals;
  if (select attempts from label_pilot.control where id) >= 10000 or
     (select attempts from label_pilot.installation_daily where id = bound.installation) >= 500 or
     (select attempts from label_pilot.lineage_daily where id = bound.lineage) >= 1000 or
     (select count(*) from label_pilot.active) >= 64 or
     (select count(*) from label_pilot.active where installation = bound.installation) >= 4 or
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

create function label_pilot.finish(lease_id uuid, request_id uuid, at_ms bigint) returns text
language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform label_pilot.tick(at_ms);
  delete from label_pilot.active where lease = lease_id and id = request_id;
  if found and (select enabled from label_pilot.control where id) and
     exists (select from label_pilot.leases where id = lease_id and not revoked) then return 'ok'; end if;
  return 'denied';
end
$$;

create function label_pilot.revoke(lease_id uuid) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform 1 from label_pilot.control where id for update;
  update label_pilot.leases set revoked = true where id = lease_id;
  return found;
end
$$;

create function label_pilot.set_enabled(value boolean) returns void
language plpgsql set search_path = pg_catalog as $$
begin
  update label_pilot.control set enabled = value where id;
  if not value then update label_pilot.leases set revoked = true where not revoked; end if;
end
$$;

revoke all on all functions in schema label_pilot from public;
revoke all on all tables in schema label_pilot from public;
grant usage on schema label_pilot to label_pilot_gateway;
grant select (id, enabled) on label_pilot.control to label_pilot_gateway;
grant execute on function label_pilot.issue(jsonb,uuid,bigint,bigint), label_pilot.get_lease(uuid),
  label_pilot.reserve(uuid,uuid,bigint), label_pilot.finish(uuid,uuid,bigint), label_pilot.revoke(uuid)
  to label_pilot_gateway;
commit;
