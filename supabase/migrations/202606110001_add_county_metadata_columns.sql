-- Adds optional county metadata for future Gridly multi-county filtering.
-- Existing Liberty County rows remain valid when county_id/state are null.

alter table if exists public.reports
  add column if not exists county_id text,
  add column if not exists state text;

alter table if exists public.gridly_feedback
  add column if not exists county_id text,
  add column if not exists state text;

do $$
begin
  if to_regclass('public.reports') is not null then
    comment on column public.reports.county_id is 'Optional Gridly county registry id. Missing values are treated by the client as liberty-tx for backward compatibility.';
    comment on column public.reports.state is 'Optional state abbreviation associated with county_id.';
  end if;

  if to_regclass('public.gridly_feedback') is not null then
    comment on column public.gridly_feedback.county_id is 'Optional Gridly county registry id captured with beta feedback.';
    comment on column public.gridly_feedback.state is 'Optional state abbreviation associated with feedback county_id.';
  end if;
end $$;
