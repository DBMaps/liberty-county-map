-- Read-only LP244.23A evaluator for the legacy writer authorization boundary.
-- Pre-transition both legacy anonymous writers are intentionally authorized.
-- Post-transition both direct writers must be unavailable; protocol-v2 RPCs own writes.
with
anon_role as (
  select roles.oid as anon_oid
  from pg_catalog.pg_roles as roles
  where roles.rolname = 'anon'
),
writer_authorization as (
  select
    (
      pg_catalog.has_schema_privilege('anon', 'public', 'usage')
      and (
        pg_catalog.has_table_privilege('anon', 'public.reports', 'insert')
        or exists (
          select 1
          from pg_catalog.pg_attribute as attributes
          where attributes.attrelid = 'public.reports'::regclass
            and attributes.attnum > 0
            and not attributes.attisdropped
            and pg_catalog.has_column_privilege(
              'anon', 'public.reports', attributes.attname, 'insert'
            )
        )
      )
      and (
        not (select classes.relrowsecurity from pg_catalog.pg_class as classes where classes.oid = 'public.reports'::regclass)
        or exists (
          select 1
          from pg_catalog.pg_policy as policies
          cross join anon_role as anon
          where policies.polrelid = 'public.reports'::regclass
            and policies.polcmd in ('a', '*')
            and (0::oid = any(policies.polroles) or anon.anon_oid = any(policies.polroles))
        )
      )
    ) as anon_report_insert_authorized,
    (
      pg_catalog.has_schema_privilege('anon', 'history_capture', 'usage')
      and (
        pg_catalog.has_table_privilege('anon', 'history_capture.historical_events', 'insert')
        or exists (
          select 1
          from pg_catalog.pg_attribute as attributes
          where attributes.attrelid = 'history_capture.historical_events'::regclass
            and attributes.attnum > 0
            and not attributes.attisdropped
            and pg_catalog.has_column_privilege(
              'anon', 'history_capture.historical_events', attributes.attname, 'insert'
            )
        )
      )
      and (
        not (select classes.relrowsecurity from pg_catalog.pg_class as classes where classes.oid = 'history_capture.historical_events'::regclass)
        or exists (
          select 1
          from pg_catalog.pg_policy as policies
          cross join anon_role as anon
          where policies.polrelid = 'history_capture.historical_events'::regclass
            and policies.polcmd in ('a', '*')
            and (0::oid = any(policies.polroles) or anon.anon_oid = any(policies.polroles))
        )
      )
    ) as anon_history_insert_authorized
)
select pg_catalog.jsonb_build_object(
  'anon_report_insert_authorized', writer_state.anon_report_insert_authorized,
  'anon_history_insert_authorized', writer_state.anon_history_insert_authorized,
  'pre_transition_match', (
    writer_state.anon_report_insert_authorized
    and writer_state.anon_history_insert_authorized
  ),
  'post_transition_match', (
    not writer_state.anon_report_insert_authorized
    and not writer_state.anon_history_insert_authorized
  )
) as community_writer_transition
from writer_authorization as writer_state
