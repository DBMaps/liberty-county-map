begin;

-- LP244.29A exposes only the bounded admission values needed for consumer UX.
-- The source table remains private and all writer admission checks remain
-- authoritative.  Safe removal, if this migration must be reverted, is:
--   revoke all on function public.get_community_reporting_status() from public, anon, authenticated, service_role;
--   drop function public.get_community_reporting_status();
create or replace function public.get_community_reporting_status()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select pg_catalog.jsonb_build_object(
    'protocol_version', 2,
    'reporting_enabled', admission.reporting_enabled,
    'changed_at', admission.changed_at
  )
  from report_retention.admission_state as admission
  where admission.singleton = true
  limit 1
$function$;

revoke all on function public.get_community_reporting_status() from public, anon, authenticated, service_role;
grant execute on function public.get_community_reporting_status() to anon, authenticated;

commit;
