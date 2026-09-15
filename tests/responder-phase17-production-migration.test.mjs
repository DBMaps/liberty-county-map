// Phase 17 guarded-package validation in an explicit disposable localhost cluster.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {RESPONDER_PHASE17_PGBIN:bin,RESPONDER_PHASE17_PGPORT:port,
  RESPONDER_PHASE17_PGUSER:owner,RESPONDER_PHASE17_PGDATA:data,
  RESPONDER_PHASE17_PGPASSWORD:password}=process.env;
if(!bin||!/^[0-9]{4,5}$/.test(port||'')||owner!=='postgres'||!data||!fs.existsSync(data)
  ||!path.basename(data).startsWith('gridly-responder-phase17-')
  ||path.relative(os.tmpdir(),path.resolve(data)).startsWith('..'))
  throw new Error('Explicit disposable Phase 17 localhost PostgreSQL configuration required');
const env={...process.env};
for(const k of Object.keys(env)) if(/^PG/i.test(k)||/SUPABASE|DATABASE_URL/i.test(k)) delete env[k];
Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:port,PGUSER:owner,PGCONNECT_TIMEOUT:'3'});
if(password) env.PGPASSWORD=password;
let dbChecks=0,dirtyPassed=0,dirtyFailed=0;
function psql(db,args,allowFailure=false){
  const r=spawnSync(path.join(bin,'psql.exe'),['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,...args],
    {cwd:root,env,encoding:'utf8',timeout:240000,windowsHide:true});
  if(r.error) throw r.error;
  if(!allowFailure&&r.status!==0) throw new Error(r.stderr||r.stdout);
  return r;
}
const file=name=>path.join(root,'db','responder-local',name);
const apply=(db,name,args=[],allowFailure=false)=>psql(db,[...args,'-f',file(name)],allowFailure);
const q=(db,sql)=>psql(db,['-c',sql]).stdout.trim();
function check(label,actual,expected){
  assert.equal(String(actual),String(expected),label); dbChecks++;
  console.log(`PASS DB ${label}`);
}
function createDb(tag){
  const name=`gridly_p17_${tag}_${randomUUID().replaceAll('-','').slice(0,12)}`;
  psql('postgres',['-c',`CREATE DATABASE ${name}`]);
  apply(name,'phase17_test_bootstrap.sql');
  return name;
}
function dropDb(name){psql('postgres',['-c',`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`],true);}
function assertDirtyFailure(label,mutate){
  const db=createDb('dirty');
  try{
    psql(db,['-c',mutate]);
    const preflight=apply(db,'phase17_production_preflight.sql',[],true);
    const migration=apply(db,'phase17_production_migration.sql',[],true);
    assert.notEqual(preflight.status,0,`${label}: read-only preflight must fail`);
    assert.notEqual(migration.status,0,`${label}: migration must fail`);
    assert.equal(q(db,"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='responder_public' AND c.relname='agency_updates'"),'0');
    dirtyPassed++; console.log(`PASS DIRTY ${label}`);
  }catch(error){dirtyFailed++; throw error;}finally{dropDb(db);}
}

const clean=createDb('clean');
try{
  const pre=apply(clean,'phase17_production_preflight.sql');
  assert.match(pre.stdout,/PHASE17_PRODUCTION_PREFLIGHT_PASS/); dbChecks++;
  apply(clean,'phase17_production_migration.sql');
  const post=apply(clean,'phase17_production_postflight.sql',[
    '-v','phase17_expected_reports=0','-v','phase17_expected_feedback=7',
    '-v','phase17_expected_geocode_cache=489','-v','phase17_expected_geocode_provider_state=2',
    '-v','phase17_expected_historical_events=0','-v','phase17_expected_retention_runs=1']);
  assert.match(post.stdout,/PHASE17_PRODUCTION_POSTFLIGHT_PASS/); dbChecks++;
  check('13 private tables',q(clean,"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='agency_private' AND c.relkind='r'"),13);
  check('14 RLS FORCE tables',q(clean,"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('agency_private','responder_public') AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity"),14);
  check('14 exact policies',q(clean,"SELECT count(*) FROM pg_policies WHERE schemaname IN ('agency_private','responder_public')"),14);
  check('11 private functions',q(clean,"SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='agency_private'"),11);
  check('3 public wrappers',q(clean,"SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='responder_public'"),3);
  check('zero responder data',q(clean,"SELECT (NOT EXISTS(SELECT 1 FROM agency_private.organizations) AND NOT EXISTS(SELECT 1 FROM agency_private.principals) AND NOT EXISTS(SELECT 1 FROM agency_private.organization_memberships) AND NOT EXISTS(SELECT 1 FROM agency_private.agency_updates) AND NOT EXISTS(SELECT 1 FROM responder_public.agency_updates))::text"),'true');
  check('community baseline unchanged',q(clean,"SELECT ((SELECT count(*) FROM public.reports)=0 AND (SELECT count(*) FROM public.gridly_feedback)=7 AND (SELECT count(*) FROM public.gridly_geocode_cache)=489 AND (SELECT count(*) FROM public.gridly_geocode_provider_state)=2 AND (SELECT count(*) FROM history_capture.historical_events)=0 AND (SELECT count(*) FROM report_retention.runs)=1 AND NOT (SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton))::text"),'true');
  check('county authority unchanged',q(clean,"SELECT (count(*)=254 AND count(DISTINCT county_fips)=254)::text FROM public.gridly_texas_county_boundaries"),'true');
  check('private schema hidden from anon',q(clean,"SELECT has_schema_privilege('anon','agency_private','USAGE')::text"),'false');
  check('private definer hidden from PUBLIC',q(clean,"SELECT bool_and(NOT has_function_privilege('public',p.oid,'EXECUTE'))::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='agency_private' AND p.prosecdef"),'true');
  const membershipPlan=q(clean,"SET enable_seqscan=off; EXPLAIN SELECT * FROM agency_private.organization_memberships WHERE organization_id='00000000-0000-0000-0000-000000000001' AND status='active' AND role='SUPERVISOR'");
  assert.match(membershipPlan,/organization_memberships_org_status_role_idx/); dbChecks++;
  const ratePlan=q(clean,"SET enable_seqscan=off; EXPLAIN SELECT * FROM agency_private.activation_rate_events WHERE organization_id='00000000-0000-0000-0000-000000000001' AND activated_at>now()-interval '60 minutes'");
  assert.match(ratePlan,/activation_rate_events_rolling_idx/); dbChecks++;
  apply(clean,'phase17_production_rollback.sql');
  check('empty rollback removes responder schemas',q(clean,"SELECT (to_regnamespace('agency_private') IS NULL AND to_regnamespace('responder_public') IS NULL)::text"),'true');
  check('rollback preserves protected baselines',q(clean,"SELECT ((SELECT count(*) FROM public.gridly_texas_county_boundaries)=254 AND (SELECT count(*) FROM public.gridly_feedback)=7 AND (SELECT count(*) FROM public.gridly_geocode_cache)=489 AND (SELECT count(*) FROM public.gridly_geocode_provider_state)=2 AND NOT (SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton) AND to_regclass('auth.sessions') IS NOT NULL)::text"),'true');
}finally{dropDb(clean);}

const evidence=createDb('evidence');
try{
  apply(evidence,'phase17_production_migration.sql');
  q(evidence,"CREATE VIEW public.phase17_external_dependency_test AS SELECT update_id FROM responder_public.agency_updates");
  const dependencyRollback=apply(evidence,'phase17_production_rollback.sql',[],true);
  assert.notEqual(dependencyRollback.status,0); dbChecks++;
  check('rollback refusal preserves external dependency',q(evidence,"SELECT (to_regclass('public.phase17_external_dependency_test') IS NOT NULL AND to_regnamespace('responder_public') IS NOT NULL)::text"),'true');
  q(evidence,"DROP VIEW public.phase17_external_dependency_test");
  q(evidence,"INSERT INTO agency_private.organizations(canonical_name,legal_name,public_name) VALUES ('rollback-blocked','Rollback Blocked','Rollback Blocked')");
  const rollback=apply(evidence,'phase17_production_rollback.sql',[],true);
  assert.notEqual(rollback.status,0); dbChecks++;
  check('rollback refusal preserves responder evidence',q(evidence,"SELECT (to_regnamespace('agency_private') IS NOT NULL AND (SELECT count(*) FROM agency_private.organizations)=1)::text"),'true');
}finally{dropDb(evidence);}

const dirtyCases=[
  ['preexisting agency_private',"CREATE SCHEMA agency_private"],
  ['preexisting responder_public',"CREATE SCHEMA responder_public"],
  ['partial candidate table',"CREATE SCHEMA agency_private; CREATE TABLE agency_private.organizations(id uuid)"],
  ['partial candidate function',"CREATE SCHEMA agency_private; CREATE FUNCTION agency_private.agency_update_command(jsonb) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb'"],
  ['missing Auth table',"DROP TABLE auth.mfa_amr_claims"],
  ['missing Auth column',"ALTER TABLE auth.sessions DROP COLUMN factor_id"],
  ['wrong Auth column type',"ALTER TABLE auth.sessions ALTER COLUMN aal TYPE text USING aal::text"],
  ['county count mismatch',"DELETE FROM public.gridly_texas_county_boundaries WHERE county_fips='48001'"],
  ['county geometry invalid',"UPDATE public.gridly_texas_county_boundaries SET geom=extensions.ST_GeomFromText('MULTIPOLYGON EMPTY',4326) WHERE county_fips='48001'"],
  ['required role missing',"DROP ROLE anon"],
  ['PostGIS unavailable',"DROP EXTENSION postgis CASCADE"],
  ['reporting unexpectedly enabled',"UPDATE report_retention.admission_state SET reporting_enabled=true"],
  ['stale migration marker',"INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('20260915000100','prepare_responder_production_schema')"]
];
for(const [label,mutation] of dirtyCases) assertDirtyFailure(label,mutation);
console.log(`PHASE17_DIRTY_CASES passed=${dirtyPassed} failed=${dirtyFailed} total=${dirtyPassed+dirtyFailed}`);
console.log(`PHASE17_DATABASE_CHECKS passed=${dbChecks} failed=0 total=${dbChecks}`);
