const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Deliberately no connection URL, production credentials, or non-loopback host.
// Run against a DISPOSABLE PostgreSQL 17 cluster on localhost:55441.
const psql = process.env.GRIDLY_TEST_PSQL || 'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const database = `gridly_retention_test_${process.pid}`;
function sql(text, { db = database, fail = false } = {}) {
  const result = spawnSync(psql, ['-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
    '-h','127.0.0.1','-p','55441','-U','postgres','-d',db],
    { input: text, encoding: 'utf8', windowsHide: true, timeout: 30000,
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key))) });
  if (fail) { assert.notEqual(result.status,0,'query must be denied'); return result.stderr; }
  assert.equal(result.status,0,result.error?.message || result.stderr);
  return result.stdout.trim();
}
const fixture = fs.readFileSync(path.join(__dirname,'fixtures/lp24421-baseline.sql'),'utf8');
before(() => {
  sql(`create database ${database}`,{db:'postgres'});
  sql(fixture);
  sql(fs.readFileSync(path.join(__dirname,'../supabase/migrations/202609080001_community_report_retention.sql'),'utf8'));
  assert.equal(sql('select count(*) from reports'),'0','unverifiable legacy origins are all removed');
  // Trusted original-time fixture, representing a post-control report aged 100 days.
  sql("insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity,device_id,created_at) values ('DOT-100','Crossing',30,-95,'blocked','high','fixture-device',now()-interval '100 days')");
});
after(() => sql(`drop database if exists ${database} with (force)`,{db:'postgres'}));

test('authorized pre-cleanup record stays linked; day 149, 180 and later are removed', () => {
  assert.equal(sql("select crossing_id||':'||l.device_id from reports r join report_retention.device_links l on l.report_id=r.id"),'DOT-100:fixture-device');
  assert.equal(sql('select count(*) from reports where device_id is not null'),'0');
  assert.equal(sql("select (linkage_deadline-original_submitted_at = interval '4320 hours') and (cleanup_after-original_submitted_at = interval '3576 hours') from reports"),'t');
});
test('legacy unknown/future origins and synthetic device IDs are conservatively removed', () => {
  assert.equal(sql("select count(*) from reports where crossing_id in ('MISSING','FUTURE') or crossing_id like 'hazard-%'"),'0');
  assert.equal(sql("select (select count(*) from history_capture.historical_events)+(select count(*) from history_capture.writer_monitoring_events)+(select count(*) from history_capture.retention_runs)"),'0');
});
test('post-control reports at and beyond the cleanup/deadline boundary lose the actual private link', () => {
  sql("insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity,device_id) values ('BOUNDARY','Crossing',30,-95,'blocked','high','boundary-device')");
  assert.equal(sql("select count(*) from report_retention.device_links where device_id='boundary-device'"),'1');
  sql("alter table reports disable trigger report_retention_origin; update reports set original_submitted_at=statement_timestamp()-interval '4320 hours',linkage_deadline=statement_timestamp(),cleanup_after=statement_timestamp() where crossing_id='BOUNDARY'; alter table reports enable trigger report_retention_origin;");
  assert.equal(sql('select report_retention.run_cleanup()'),'1');
  assert.equal(sql("select count(*) from report_retention.device_links where device_id='boundary-device'"),'0');
  assert.equal(sql("set role authenticated; select count(id) from reports where crossing_id='BOUNDARY'"),'0');
  // Remove this test's aggregate contribution so independent aggregate assertions
  // remain readable; only the isolated fixture database is affected.
  sql("update report_retention.condition_month_counts set report_count=report_count-1 where submission_month=date_trunc('month',now()-interval '180 days')::date and condition_family='crossing'");
});
test('retained history has only month, broad condition family and count', () => {
  assert.equal(sql("select string_agg(column_name,',' order by ordinal_position) from information_schema.columns where table_schema='report_retention' and table_name='condition_month_counts'"),'submission_month,condition_family,report_count');
  assert.equal(sql('select sum(report_count) from report_retention.condition_month_counts'),'5');
  assert.doesNotMatch(sql('select row_to_json(c) from report_retention.condition_month_counts c'),/fixture-device|legacy-id|device_id|report_id/);
});
test('edits, confirmation changes and attempted origin/device reassignment cannot extend age', () => {
  const before = sql('select original_submitted_at||\'/\'||linkage_deadline||\'/\'||cleanup_after from reports');
  sql("update reports set detail='Condition confirmed',report_type='cleared',expires_at=now()+interval '1 year'");
  assert.equal(sql('select original_submitted_at||\'/\'||linkage_deadline||\'/\'||cleanup_after from reports'),before);
  for (const assignment of ["created_at=now()","original_submitted_at=now()","cleanup_after=now()+interval '1 year'","linkage_deadline=now()+interval '1 year'","id=gen_random_uuid()","device_id='replacement'"]) {
    sql(`update reports set ${assignment}`,{fail:true});
  }
});
test('trusted copies must preserve age; expired/missing/future imports are rejected', () => {
  for (const time of ["now()-interval '180 days'",'null',"now()+interval '1 day'"]) {
    sql(`insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity,device_id,created_at)
      values ('IMPORT','Crossing',30,-95,'blocked','high','fixture-device',${time})`,{fail:true});
  }
  sql("insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity,device_id,created_at) select 'COPY',crossing_name,lat,lng,report_type,severity,device_id,original_submitted_at from reports");
  assert.equal(sql("select count(distinct linkage_deadline) from reports"),'1');
});
test('public/ordinary/service queries cannot recover the private association or reopen copies', () => {
  for (const role of ['anon','authenticated','service_role']) {
    for (const query of ["select device_id from reports","select * from reports","select row_to_json(r) from reports r","select id from reports where device_id='fixture-device'","select * from report_retention.device_links","select * from report_retention.condition_month_counts","select * from history_capture.historical_events"]) {
      sql(`set role ${role}; ${query}`,{fail:true});
    }
  }
  assert.equal(sql('set role anon; select count(id) from reports'),'2');
  sql("set role anon; insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity,device_id) values ('DOT-new','Crossing',30,-95,'blocked','high','new-device')");
  sql("set role anon; insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity,created_at) values ('bad','Crossing',30,-95,'blocked','high',now())",{fail:true});
  sql("insert into history_capture.historical_events(envelope) values ('{}')",{fail:true});
  sql("set role anon; select report_retention.run_cleanup()",{fail:true});
});
test('failed cleanup is visible, atomic and retryable; expiry reads fail closed', () => {
  // Superuser fixture time travel, never a production entry point.
  sql(`alter table reports disable trigger report_retention_origin; update reports set cleanup_after=now()-interval '1 second',linkage_deadline=now()-interval '1 second'; alter table reports enable trigger report_retention_origin;
    create function public.fail_delete_fixture() returns trigger language plpgsql as $$ begin raise exception 'fixture-device MUST NOT ENTER AUDIT'; end $$;
    create trigger fixture_failure before delete on reports for each row execute function public.fail_delete_fixture();`);
  assert.equal(sql('select report_retention.run_cleanup()'),'-1');
  assert.equal(sql('select count(*) from reports'),'3');
  assert.equal(sql('set role anon; select count(id) from reports'),'0');
  assert.equal(sql('select last_status from report_retention.health'),'failed');
  assert.equal(sql('select breached_deadline_count from report_retention.health'),'3');
  assert.equal(sql('select error_code from report_retention.runs order by id desc limit 1'),'P0001');
  assert.doesNotMatch(sql('select row_to_json(r) from report_retention.runs r'),/fixture-device|MUST NOT/);
  sql('drop trigger fixture_failure on reports');
  assert.equal(sql('select report_retention.run_cleanup()'),'3');
  assert.equal(sql('select count(*) from reports'),'0');
  assert.equal(sql('select count(*) from report_retention.device_links'),'0');
  assert.equal(sql('select breached_deadline_count from report_retention.health'),'0');
});
test('repeated cleanup is idempotent without duplicate historical counts', () => {
  const counts = sql('select sum(report_count) from report_retention.condition_month_counts');
  assert.equal(sql('select report_retention.run_cleanup()'),'0');
  assert.equal(sql('select report_retention.run_cleanup()'),'0');
  assert.equal(sql('select sum(report_count) from report_retention.condition_month_counts'),counts);
});
test('stale maintenance blocks new linked submissions and the least-privilege monitor detects it', async () => {
  const { HEALTH_SQL, checkRetention, evaluateRetentionHealth } = await import('../tools/retention/check-report-retention.mjs');
  assert.equal(evaluateRetentionHealth(JSON.parse(sql(`set role gridly_retention_monitor; ${HEALTH_SQL}`))),true);
  sql('set role gridly_retention_monitor; select * from report_retention.device_links',{fail:true});
  sql("update report_retention.runs set completed_at=now()-interval '10 minutes' where status='succeeded'");
  assert.equal(evaluateRetentionHealth(JSON.parse(sql(HEALTH_SQL))),false);
  sql("set role anon; insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity,device_id) values ('stale','Crossing',30,-95,'blocked','high','device')",{fail:true});
  assert.equal(checkRetention({env:{}}).healthy,false);
  const env = {PGHOST:'monitor.invalid',PGUSER:'monitor',PGDATABASE:'postgres',PGSSLMODE:'verify-full'};
  assert.deepEqual(checkRetention({env,run:()=>({status:1,stderr:'secret database details'})}),{healthy:false,reason:'monitor_query_failed'});
  assert.equal(checkRetention({env,run:()=>({status:0,stdout:'invalid'})}).healthy,false);
  sql('select report_retention.run_cleanup()');
  assert.equal(evaluateRetentionHealth(JSON.parse(sql(HEALTH_SQL))),true);
  assert.equal(sql("select count(*) from pg_publication_tables where schemaname='report_retention'"),'0');
});

function appFunction(name, nextName) {
  const source = fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.ok(start>=0 && end>start);
  return source.slice(start,end);
}
test('browser history is removed without deserialization and new history never reaches storage', () => {
  const saved = new Map([['gridlyEventHistoryV1','invalid legacy data'],['gridly_event_history_v1','legacy'],['gridlyHistoricalIntelligence','legacy'],['gridlyDeviceId','fixture-device']]);
  const ctx = vm.createContext({ GRIDLY_EVENT_HISTORY_STORAGE_KEY:'gridlyEventHistoryV1',
    gridlyCreateEmptyEventHistoryState:()=>({crossingEvents:[],hazardEvents:[]}),
    gridlyBuildStoredEventHistoryState:state=>({state,cleanup:{}}),
    localStorage:{removeItem:key=>saved.delete(key),setItem(){throw Error('must not write');}} });
  vm.runInContext(appFunction('gridlyReadEventHistoryState','gridlyMinutesBetween'),ctx);
  assert.equal(ctx.gridlyReadEventHistoryState().crossingEvents.length,0);
  assert.deepEqual([...saved.keys()],['gridlyDeviceId']);
  assert.equal(ctx.gridlyWriteEventHistoryState({reportId:'fixture'}).written,false);
  ctx.localStorage.removeItem=()=>{throw Error('denied')};
  assert.equal(ctx.gridlyReadEventHistoryState().storageReadError,'legacy_history_removal_failed');
});
test('report helper uses only the token protocol and never falls back to direct INSERT', async () => {
  const source = fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  const start = source.indexOf('async function gridlyInsertWithCountyMetadataFallback(');
  const end = source.indexOf('const gridlyReportSubmissionOwnershipState',start);
  const sent=[];
  const ctx=vm.createContext({deviceId:'fixture-private-device', GRIDLY_REPORTS_BASE_INSERT_KEYS:[],
    gridlyPickRowKeys:row=>({...row}), gridlyRefreshPendingOperationButton(){},
    gridlyGetCommunityProtocolClient:()=>({submit:async(kind,payload,client,device)=>{sent.push({kind,payload,device});return {status:'accepted'};}})});
  vm.runInContext(source.slice(start,end),ctx);
  const result=await ctx.gridlyInsertWithCountyMetadataFallback({from(){throw Error('legacy write forbidden');}},'reports',{crossing_id:'DOT-fixture',device_id:null});
  assert.equal(result.error,null);assert.equal(sent.length,1);assert.equal(sent[0].device,'fixture-private-device');
  assert.ok(!('device_id' in sent[0].payload));assert.doesNotMatch(JSON.stringify(result),/fixture-private-device/);
});
test('writer cannot be re-enabled by canary/caller overrides', async () => {
  const ctx = vm.createContext({});
  for(const file of ['historyCaptureFlags.js','historyCaptureWriter.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/history-capture',file),'utf8'),ctx);
  assert.equal(ctx.gridlyPassiveHistoryCaptureFlags.getHistoryCaptureFlags().writesEnabled,false);
  const writer = ctx.gridlyPassiveHistoryCaptureWriter;
  assert.ok(writer);
  const result = await writer.writePhase1AEnvelope({}, { writerEnabled:true, storageClient: { schema(){throw Error('must not reach storage');} } });
  assert.equal(result.noop,true);
  assert.equal(result.writesEnabled,false);
});

test('LP244.21C: old replay bodies are rejected after the hard protocol cutover', () => {
  sql(fs.readFileSync(path.join(__dirname,'../supabase/migrations/202609080002_community_submission_protocol.sql'),'utf8'));
  const denied=sql("set role anon; insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity,device_id) values ('hazard-a9358fc0-7dbd-4658-a7ae-f3186a32c08b','Road condition',30,-95,'flooded','high','legacy-device')",{fail:true});
  assert.match(denied,/permission denied/);
  assert.equal(sql('select count(*) from report_retention.device_links'),'0');
});
