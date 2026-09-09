-- PROPOSAL ONLY: separate approval required; one raw execute_sql request; no retry.
-- Send this entire file unchanged. PostgreSQL's single-query implicit transaction
-- restores all SET LOCAL values on completion; no client variables are used.
-- A caught, deliberate exception rolls back role creation BEFORE the final row.
-- PL/pgSQL variables survive subtransaction rollback; catalog changes do not.
set local statement_timeout = '15s';
set local lock_timeout = '5s';
set local search_path = pg_catalog;
do $diagnostic$
declare
  diagnostic_name text := 'gridly_diag_' || replace(gen_random_uuid()::text, '-', '');
  r record;
  observed jsonb;
  edges jsonb;
  databases jsonb;
  schemas jsonb;
  grants jsonb;
  ownership jsonb;
  predicates jsonb;
  attributes_ok boolean;
  memberships_ok boolean;
  creator_membership_ok boolean;
  privileges_ok boolean;
  effective_privileges_ok boolean;
  authenticator_present boolean;
  authenticator_can_set boolean;
  complete boolean := false;
  rolled_back boolean := false;
begin
  if not exists (
    select 1 from pg_roles where rolname = current_user and rolcreaterole and not rolsuper
  ) then
    raise exception 'diagnostic requires a non-superuser CREATEROLE owner';
  end if;
  if exists (select 1 from pg_roles where rolname = diagnostic_name) then
    raise exception 'diagnostic identity collision';
  end if;
  begin
    execute format('create role %I nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls connection limit 0', diagnostic_name);
    select * into strict r from pg_roles where rolname = diagnostic_name;
    select coalesce(jsonb_agg(jsonb_build_object(
      'role', p.rolname, 'member', u.rolname,
      'direction', case when m.roleid = r.oid then 'diagnostic_granted_to_member' else 'role_granted_to_diagnostic' end,
      'admin', m.admin_option, 'inherit', m.inherit_option, 'set', m.set_option,
      'grantor', g.rolname, 'grantor_superuser', g.rolsuper
    ) order by m.roleid, m.member, m.grantor), '[]'::jsonb) into edges
    from pg_auth_members m
    left join pg_roles p on p.oid = m.roleid
    left join pg_roles u on u.oid = m.member
    left join pg_roles g on g.oid = m.grantor
    where m.roleid = r.oid or m.member = r.oid;

    select coalesce(jsonb_agg(jsonb_build_object('database', d.datname,
      'connect', has_database_privilege(r.oid, d.oid, 'CONNECT'),
      'create', has_database_privilege(r.oid, d.oid, 'CREATE'),
      'temporary', has_database_privilege(r.oid, d.oid, 'TEMP')) order by d.datname), '[]'::jsonb)
    into databases from pg_database d;
    select coalesce(jsonb_agg(jsonb_build_object('schema', n.nspname,
      'usage', has_schema_privilege(r.oid, n.oid, 'USAGE'),
      'create', has_schema_privilege(r.oid, n.oid, 'CREATE')) order by n.nspname), '[]'::jsonb)
    into schemas from pg_namespace n;
    select jsonb_build_object(
      'schema', (select count(*) from pg_namespace n cross join lateral aclexplode(n.nspacl) a where a.grantee = r.oid),
      'relation', (select count(*) from pg_class c cross join lateral aclexplode(c.relacl) a where a.grantee = r.oid),
      'column', (select count(*) from pg_attribute c cross join lateral aclexplode(c.attacl) a where a.grantee = r.oid),
      'function', (select count(*) from pg_proc p cross join lateral aclexplode(p.proacl) a where a.grantee = r.oid),
      'database', (select count(*) from pg_database d cross join lateral aclexplode(d.datacl) a where a.grantee = r.oid),
      'all_acl_dependencies', (select count(*) from pg_shdepend where refclassid = 'pg_authid'::regclass and refobjid = r.oid and deptype = 'a')
    ) into grants;
    select jsonb_build_object('total', count(*),
      'by_catalog', coalesce((select jsonb_object_agg(catalog, n) from (
        select classid::regclass::text as catalog, count(*) as n from pg_shdepend
        where refclassid = 'pg_authid'::regclass and refobjid = r.oid and deptype = 'o' group by classid
      ) counts), '{}'::jsonb)) into ownership from pg_shdepend
    where refclassid = 'pg_authid'::regclass and refobjid = r.oid and deptype = 'o';
    select exists(select 1 from pg_roles where rolname = 'authenticator'),
      coalesce((select pg_has_role(a.oid, r.oid, 'SET') from pg_roles a where rolname = 'authenticator'), false)
    into authenticator_present, authenticator_can_set;

    attributes_ok := not (r.rolcanlogin or r.rolsuper or r.rolcreatedb or r.rolcreaterole
      or r.rolinherit or r.rolreplication or r.rolbypassrls)
      and r.rolconnlimit = 0 and r.rolconfig is null
      and not exists (select 1 from pg_db_role_setting where setrole = r.oid);
    memberships_ok := not exists (
      select 1 from pg_auth_members m where (m.roleid = r.oid or m.member = r.oid)
      and not coalesce((m.roleid = r.oid
        and m.member = (select oid from pg_roles where rolname = 'postgres')
        and m.admin_option and not m.inherit_option and not m.set_option
        and exists(select 1 from pg_roles g where g.oid = m.grantor and g.rolsuper)), false)
    );
    creator_membership_ok := not exists (
      select 1 from pg_auth_members m where (m.roleid = r.oid or m.member = r.oid)
      and not coalesce((m.roleid = r.oid
        and m.member = (select oid from pg_roles where rolname = current_user)
        and m.admin_option and not m.inherit_option and not m.set_option
        and exists(select 1 from pg_roles g where g.oid = m.grantor and g.rolsuper)), false)
    );
    privileges_ok := not exists (select 1 from jsonb_each_text(grants) where value::bigint <> 0)
      and (ownership->>'total')::bigint = 0 and not authenticator_can_set;
    effective_privileges_ok := not exists (select 1 from jsonb_array_elements(databases) d where (d->>'create')::boolean)
      and not exists (select 1 from jsonb_array_elements(schemas) s where (s->>'create')::boolean
        or ((s->>'usage')::boolean and s->>'schema' not in ('pg_catalog', 'information_schema', 'public')));
    complete := authenticator_present and jsonb_array_length(databases) > 0
      and jsonb_array_length(schemas) > 0 and jsonb_array_length(edges) = 1
      and not exists (select 1 from jsonb_array_elements(edges || databases || schemas) e,
        jsonb_each(e) v where v.value = 'null'::jsonb);
    predicates := jsonb_build_object('attributes_match', attributes_ok,
      'creator_membership_shape_match', creator_membership_ok,
      'production_owner_identity_match', current_user = 'postgres',
      'memberships_match', memberships_ok, 'pregrant_privileges_match', privileges_ok,
      'effective_privileges_expected', effective_privileges_ok,
      'complete_observation', complete,
      'matches_repaired_production_predicate', attributes_ok and memberships_ok and privileges_ok);
    observed := jsonb_build_object('diagnostic_role', diagnostic_name,
      'attributes', jsonb_build_object('rolcanlogin', r.rolcanlogin, 'rolsuper', r.rolsuper,
        'rolcreatedb', r.rolcreatedb, 'rolcreaterole', r.rolcreaterole, 'rolinherit', r.rolinherit,
        'rolreplication', r.rolreplication, 'rolbypassrls', r.rolbypassrls, 'rolconnlimit', r.rolconnlimit,
        'config_present', r.rolconfig is not null,
        'database_config_present', exists(select 1 from pg_db_role_setting where setrole = r.oid)),
      'memberships', edges, 'databases', databases, 'schemas', schemas,
      'explicit_grants', grants, 'owned_objects', ownership,
      'authenticator_present', authenticator_present, 'authenticator_can_set', authenticator_can_set,
      'predicates', predicates);
    -- Only this private sentinel is caught. Any other failure aborts the query.
    raise exception using errcode = 'G2301', message = 'rollback diagnostic observation';
  exception when sqlstate 'G2301' then
    rolled_back := true;
  end;
  if not rolled_back or observed is null or exists (select 1 from pg_roles where rolname = diagnostic_name) then
    raise exception 'diagnostic cleanup or observation failed';
  end if;
  if not coalesce(attributes_ok and creator_membership_ok and privileges_ok and effective_privileges_ok and complete, false) then
    raise exception using message = 'diagnostic predicate mismatch or incomplete observation', detail = observed::text;
  end if;
  observed := observed || jsonb_build_object(
    'status', case when (predicates->>'matches_repaired_production_predicate')::boolean then 'PASS' else 'NO-GO' end,
    'cleanup_success', rolled_back,
    'diagnostic_role_absent', not exists(select 1 from pg_roles where rolname = diagnostic_name));
  -- Transport ONLY: one quoted identifier holds the complete JSON text. No schema
  -- is created or resolved. All remaining calls are explicitly pg_catalog-qualified.
  -- This existing built-in setting is transaction-local, avoiding a persistent
  -- custom GUC placeholder, temporary namespace, helper function or table.
  perform pg_catalog.set_config('search_path', pg_catalog.quote_ident(observed::text), true);
end
$diagnostic$;
select (pg_catalog.parse_ident(pg_catalog.current_setting('search_path'), true))[1]::pg_catalog.jsonb as diagnostic;
