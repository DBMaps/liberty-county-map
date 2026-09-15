import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const migration=read('db/responder-local/phase17_production_migration.sql');
const preflight=read('db/responder-local/phase17_production_preflight.sql');
const postflight=read('db/responder-local/phase17_production_postflight.sql');
const rollback=read('db/responder-local/phase17_production_rollback.sql');
const readiness=read('docs/RESPONDER/RESPONDER-PHASE17-PRODUCTION-MIGRATION-READINESS.md');
const runbook=read('docs/RESPONDER/RESPONDER-PHASE17-PRODUCTION-MIGRATION-RUNBOOK.md');
const manifest=JSON.parse(read('reports/responder/responder-phase17-production-migration-manifest.json'));
const sha=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');

test('manifest freezes source, verdict, and non-authorization',()=>{
  assert.equal(manifest.sourcePhase16Commit,'df98157a9e5e77065077ae657fa3062017c88ea0');
  assert.equal(manifest.readinessVerdict,'CONDITIONAL GO');
  assert.equal(manifest.deploymentAuthorizationStatus,'NOT AUTHORIZED');
  assert.equal(manifest.productionMutations,'NONE');
});

test('package hashes match byte-for-byte artifacts',()=>{
  for(const item of Object.values(manifest.package)) assert.equal(sha(item.path),item.sha256,item.path);
});

test('candidate remains outside migration history until owner gate',()=>{
  assert.doesNotMatch(import.meta.url,/supabase[\\/]migrations/i);
  assert.match(migration,/NOT DEPLOYED/);
  assert.match(runbook,/supabase migration new prepare_responder_production_schema/);
  assert.match(runbook,/supabase db push --dry-run/);
});

test('migration owns one explicit transaction and no nontransactional DDL',()=>{
  assert.equal((migration.match(/^BEGIN;$/gm)||[]).length,1);
  assert.equal((migration.match(/^COMMIT;$/gm)||[]).length,1);
  assert.doesNotMatch(migration,/CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY|CREATE\s+EXTENSION|VACUUM|REINDEX\s+CONCURRENTLY/i);
});

test('migration preconditions precede every responder CREATE',()=>{
  assert.ok(migration.indexOf('$phase17_embedded_preflight$;')<migration.indexOf('CREATE SCHEMA agency_private;'));
  for(const token of ['nhwhkbkludzkuyxmkkcj','server_version_num','rolbypassrls',
    'supabase_migrations.schema_migrations','auth.sessions','auth.mfa_factors','auth.mfa_amr_claims',
    'gridly_texas_county_boundaries','reporting_enabled=false']) assert.match(migration,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
  assert.doesNotMatch(migration,/CREATE\s+(?:SCHEMA|TABLE|TYPE|FUNCTION)\s+IF\s+NOT\s+EXISTS/i);
});

test('standalone preflight is read-only, repeatable, bounded, and fail-closed',()=>{
  assert.match(preflight,/BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(preflight,/SET LOCAL statement_timeout = '30s'/);
  assert.match(preflight,/PHASE17_PRODUCTION_PREFLIGHT_PASS/);
  assert.match(preflight,/ROLLBACK;/);
  const executable=preflight.replace(/--.*$/gm,'').replace(/'(?:''|[^'])*'/g,"''");
  assert.doesNotMatch(executable,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE)\b/i);
});

test('managed Auth contract is exact and read-only',()=>{
  for(const token of ["'sessions','aal','auth.aal_level','YES'","'sessions','factor_id','uuid','YES'",
    "'mfa_factors','factor_type','auth.factor_type','NO'","'mfa_factors','status','auth.factor_status','NO'",
    "'mfa_amr_claims','authentication_method','text','NO'",'FOREIGN KEY (session_id)']) assert.match(migration,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
  assert.doesNotMatch(migration,/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?auth\./i);
});

test('zero activation is asserted before commit',()=>{
  const gate=migration.indexOf('$phase17_post_ddl_assertions$;');
  assert.ok(gate>migration.indexOf('CREATE FUNCTION responder_public.agency_update_command'));
  assert.ok(gate<migration.lastIndexOf('COMMIT;'));
  for(const table of manifest.expectedInventory.privateTables) assert.match(migration,new RegExp(`agency_private\\.${table}`));
  assert.match(migration,/reporting_enabled=false/);
});

test('RLS, FORCE RLS, grants, and function security are explicit',()=>{
  assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
  assert.match(migration,/FORCE ROW LEVEL SECURITY/);
  assert.equal((migration.match(/SECURITY INVOKER SET search_path = ''/g)||[]).length,3);
  assert.doesNotMatch(migration,/GRANT (?:INSERT|UPDATE|DELETE|ALL).*agency_private/i);
  assert.match(postflight,/private SECURITY DEFINER grants\/search_path differ/);
});

test('postflight is independent read-only certification with baseline handoff',()=>{
  assert.match(postflight,/BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(postflight,/phase17_expected_reports/);
  assert.match(postflight,/PHASE17_PRODUCTION_POSTFLIGHT_PASS/);
  assert.match(postflight,/exact 18-column projection differs/);
  assert.match(postflight,/ROLLBACK;/);
});

test('rollback is empty-data-only and touches only responder schemas',()=>{
  for(const table of manifest.expectedInventory.privateTables) assert.match(rollback,new RegExp(`'${table}'`));
  assert.match(rollback,/Responder evidence exists|responder evidence exists/i);
  assert.match(rollback,/DROP SCHEMA responder_public CASCADE;[\s\S]*DROP SCHEMA agency_private CASCADE;/);
  assert.doesNotMatch(rollback,/\b(?:DROP|ALTER|UPDATE|DELETE|TRUNCATE)\s+(?:SCHEMA\s+|TABLE\s+)?(?:auth|public|history_capture|report_retention|gridly_control)\b/i);
});

test('Data API exposure is a separate gated configuration change',()=>{
  const config=read('supabase/config.toml');
  assert.match(config,/schemas = \["public", "graphql_public"\]/);
  assert.doesNotMatch(config,/responder_public|agency_private/);
  assert.equal(manifest.dataApi.configurationPerformed,false);
  assert.match(readiness,/responder_public.*must be separately added/i);
});

test('runbook contains owner, recovery, history, postflight and stop gates',()=>{
  for(const token of ['fresh recovery checkpoint','Explicit owner approval','supabase migration list',
    'supabase db push','phase17_production_postflight.sql','Rollback decision tree','STOP conditions']) assert.match(runbook,new RegExp(token,'i'));
  assert.doesNotMatch(runbook,/db reset --linked`?\s*(?:\r?\n)?\s*$/m);
});

test('advisors and exact-version clone are not falsely claimed',()=>{
  assert.equal(manifest.verification.productionVersionClone,'REQUIRED_NOT_RUN');
  assert.equal(manifest.verification.securityAdvisor,'REQUIRED_NOT_RUN');
  assert.equal(manifest.verification.performanceAdvisor,'REQUIRED_NOT_RUN');
  assert.match(readiness,/CONDITIONAL GO/);
});

test('expected inventory is fully machine-readable',()=>{
  assert.equal(manifest.expectedInventory.privateEnums.length,10);
  assert.equal(manifest.expectedInventory.privateTables.length,13);
  assert.equal(manifest.expectedInventory.privateFunctions.length,11);
  assert.equal(manifest.expectedInventory.publicSecurityInvokerFunctions.length,3);
  assert.equal(manifest.expectedInventory.explicitIndexes.length,17);
  assert.equal(manifest.expectedInventory.policyCount,14);
});

test('package and evidence contain no credential material',()=>{
  const corpus=[migration,preflight,postflight,rollback,readiness,runbook,JSON.stringify(manifest)].join('\n');
  assert.doesNotMatch(corpus,/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(corpus,/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{10,}/i);
  assert.doesNotMatch(corpus,/postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@/i);
  assert.doesNotMatch(corpus,/(?:SUPABASE_SERVICE_ROLE_KEY|PGPASSWORD)\s*=\s*['"][^'"]+['"]/i);
});
