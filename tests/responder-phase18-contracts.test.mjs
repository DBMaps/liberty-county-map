import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const report=JSON.parse(read('reports/responder/responder-phase18-production-shaped-clone-rehearsal.json'));
const migration='supabase/migrations/20260915190450_prepare_responder_production_schema.sql';

test('Phase 18 freezes a passing non-production rehearsal',()=>{
  assert.equal(report.startingCommit,'546590737be954684ef6826448596aba78fe595f');
  assert.equal(report.rehearsalVerdict,'PASS');
  assert.equal(report.productionAccessPerformed,'NONE');
  assert.equal(report.productionMutations,'NONE');
  assert.equal(report.productionDeployment,'NONE');
  assert.equal(report.pushed,false);
  assert.equal(report.merged,false);
});

test('CLI-generated migration is byte-identical to the Phase 17 source',()=>{
  assert.equal(report.supabaseCli.version,'2.117.0');
  assert.equal(report.migration.filename,path.basename(migration));
  assert.equal(sha(migration),report.migration.sha256);
  assert.equal(sha('db/responder-local/phase17_production_migration.sql'),report.migration.sourcePhase17Sha256);
  assert.equal(report.migration.sha256,report.migration.sourcePhase17Sha256);
  assert.equal(report.migration.relationship,'BYTE_IDENTICAL');
});

test('clone bootstrap has two independent non-production markers and complete baseline history',()=>{
  const bootstrap=read('db/responder-local/phase18_production_shaped_clone_bootstrap.sql');
  assert.match(bootstrap,/GRIDLY_PHASE18_NON_PRODUCTION/);
  assert.match(bootstrap,/production_access_authorized=false/);
  assert.match(bootstrap,/synthetic-production-shaped-bootstrap/);
  assert.equal((bootstrap.match(/\('2026\d+'/g)||[]).length,13);
  assert.equal(report.clone.preResponderMigrationHistoryRows,14);
  assert.equal(report.environment.containerMarker,'com.gridly.phase18.nonproduction=true');
});

test('exact fidelity, preflight, postflight, rollback, determinism, and history passed',()=>{
  assert.equal(report.clone.fidelityStatus,'PASS_FOR_PHASE18_SQL_REHEARSAL');
  assert.equal(report.environment.postgresVersionNum,170006);
  assert.equal(report.environment.postgis,'3.3.7');
  assert.equal(report.preflight.status,'PHASE17_PRODUCTION_PREFLIGHT_PASS');
  assert.equal(report.postflight.status,'PHASE17_PRODUCTION_POSTFLIGHT_PASS');
  assert.equal(report.rollback.emptyRollback,'PASS');
  assert.equal(report.rollback.evidenceBearingRollbackRefusal,'PASS');
  assert.equal(report.determinism.firstCatalogFingerprintSha256,report.determinism.secondCatalogFingerprintSha256);
  assert.equal(report.migrationHistory.generatedVersionCount,1);
  assert.equal(report.migrationHistory.localAndCloneHistoriesMatch,true);
});

test('security vector counts and definer allowlist are exact',()=>{
  assert.deepEqual(report.security.behavioralVectors,{passed:38,failed:0,total:38});
  assert.deepEqual(report.security.databaseChecks,{passed:22,failed:0,total:22});
  assert.deepEqual(report.security.dirtyFailureCases,{passed:13,failed:0,total:13});
  assert.deepEqual(report.security.migrationDatabaseChecks,{passed:20,failed:0,total:20});
  assert.equal(report.security.securityDefinerAudit.privateDefiners,10);
  assert.equal(report.security.securityDefinerAudit.publicOrServiceRoleExecutable,0);
  assert.equal(report.security.securityDefinerAudit.publicDefinerWrappers,0);
  assert.equal(report.security.securityDefinerAudit.publicInvokerWrappers,3);
});

test('Data API and advisor classifications remain honest',()=>{
  assert.equal(report.dataApi.status,'PASS');
  assert.equal(report.dataApi.httpPostgrestRehearsed,true);
  assert.equal(report.dataApi.postgrestVersion,'14.17');
  assert.equal(report.dataApi.anonymousProjection.httpStatus,200);
  assert.equal(report.dataApi.anonymousCommandWrapper.httpStatus,401);
  assert.equal(report.dataApi.authenticatedInvalidCommandWrapper.result,'invalid_request');
  assert.equal(report.dataApi.responderPublicExposureConfigured,false);
  assert.equal(report.dataApi.agencyPrivateExposureConfigured,false);
  assert.equal(report.advisors.security.errors,0);
  assert.equal(report.advisors.security.warnings,0);
  assert.equal(report.advisors.performance.errors,0);
  assert.equal(report.advisors.performance.warnings,0);
  assert.equal(report.recoveryCheckpointRequiredBeforeProduction,true);
});

test('Phase 18 SQL verifiers are bounded and marker-gated',()=>{
  for(const file of ['phase18_clone_fidelity.sql','phase18_security_definer_audit.sql',
    'phase18_data_api_sql_rehearsal.sql','phase18_schema_fingerprint.sql']){
    const sql=read(`db/responder-local/${file}`);
    assert.match(sql,/statement_timeout='30s'/);
    assert.match(sql,/GRIDLY_PHASE18_NON_PRODUCTION/);
  }
  assert.match(read('db/responder-local/phase18_clone_fidelity.sql'),/server_version_num'\)::integer<>170006/);
});

test('Phase 18 committed artifacts contain no credential material',()=>{
  const corpus=[
    read('docs/RESPONDER/RESPONDER-PHASE18-PRODUCTION-SHAPED-CLONE-REHEARSAL.md'),
    read('reports/responder/responder-phase18-production-shaped-clone-rehearsal.json'),
    read('tools/responder-local/run-phase18-exact-regressions.ps1'),
    ...['phase18_clone_fidelity.sql','phase18_security_definer_audit.sql',
      'phase18_data_api_sql_rehearsal.sql','phase18_schema_fingerprint.sql',
      'phase18_production_shaped_clone_bootstrap.sql'].map(f=>read(`db/responder-local/${f}`))
  ].join('\n');
  assert.doesNotMatch(corpus,/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(corpus,/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{10,}/i);
  assert.doesNotMatch(corpus,/postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@/i);
  assert.doesNotMatch(corpus,/(?:SUPABASE_SERVICE_ROLE_KEY|PGPASSWORD)\s*=\s*['"][^'"]+['"]/i);
  assert.doesNotMatch(corpus,/gridly-phase18[-]local-only/i);
});
