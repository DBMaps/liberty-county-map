-- LP100 infrastructure only: hashed cache keys and an atomic global provider lease.
create table if not exists public.gridly_geocode_cache (
  cache_key text primary key check (cache_key ~ '^[a-f0-9]{64}$'),
  provider_namespace text not null,
  response jsonb not null,
  status text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.gridly_geocode_cache enable row level security;
revoke all on public.gridly_geocode_cache from anon, authenticated;

create table if not exists public.gridly_geocode_provider_state (
  provider_namespace text primary key,
  next_allowed_at timestamptz not null default now(),
  cooldown_until timestamptz not null default now()
);
alter table public.gridly_geocode_provider_state enable row level security;
revoke all on public.gridly_geocode_provider_state from anon, authenticated;

create or replace function public.gridly_reserve_geocode_provider_slot(p_namespace text, p_interval_ms integer)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare reserved_at timestamptz;
begin
  insert into gridly_geocode_provider_state(provider_namespace) values (p_namespace)
  on conflict (provider_namespace) do nothing;
  update gridly_geocode_provider_state
     set next_allowed_at = greatest(next_allowed_at, cooldown_until, clock_timestamp()) + make_interval(secs => p_interval_ms / 1000.0)
   where provider_namespace = p_namespace
   returning next_allowed_at - make_interval(secs => p_interval_ms / 1000.0) into reserved_at;
  return reserved_at;
end $$;
revoke all on function public.gridly_reserve_geocode_provider_slot(text, integer) from public, anon, authenticated;

create or replace function public.gridly_cooldown_geocode_provider(p_namespace text, p_seconds integer)
returns void language sql security definer set search_path = public as $$
  insert into gridly_geocode_provider_state(provider_namespace, cooldown_until)
  values (p_namespace, clock_timestamp() + make_interval(secs => greatest(1, least(p_seconds, 3600))))
  on conflict (provider_namespace) do update
    set cooldown_until = greatest(gridly_geocode_provider_state.cooldown_until, excluded.cooldown_until);
$$;
revoke all on function public.gridly_cooldown_geocode_provider(text, integer) from public, anon, authenticated;

create index if not exists gridly_geocode_cache_expiry_idx on public.gridly_geocode_cache(expires_at);
