import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const evidence=JSON.parse(read('reports/responder/responder-phase14b-recovery-checkpoint-evidence.json'));
const phase14a=JSON.parse(read('reports/responder/responder-phase14a-recovery-checkpoint-template.json'));
const docPath='docs/RESPONDER/RESPONDER-PHASE14B-PRODUCTION-RECOVERY-CHECKPOINT.md';
const doc=read(docPath);

test('update preserves the original audit and binds the approved baseline',()=>{
  assert.equal(evidence.branch,'RESPONDER-PHASE14B-production-recovery-checkpoint');
  assert.equal(evidence.starting_head,'33eb5c1ea22613a8f0046f66f6e0b4aa12d8147a');
  assert.equal(evidence.current_baseline_commit,'1f0985fc1b8bad4e20b8d7cba7275462428d0153');
  assert.equal(evidence.initial_audit_result.checkpoint_proven,false);
  assert.equal(evidence.initial_audit_result.accepted_for_phase14_retry,false);
  assert.equal(evidence.initial_audit_result.retry_gate,'PHASE 14 RETRY RECOVERY GATE NOT SATISFIED');
  assert.match(evidence.initial_audit_result.historical_finding,/correctly found/);
});

test('production identity remains historical read-only evidence',()=>{
  assert.equal(evidence.production_database.project_label,'Gridly Platform');
  assert.equal(evidence.production_database.database_name,'postgres');
  assert.equal(evidence.production_database.postgres_version,'17.6');
  assert.equal(evidence.production_database.postgis_version,'3.3.7');
  assert.equal(evidence.production_database.transaction_read_only,'on');
  assert.equal(evidence.production_write_occurred,false);
  assert.equal(evidence.backup_or_restore_action_occurred,false);
  assert.equal(evidence.production_configuration_changed,false);
  assert.equal(evidence.production_or_supabase_access_during_local_update,false);
  assert.equal(evidence.county_population_occurred,false);
});

test('county target remains empty without a responder dependency',()=>{
  assert.equal(evidence.target.exists,true);
  assert.equal(evidence.target.row_count,0);
  assert.equal(evidence.target.foreign_key_dependents,0);
  assert.equal(evidence.target.view_dependents,0);
  assert.equal(evidence.target.responder_schema_count,0);
});

test('blank Phase 14A template was not overwritten or promoted to evidence',()=>{
  assert.equal(phase14a.checkpoint.timestamp,null);
  assert.equal(phase14a.checkpoint.evidenceSource,null);
  assert.equal(phase14a.checkpoint.recoveryOwner,null);
  assert.equal(phase14a.ownerAcceptance.accepted,false);
  assert.equal(phase14a.containsLiveProductionEvidence,false);
});

test('owner evidence records the concrete checkpoint without claiming PITR or a restore test',()=>{
  assert.equal(evidence.owner_evidence_update.evidence_classification,'OWNER_REPORTED_SUPABASE_DASHBOARD_OBSERVATION');
  assert.equal(evidence.owner_evidence_update.restore_action_visible,true);
  assert.equal(evidence.owner_evidence_update.independent_dashboard_reinspection_performed_by_this_update,false);
  assert.equal(evidence.checkpoint_type,'SCHEDULED_PHYSICAL_DATABASE_BACKUP');
  assert.equal(evidence.checkpoint_timestamp,'2026-09-14T04:46:09Z');
  assert.deepEqual(evidence.visible_scheduled_physical_backups,[
    '2026-09-14T04:46:09Z',
    '2026-09-13T04:45:50Z',
    '2026-09-12T04:45:56Z',
    '2026-09-11T04:48:36Z',
    '2026-09-10T04:51:07Z'
  ]);
  assert.match(evidence.backup_pitr_capability,/PITR_NOT_CLAIMED/);
  assert.equal(evidence.restore_test_status,'NO_PRODUCTION_RESTORE_EVIDENCE');
});

test('all ten acceptance criteria are explicit with partial limitations retained',()=>{
  const checks=Object.values(evidence.acceptance_criteria);
  assert.equal(checks.length,10);
  assert.equal(checks.filter(x=>x.status==='PASS').length,8);
  assert.equal(checks.filter(x=>x.status==='PARTIAL').length,2);
  assert.equal(checks.filter(x=>x.status==='FAIL').length,0);
  assert.equal(checks.filter(x=>x.gate_blocking).length,0);
  assert.equal(evidence.acceptance_criteria.prepopulation_restore_path_proven.status,'PARTIAL');
  assert.equal(evidence.acceptance_criteria.no_degraded_recovery_state.status,'PARTIAL');
  assert.equal(evidence.acceptance_criteria.owner_acceptance_based_on_concrete_evidence.status,'PASS');
  assert.deepEqual(evidence.acceptance_criteria_summary,{pass:8,partial:2,fail:0,blocking:0});
  assert.match(evidence.recovery_health,/PARTIALLY_SUPPORTED/);
  assert.equal(evidence.county_write_recovery_sufficiency,'SUFFICIENT_FOR_BOUNDED_RETRY_WITH_ACKNOWLEDGED_NONBLOCKING_LIMITATIONS');
  assert.equal(evidence.accepted_for_phase14_retry,true);
  assert.equal(evidence.retry_gate,'PHASE 14 RETRY RECOVERY GATE SATISFIED');
});

test('recovery hierarchy remains transaction first and restore last',()=>{
  assert.match(evidence.primary_recovery_strategy[0],/transaction.*ROLLBACK/i);
  assert.match(evidence.primary_recovery_strategy[1],/postcommit read-only certification/i);
  assert.match(evidence.primary_recovery_strategy[2],/forward correction/i);
  assert.match(evidence.primary_recovery_strategy[3],/disaster-recovery fallback/i);
  assert.match(evidence.primary_recovery_strategy[3],/not as the first-line rollback mechanism/i);
});

test('B03 and P12-01 remain open while the owner evidence satisfies the recovery gate',()=>{
  assert.equal(evidence.b03,'OPEN');
  assert.equal(evidence.p12_01,'OPEN');
  assert.match(doc,/initial audit.*correctly found/is);
  assert.match(doc,/Recovery health is \*\*PARTIALLY SUPPORTED\*\*/);
  assert.match(doc,/NO PRODUCTION RESTORE EVIDENCE/);
  assert.match(doc,/accepted_for_phase14_retry=true/);
  assert.match(doc,/PHASE 14 RETRY RECOVERY GATE SATISFIED/);
  assert.match(doc,/Whole-database restore is not the first-line rollback mechanism/);
});

test('all local Markdown links resolve',()=>{
  const full=path.join(root,docPath);
  for(const match of doc.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)){
    if(/^https?:\/\//.test(match[1])) continue;
    assert.ok(fs.existsSync(path.resolve(path.dirname(full),match[1])),
      `broken local link ${match[1]}`);
  }
});

test('evidence artifacts contain no credential-bearing material',()=>{
  const combined=doc+'\n'+JSON.stringify(evidence);
  assert.doesNotMatch(combined,/postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(combined,/SUPABASE_(?:ACCESS_TOKEN|SERVICE_ROLE|DB_PASSWORD)/i);
  assert.doesNotMatch(combined,/BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY/i);
  assert.doesNotMatch(combined,/eyJ[A-Za-z0-9_-]{20,}/);
});
