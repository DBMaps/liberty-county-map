import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=b=>createHash('sha256').update(b).digest('hex');
const evidence=JSON.parse(read('reports/responder/responder-phase14c-production-county-certification.json'));
const recovery=JSON.parse(read('reports/responder/responder-phase14b-recovery-checkpoint-evidence.json'));
const docPath='docs/RESPONDER/RESPONDER-PHASE14C-PRODUCTION-COUNTY-POPULATION.md';
const doc=read(docPath);

test('Phase 14C binds the approved branch and accepted-recovery baseline',()=>{
  assert.equal(evidence.branch,'RESPONDER-PHASE14C-production-county-population-retry');
  assert.equal(evidence.starting_head,'c01ecc98516448d0d7757a2a90e0a23d2860ad65');
  assert.equal(evidence.outcome,'PRODUCTION COUNTY POPULATION NOT ATTEMPTED — PREFLIGHT BLOCKED');
});

test('certified source and payload remain exact',()=>{
  const source=execFileSync('git',['cat-file','blob',`HEAD:${evidence.certified_input.source_path}`],
    {cwd:root,maxBuffer:20*1024*1024});
  const payload=fs.readFileSync(path.join(root,evidence.certified_input.payload_path));
  assert.equal(source.length,evidence.certified_input.source_canonical_bytes);
  assert.equal(sha(source),evidence.certified_input.source_sha256);
  assert.equal(payload.length,evidence.certified_input.payload_bytes);
  assert.equal(sha(payload),evidence.certified_input.payload_sha256);
  const sql=payload.toString('utf8');
  assert.equal(sql.match(/INSERT INTO public\.gridly_texas_county_boundaries/g)?.length,254);
  assert.doesNotMatch(sql,/^\s*(?:BEGIN|COMMIT|ROLLBACK|CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE|UPDATE|DELETE|MERGE)\b/im);
  assert.doesNotMatch(sql,/\bON\s+CONFLICT\b|\bUPSERT\b/i);
});

test('accepted recovery checkpoint remained available as local evidence',()=>{
  assert.equal(recovery.retry_gate,'PHASE 14 RETRY RECOVERY GATE SATISFIED');
  assert.equal(recovery.accepted_for_phase14_retry,true);
  assert.equal(evidence.recovery_gate.checkpoint_timestamp,'2026-09-14T04:46:09Z');
  assert.equal(evidence.recovery_gate.restore_performed,false);
});

test('fresh production preflight passed at the required zero-row state',()=>{
  const p=evidence.production_preflight;
  assert.equal(p.status,'PASS');
  assert.equal(p.transaction_read_only,'on');
  assert.equal(p.postgres_version,'17.6');
  assert.equal(p.postgis_version,'3.3.7');
  assert.equal(p.target.row_count,0);
  assert.equal(p.target.gist_index_valid,true);
  assert.equal(p.target.rls_enabled,true);
  assert.equal(p.target.policy_count,0);
  assert.equal(p.target.user_trigger_count,0);
  assert.equal(p.migrations.count,14);
  assert.equal(p.controls.reporting_enabled,false);
  assert.equal(p.responder_dependencies.target_dependency_detected,false);
});

test('oversize transport failed before any production write transaction',()=>{
  const x=evidence.execution_channel;
  assert.equal(x.transport_result,'REQUEST_ENTITY_TOO_LARGE');
  assert.equal(x.sql_received_by_postgres,false);
  assert.equal(x.production_write_transaction_opened,false);
  assert.equal(x.population_execution_attempted,false);
  assert.equal(x.payload_insert_statements_executed,0);
  assert.equal(x.commit_executed,false);
  assert.equal(x.second_write_attempted,false);
  assert.equal(x.retry_performed,false);
});

test('final read-only confirmation proves the production state stayed unchanged',()=>{
  const f=evidence.final_read_only_confirmation;
  assert.equal(f.status,'PASS_UNCHANGED_ZERO_ROW_STATE');
  assert.equal(f.transaction_read_only,'on');
  assert.equal(f.target_rows,0);
  assert.equal(f.unique_fips,0);
  assert.equal(f.migration_count,14);
  assert.equal(f.reporting_enabled,false);
  assert.equal(evidence.production_change_inventory.authorized_rows_inserted,0);
  assert.equal(evidence.production_change_inventory.unintended_writes,false);
});

test('unresolved production gates and responder inactivity are retained',()=>{
  assert.equal(evidence.p12_01,'OPEN');
  assert.equal(evidence.b03,'OPEN');
  assert.equal(evidence.responder_activation,'NONE');
  assert.equal(evidence.agency_publishing_enabled,false);
  assert.equal(evidence.in_transaction_certification.status,'NOT_RUN_NO_WRITE_TRANSACTION');
  assert.equal(evidence.postcommit_certification.status,'NOT_APPLICABLE_NO_COMMIT');
});

test('all local Markdown links resolve',()=>{
  const full=path.join(root,docPath);
  for(const match of doc.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)){
    if(/^https?:\/\//.test(match[1])) continue;
    assert.ok(fs.existsSync(path.resolve(path.dirname(full),match[1])),`broken local link ${match[1]}`);
  }
});

test('Phase 14C evidence contains no credential-bearing material',()=>{
  const combined=doc+'\n'+JSON.stringify(evidence);
  assert.doesNotMatch(combined,/postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(combined,/SUPABASE_(?:ACCESS_TOKEN|SERVICE_ROLE|DB_PASSWORD)/i);
  assert.doesNotMatch(combined,/BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY/i);
  assert.doesNotMatch(combined,/eyJ[A-Za-z0-9_-]{20,}/);
});
