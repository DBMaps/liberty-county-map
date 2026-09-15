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
const evidence=JSON.parse(read('reports/responder/responder-phase14e-production-county-certification.json'));
const recovery=JSON.parse(read('reports/responder/responder-phase14b-recovery-checkpoint-evidence.json'));
const readiness=JSON.parse(read('reports/responder/responder-phase14d-psql-readiness-certification.json'));
const docPath='docs/RESPONDER/RESPONDER-PHASE14E-PRODUCTION-COUNTY-POPULATION.md';
const doc=read(docPath);

test('Phase 14E binds the certified Phase 14D baseline and blocked outcome',()=>{
  assert.equal(evidence.branch,'RESPONDER-PHASE14E-production-county-population-final');
  assert.equal(evidence.starting_head,'ff22161701512ff661f178534cb75884f1c75dd7');
  assert.equal(evidence.outcome,'PRODUCTION COUNTY POPULATION NOT ATTEMPTED — PREFLIGHT BLOCKED');
  assert.equal(evidence.local_precondition.status,'PASS');
});

test('certified source and transaction-neutral payload remain exact',()=>{
  const input=evidence.certified_input;
  const source=execFileSync('git',['cat-file','blob',`HEAD:${input.source_path}`],
    {cwd:root,maxBuffer:20*1024*1024});
  const payload=fs.readFileSync(path.join(root,input.payload_path));
  assert.equal(source.length,input.source_canonical_bytes);
  assert.equal(sha(source),input.source_sha256);
  assert.equal(payload.length,input.payload_bytes);
  assert.equal(sha(payload),input.payload_sha256);
  const sql=payload.toString('utf8');
  assert.equal(sql.match(/^INSERT INTO public\.gridly_texas_county_boundaries /gm)?.length,254);
  assert.doesNotMatch(sql,/^\s*(?:BEGIN|COMMIT|ROLLBACK|CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE|UPDATE|DELETE|MERGE)\b/im);
  assert.doesNotMatch(sql,/\bON\s+CONFLICT\b|\bUPSERT\b/i);
});

test('accepted recovery and psql streaming readiness remain local prerequisites',()=>{
  assert.equal(recovery.retry_gate,'PHASE 14 RETRY RECOVERY GATE SATISFIED');
  assert.equal(recovery.checkpoint_timestamp,'2026-09-14T04:46:09Z');
  assert.equal(evidence.recovery_gate.backup_or_restore_action_performed,false);
  assert.equal(readiness.recommendation,'PSQL FILE STREAMING READY');
  assert.equal(evidence.certified_input.executor_recommendation,'PSQL FILE STREAMING READY');
});

test('production preflight is accurately blocked before authentication',()=>{
  const p=evidence.production_preflight;
  assert.equal(p.status,'BLOCKED_BEFORE_AUTHENTICATED_SESSION');
  assert.equal(p.psql_exit_code,2);
  assert.equal(p.sanitized_failure_category,'AUTHENTICATION_OR_PASSWORD_CONFIGURATION');
  assert.equal(p.production_endpoint_identity_verified,false);
  assert.equal(p.authenticated_production_session_opened,false);
  assert.equal(p.read_only_transaction_opened,false);
  assert.equal(p.production_sql_executed,false);
  assert.equal(p.fresh_target_row_count,null);
  assert.equal(p.raw_connection_error_recorded,false);
  assert.equal(p.credential_value_printed_or_recorded,false);
});

test('no production execution or second write attempt occurred',()=>{
  const x=evidence.production_execution;
  assert.equal(x.one_session_executor_started,false);
  assert.equal(x.write_transaction_opened,false);
  assert.equal(x.payload_streamed,false);
  assert.equal(x.payload_insert_statements_executed,0);
  assert.equal(x.commit_executed,false);
  assert.equal(x.second_write_attempted,false);
  assert.equal(evidence.production_change_inventory.authorized_rows_inserted,0);
  assert.equal(evidence.production_change_inventory.unintended_production_write,false);
});

test('unresolved blockers and responder inactivity are retained',()=>{
  assert.equal(evidence.p12_01,'OPEN');
  assert.equal(evidence.b03,'OPEN');
  assert.equal(evidence.responder_activation,'NONE');
  assert.equal(evidence.agency_publishing_enabled,false);
  assert.equal(evidence.production_change_inventory.responder_object_created,false);
});

test('all Phase 14E local Markdown links resolve',()=>{
  const full=path.join(root,docPath);
  for(const match of doc.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)){
    if(/^https?:\/\//.test(match[1])) continue;
    assert.ok(fs.existsSync(path.resolve(path.dirname(full),match[1])),
      `broken local link ${match[1]}`);
  }
});

test('Phase 14E evidence contains no credential-bearing material',()=>{
  const combined=doc+'\n'+JSON.stringify(evidence);
  assert.doesNotMatch(combined,/postgres(?:ql)?:\/\/[^\s]+/i);
  assert.doesNotMatch(combined,/SUPABASE_(?:ACCESS_TOKEN|SERVICE_ROLE|DB_PASSWORD)/i);
  assert.doesNotMatch(combined,/BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY/i);
  assert.doesNotMatch(combined,/eyJ[A-Za-z0-9_-]{20,}/);
});
