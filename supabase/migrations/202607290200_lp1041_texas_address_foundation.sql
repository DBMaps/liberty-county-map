-- LP104.1: protected, county-partitionable statewide address-point foundation.
create extension if not exists postgis with schema extensions;
create table if not exists public.gridly_texas_county_boundaries (county_fips text primary key check (county_fips ~ '^48[0-9]{3}$'), geom extensions.geometry(multipolygon,4326) not null, boundary_version text not null);
create index if not exists gridly_texas_county_boundaries_geom_idx on public.gridly_texas_county_boundaries using gist(geom);
alter table public.gridly_texas_county_boundaries enable row level security;
revoke all on public.gridly_texas_county_boundaries from anon,authenticated;
create table if not exists public.gridly_texas_address_points (
  id text not null, lookup_hash text not null, house_number text not null,
  canonical_road_identity text not null, locality text not null default '', locality_aliases text[] not null default '{}',
  county_id text not null, county_fips text not null check (county_fips ~ '^48[0-9]{3}$'), state text not null check (state = 'TX'),
  postal_code text not null default '', latitude double precision not null check(latitude between 25 and 37), longitude double precision not null check(longitude between -107 and -93),
  precision text not null, source_id text not null, source_authority text not null, source_version text not null,
  source_date date, source_license text not null, attribution_required boolean not null, consumer_eligible boolean not null default false,
  build_version text not null, primary key(county_fips,id)
) partition by list (county_fips);
create table if not exists public.gridly_texas_address_points_default partition of public.gridly_texas_address_points default;
create index if not exists gridly_tx_address_exact_idx on public.gridly_texas_address_points(county_fips,lookup_hash) where consumer_eligible;
alter table public.gridly_texas_address_points enable row level security;
revoke all on public.gridly_texas_address_points from anon, authenticated;

create or replace function public.gridly_lookup_texas_address(p_lookup_hash text, p_county_fips text)
returns table(id text,house_number text,canonical_road_identity text,locality text,county_id text,county_fips text,state text,postal_code text,latitude double precision,longitude double precision,precision text,source_id text,source_authority text,source_version text,source_date date,source_license text,attribution_required boolean,build_version text)
language sql stable security definer set search_path=public as $$
 select a.id,a.house_number,a.canonical_road_identity,a.locality,a.county_id,a.county_fips,a.state,a.postal_code,a.latitude,a.longitude,a.precision,a.source_id,a.source_authority,a.source_version,a.source_date,a.source_license,a.attribution_required,a.build_version
 from public.gridly_texas_address_points a join public.gridly_texas_county_boundaries b on b.county_fips=a.county_fips where a.lookup_hash=p_lookup_hash and a.county_fips=p_county_fips and a.consumer_eligible=true and extensions.st_covers(b.geom,extensions.st_setsrid(extensions.st_point(a.longitude,a.latitude),4326)) order by
 case a.source_authority when 'county_911' then 0 when 'regional_911' then 1 when 'statewide_authoritative' then 2 when 'national_address_database' then 3 when 'open_address_point' then 4 when 'gridly_verified_exception' then 5 else 99 end,
 a.source_date desc nulls last,a.source_id,a.id limit 3;
$$;
revoke all on function public.gridly_lookup_texas_address(text,text) from public,anon,authenticated;
grant execute on function public.gridly_lookup_texas_address(text,text) to service_role;
