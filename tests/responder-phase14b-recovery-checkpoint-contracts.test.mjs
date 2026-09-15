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

test('audit binds the required branch, baseline and read-only production identity',()=>{
  assert.equal(evidence.branch,'RESPONDER-PHASE14B-production-recovery-checkpoint');
  assert.equal(evidence.starting_head,'33eb5c1ea22613a8f0046f66f6e0b4aa12d8147a');
  assert.equal(evidence.production_database.project_label,'Gridly Platform');
  assert.equal(evidence.production_database.database_name,'postgres');
  assert.equal(evidence.production_database.postgres_version,'17.6');
  assert.equal(evidence.production_database.postgis_version,'3.3.7');
  assert.equal(evidence.production_database.transaction_read_only,'on');
  assert.equal(evidence.production_write_occurred,false);
  assert.equal(evidence.backup_or_restore_action_occurred,false);
  assert.equal(evidence.production_configuration_changed,false);
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

test('all ten acceptance criteria are explicit and fail closed',()=>{
  const checks=Object.values(evidence.acceptance_criteria);
  assert.equal(checks.length,10);
  assert.equal(checks.filter(x=>x.pass).length,1);
  assert.equal(evidence.checkpoint_timestamp,null);
  assert.equal(evidence.checkpoint_age,null);
  assert.equal(evidence.backup_pitr_capability,'UNKNOWN');
  assert.equal(evidence.recovery_health,'UNKNOWN');
  assert.equal(evidence.restore_test_status,'NO_PRODUCTION_RESTORE_EVIDENCE');
  assert.equal(evidence.county_write_recovery_sufficiency,'INSUFFICIENT');
  assert.equal(evidence.accepted_for_phase14_retry,false);
  assert.equal(evidence.retry_gate,'PHASE 14 RETRY RECOVERY GATE NOT SATISFIED');
});

test('B03 and P12-01 remain open and the document avoids false backup claims',()=>{
  assert.equal(evidence.b03,'OPEN');
  assert.equal(evidence.p12_01,'OPEN');
  assert.match(doc,/Backup\/recovery health is \*\*UNKNOWN\*\*/);
  assert.match(doc,/NO PRODUCTION RESTORE EVIDENCE/);
  assert.match(doc,/accepted_for_phase14_retry=false/);
  assert.doesNotMatch(doc,/checkpoint timestamp is `?20\d\d-/i);
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
