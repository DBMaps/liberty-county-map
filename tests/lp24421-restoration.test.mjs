import {test,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {inspect,evaluate,ledgerFingerprint,VERSION,migrationHash,INSPECT_SQL} from '../tools/retention/certify-restoration.mjs';
const psql=process.env.GRIDLY_TEST_PSQL||'C:/Program Files/PostgreSQL/17/bin/psql.exe';
let db,id,token,evidence;
const baseEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^PG/i.test(k)));
function sql(query,database=db,{fail=false}={}) {
 const r=spawnSync(psql,['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55441','-U','postgres','-d',database],{input:query,encoding:'utf8',env:baseEnv,windowsHide:true,timeout:30000});
 if(fail){assert.notEqual(r.status,0);return;} assert.equal(r.status,0,r.stderr);return r.stdout.trim();
}
const env=()=>({...baseEnv,PGHOST:'127.0.0.1',PGPORT:'55441',PGUSER:'postgres',PGDATABASE:db,GRIDLY_RETENTION_PSQL:psql});
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const snapshot=()=>inspect({env:env()});
const check=()=>evaluate(snapshot(),evidence);
const sanitize=()=>sql(file('supabase/retention/sanitize-restoration.sql'));
beforeEach(()=>{
 db=`gridly_recovery_${process.pid}_${randomUUID().replaceAll('-','').slice(0,8)}`;
 sql(`create database ${db}`,'postgres');sql(file('tests/fixtures/lp24421-baseline.sql'));
 for(const name of ['202609080001_community_report_retention.sql','202609080002_community_submission_protocol.sql'])sql(file('supabase/migrations/'+name));
 token=randomUUID();
 id=JSON.parse(sql(`set role anon; select public.submit_community_observation('${token}','{"crossing_id":"DOT-safe","crossing_name":"Crossing","lat":30,"lng":-95,"report_type":"blocked","severity":"high"}','synthetic-device');`)).report.id;
 sql(file('supabase/retention/quarantine-restoration.sql'));
 const s=snapshot();evidence={version:VERSION,migrationHash,ledger:ledgerFingerprint(s.ledger),capturedAt:s.observedAt,validUntil:new Date(Date.now()+3600000).toISOString(),sourceWritesStopped:true,sourceContinuityVerified:true,networkIsolationVerified:true,authorizationReference:'synthetic-owner-approval',sourceReference:'synthetic-final-source'};
});
afterEach(()=>sql(`drop database if exists ${db} with(force)`,'postgres'));
test('safe quarantined recovery passes read-only checks; cannot authorize reconnection',()=>{
 const before=sql('select row_to_json(r) from report_retention.runs r order by id');
 assert.deepEqual(check(),{version:VERSION,pass:true,reconnectionAuthorized:false,failures:[],migrationHash});
 assert.equal(sql('select row_to_json(r) from report_retention.runs r order by id'),before);
 assert.match(INSPECT_SQL,/repeatable read read only/);assert.doesNotMatch(INSPECT_SQL,/run_cleanup\(|public\.submit_community_observation\(/);
});
test('missing, stale, future, or unverified source evidence fails closed',()=>{
 for(const patch of [null,{},{...evidence,sourceContinuityVerified:false},{...evidence,networkIsolationVerified:false},{...evidence,validUntil:'2000-01-01'},{...evidence,capturedAt:'2100-01-01'}])assert.equal(evaluate(snapshot(),patch).pass,false);
});
test('expired associations fail then explicit cleanup preserves consumed receipts and is idempotent',()=>{
 sql(`alter table reports disable trigger report_retention_origin; alter table report_retention.observation_receipts disable trigger observation_receipt_immutable;
 update reports set created_at=now()-interval '181 days',original_submitted_at=now()-interval '181 days',linkage_deadline=now()-interval '1 day',cleanup_after=now()-interval '32 days';
 update report_retention.observation_receipts set original_submitted_at=(select original_submitted_at from reports where id=report_id);
 alter table reports enable trigger report_retention_origin; alter table report_retention.observation_receipts enable trigger observation_receipt_immutable;`);
 assert.ok(check().failures.includes('expiredLinks'));sanitize();assert.equal(check().pass,true);
 const count=sql('select sum(report_count) from report_retention.condition_month_counts');sanitize();assert.equal(sql('select sum(report_count) from report_retention.condition_month_counts'),count);
 assert.equal(sql('select count(*) from report_retention.device_links'),'0');assert.equal(sql('select count(*) from report_retention.observation_receipts'),'0');assert.equal(sql('select count(*) from report_retention.replay_evidence'),'1');
});
test('unverifiable legacy origin and device-derived identity fail and are deleted without manufacturing receipts',()=>{
 sql(`alter table reports disable trigger report_retention_origin; update reports set crossing_id='hazard-synthetic-device-1788888888888',original_submitted_at='-infinity'; alter table reports enable trigger report_retention_origin;`);
 assert.ok(check().failures.includes('untrustedOrigins'));assert.ok(check().failures.includes('deviceInConditions'));sanitize();assert.equal(check().pass,true);assert.equal(sql('select count(*) from reports'),'0');
});
test('reset/extended clocks and missing live provenance cannot certify',()=>{
 sql(`alter table reports disable trigger report_retention_origin; update reports set created_at=created_at+interval '1 second',original_submitted_at=original_submitted_at+interval '1 second',linkage_deadline=linkage_deadline+interval '1 second',cleanup_after=cleanup_after+interval '1 second'; alter table reports enable trigger report_retention_origin;`);
 assert.ok(check().failures.includes('untrustedOrigins'));
 sql('delete from report_retention.observation_receipts');assert.ok(check().failures.includes('missingReceipts'));sanitize();assert.equal(check().pass,true);
});
test('missing consumed ledger stays blocked even after all unsafe reports and links are removed',()=>{
 sql('delete from report_retention.observation_receipts; alter table report_retention.replay_evidence disable trigger replay_evidence_immutable; delete from report_retention.replay_evidence; alter table report_retention.replay_evidence enable trigger replay_evidence_immutable;');
 assert.ok(check().failures.includes('ledger_continuity'));sanitize();assert.equal(sql('select count(*) from reports'),'0');assert.ok(check().failures.includes('ledger_continuity'));
});
test('actual database clone predating a consumed token cannot pass the final source witness',()=>{
 const source=db,clone=db+'_clone';sql(`create database ${clone} template ${source}`,'postgres');
 try {
  sql(`select public.cancel_community_operation('${randomUUID()}')`);
  evidence.ledger=ledgerFingerprint(snapshot().ledger);
  db=clone;assert.ok(check().failures.includes('ledger_continuity'));sanitize();assert.ok(check().failures.includes('ledger_continuity'));
 } finally {db=source;sql(`drop database ${clone} with(force)`,'postgres');}
});
test('duplicate token fixture and removed uniqueness constraint fail certification',()=>{
 sql('alter table report_retention.observation_receipts drop constraint observation_receipts_token_digest_fkey; alter table report_retention.replay_evidence drop constraint replay_evidence_pkey; insert into report_retention.replay_evidence select * from report_retention.replay_evidence;');
 const c=check();assert.equal(c.pass,false);assert.ok(c.failures.includes('duplicateTokens'));assert.ok(c.failures.includes('constraint:replay_evidence_pkey'));
});
test('plaintext consumed tokens and historical device copies fail and explicit sanitization removes them',()=>{
 sql(`update reports set detail='${token}'; alter table history_capture.historical_events disable trigger history_capture_closed; insert into history_capture.historical_events(envelope) values ('{"device_id":"synthetic-device"}'); alter table history_capture.historical_events enable trigger history_capture_closed;`);
 assert.ok(check().failures.includes('plaintextTokens'));assert.ok(check().failures.includes('legacyHistory'));sanitize();assert.equal(check().pass,true);
});
test('ordinary-client table and RPC access is detected; sanitizer refuses unquarantined access',()=>{
 sql('grant select(device_id) on report_retention.device_links to anon; grant execute on function public.submit_community_observation(text,jsonb,text) to authenticated;');
 assert.ok(check().failures.includes('clientTableAccess'));assert.ok(check().failures.includes('clientFunctionAccess'));sql(file('supabase/retention/sanitize-restoration.sql'),db,{fail:true});
 sql(file('supabase/retention/quarantine-restoration.sql'));assert.equal(check().pass,true);
});
test('altered bypass RPC, disabled guard and outdated schema all fail without invoking the RPC',()=>{
 sql("create or replace function public.cancel_community_operation(operation_id text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$ begin return '{}'::jsonb; end $$;");
 assert.ok(check().failures.includes('function_contract:public.cancel_community_operation'));
 sql('alter table report_retention.replay_evidence disable trigger replay_evidence_immutable');assert.ok(check().failures.includes('trigger:replay_evidence_immutable'));
 sql('drop policy report_retention_read_boundary on reports; drop index reports_cleanup_after_idx;');assert.ok(check().failures.includes('read_policy'));assert.ok(check().failures.includes('cleanup_index'));
 sql('drop table report_retention.observation_receipts');assert.throws(snapshot,/inspection failed/);
});
test('cleanup failure and replication exposure remain blocked',()=>{
 sql("insert into report_retention.runs(status,completed_at,error_code) values ('failed',now(),'XX000'); alter publication supabase_realtime add table reports;");
 assert.ok(check().failures.includes('cleanupUnhealthy'));assert.ok(check().failures.includes('replicationExposure'));
});
test('CLI returns nonzero for missing evidence/connection and unsafe restore; no secrets in diagnostics',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gridly-recovery-evidence-'));
 try {
  const path=join(dir,'evidence.json');writeFileSync(path,JSON.stringify(evidence));
  const run=args=>spawnSync(process.execPath,['tools/retention/certify-restoration.mjs',...args],{env:env(),encoding:'utf8',windowsHide:true});
  const pass=run(['--evidence',path]);assert.equal(pass.status,0,pass.stdout);
  assert.notEqual(run([]).status,0);
  sql("insert into report_retention.runs(status) values ('failed')");const fail=run(['--evidence',path]);assert.equal(fail.status,1);assert.equal(JSON.parse(fail.stdout).pass,false);assert.doesNotMatch(fail.stdout,/synthetic-device|DOT-safe|postgres|password/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
