-- LP103 private, service-role-only registry. Do not seed private residences in source control.
create table if not exists public.gridly_verified_rural_addresses (
  id uuid primary key default gen_random_uuid(),
  lookup_hash text not null unique check (lookup_hash ~ '^[a-f0-9]{64}$'),
  normalized_address text not null,
  house_number text not null check (house_number ~ '^[0-9]{1,9}[A-Za-z]?$'),
  canonical_road_identity text not null,
  locality text not null,
  county_id text not null,
  state text not null check (upper(state) = 'TX'),
  postal_code text not null check (postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  latitude double precision not null check (latitude between 25.7 and 36.6),
  longitude double precision not null check (longitude between -106.7 and -93.5),
  coordinate_source text not null,
  verification_method text not null check (verification_method in (
    'county_911_address_record', 'county_appraisal_situs_record', 'owner_confirmed_gps',
    'field_verified_entrance', 'authoritative_address_point_dataset'
  )),
  verification_date date not null,
  verification_status text not null check (verification_status in ('pending', 'verified', 'revoked')),
  source_authority text not null,
  aliases jsonb not null default '[]'::jsonb check (jsonb_typeof(aliases) = 'array'),
  precision text not null check (precision in ('verified_address_point', 'verified_entrance')),
  consumer_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.gridly_verified_rural_addresses is
  'Private governed rural address records. Never expose through browser diagnostics or public fixtures.';
comment on column public.gridly_verified_rural_addresses.lookup_hash is
  'SHA-256 of normalized house|road|state|ZIP; keeps private address text out of cache and lookup predicates.';

alter table public.gridly_verified_rural_addresses enable row level security;
revoke all on public.gridly_verified_rural_addresses from public, anon, authenticated;
grant select, insert, update, delete on public.gridly_verified_rural_addresses to service_role;

create index if not exists gridly_verified_rural_addresses_eligible_idx
  on public.gridly_verified_rural_addresses(lookup_hash)
  where consumer_eligible and verification_status = 'verified';
