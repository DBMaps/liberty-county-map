-- PSQL-ONLY LEGACY PROPOSAL. NOT compatible with Supabase execute_sql.
-- Raw connector proposal: diagnose-managed-role-raw.PROPOSAL.sql (separate approval).
-- PROPOSAL ONLY. Separate owner approval required. Never included in a batch.
-- Run ONLY in a dedicated psql -X -w -q -A -t -f process, never interactive \i.
-- Owner connection supplied privately through libpq. No data reads.
-- ON_ERROR_STOP ends that process on the first failure; disconnect rolls back
-- any open transaction. Do not retry. Only rollback_verified=true is success.
\set ON_ERROR_STOP on
select 'gridly_diag_'||replace(gen_random_uuid()::text,'-','') as diag_name \gset
begin;
set local statement_timeout='15s';
set local lock_timeout='5s';
set local search_path=pg_catalog;
select format('create role %I nologin', :'diag_name') \gexec
select json_build_object(
  'diagnostic_role',r.rolname,
  'attributes',json_build_object('rolcanlogin',r.rolcanlogin,'rolsuper',r.rolsuper,
    'rolcreatedb',r.rolcreatedb,'rolcreaterole',r.rolcreaterole,'rolinherit',r.rolinherit,
    'rolreplication',r.rolreplication,'rolbypassrls',r.rolbypassrls,'rolconnlimit',r.rolconnlimit,
    'config_present',r.rolconfig is not null),
  'memberships',(select coalesce(json_agg(json_build_object('role',p.rolname,'member',u.rolname,
    'grantor',g.rolname,'grantor_superuser',g.rolsuper,'admin',m.admin_option,
    'inherit',m.inherit_option,'set',m.set_option) order by p.rolname,u.rolname,g.rolname),'[]') from pg_auth_members m
    join pg_roles p on p.oid=m.roleid join pg_roles u on u.oid=m.member
    join pg_roles g on g.oid=m.grantor where m.roleid=r.oid or m.member=r.oid),
  'database',json_build_object('connect',has_database_privilege(r.oid,current_database(),'CONNECT'),
    'create',has_database_privilege(r.oid,current_database(),'CREATE'),
    'temporary',has_database_privilege(r.oid,current_database(),'TEMP')),
  'schemas',(select coalesce(json_agg(json_build_object('name',nspname,
    'usage',has_schema_privilege(r.oid,oid,'USAGE'),'create',has_schema_privilege(r.oid,oid,'CREATE'))),'[]')
    from pg_namespace where nspname not like 'pg_temp_%' and nspname not like 'pg_toast%'),
  'explicit_relation_grants',(select count(*) from pg_class c cross join lateral aclexplode(c.relacl) a where a.grantee=r.oid),
  'explicit_function_grants',(select count(*) from pg_proc p cross join lateral aclexplode(p.proacl) a where a.grantee=r.oid),
  'owned_objects',(select count(*) from pg_shdepend where refclassid='pg_authid'::regclass and refobjid=r.oid and deptype='o'),
  'authenticator_can_set',coalesce((select pg_has_role(a.oid,r.oid,'SET') from pg_roles a where rolname='authenticator'),false)
) as diagnostic from pg_roles r where r.rolname=:'diag_name' \gset
rollback;
select json_build_object('diagnostic',:'diagnostic'::json,
  'rollback_verified',not exists(select 1 from pg_roles where rolname=:'diag_name'));
