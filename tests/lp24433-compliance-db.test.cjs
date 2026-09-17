const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const {renderAuthorization,migrationSql,supersededMigrationSql}=require('./helpers/lp24422a-prelaunch.cjs');

const ROOT=path.resolve(__dirname,'..');
const psql=process.env.GRIDLY_TEST_PSQL||'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const port=process.env.GRIDLY_TEST_PGPORT||'55441';
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^PG/i.test(key)));
const database=`gridly_lp24433_${process.pid}`;
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/lp24421-baseline.sql'),'utf8');
const availability=fs.readFileSync(path.join(ROOT,'supabase/migrations/202609160001_lp24429a_reporting_availability_contract.sql'),'utf8');
const compliance=fs.readFileSync(path.join(ROOT,'supabase/migrations/20260916183911_google_play_compliance_closure.sql'),'utf8');

function sql(query,{db=database,fail=false}={}) {
  const result=spawnSync(psql,['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U','postgres','-d',db],
    {input:query,encoding:'utf8',env,windowsHide:true,timeout:30000});
  if(fail){assert.notEqual(result.status,0,'statement must fail closed');return result.stderr;}
  assert.equal(result.status,0,result.error?.message||result.stderr);return result.stdout.trim();
}

function insertReport(device='owner-device') {
  return sql(`insert into public.reports(crossing_id,crossing_name,railroad,lat,lng,report_type,severity,detail,source,confidence,device_id,expires_at)
    values ('DOT-${randomUUID()}','Test crossing','Test rail',30,-95,'blocked','high','Observed delay','user','Community report','${device}',clock_timestamp()+interval '60 minutes') returning id`);
}

before(()=>{
  sql(`create database ${database}`,{db:'postgres'});
  sql(fixture); sql(renderAuthorization());
  for(const marker of supersededMigrationSql()) sql(marker);
  sql(migrationSql()); sql(availability); sql(compliance);
  sql("update report_retention.admission_state set reporting_enabled=true,changed_at=clock_timestamp() where singleton");
});
after(()=>sql(`drop database if exists ${database} with(force)`,{db:'postgres'}));

test('migration is fail-closed and private schemas expose no tables or owner actions',()=>{
  assert.equal(sql("select reporting_enabled from report_retention.admission_state where singleton"),'t','fixture explicitly enabled after migration');
  for(const role of ['anon','authenticated','service_role']) {
    for(const table of ['moderation.complaints','moderation.action_log','moderation.source_suppressions','privacy_ops.deletion_requests']) {
      assert.equal(sql(`select has_table_privilege('${role}','${table}','SELECT') or has_table_privilege('${role}','${table}','INSERT,UPDATE,DELETE')`),'f');
      sql(`set role ${role}; select * from ${table}`,{fail:true});
    }
    assert.equal(sql(`select has_function_privilege('${role}','moderation.apply_action(uuid,text,text)','EXECUTE')`),'f');
    assert.equal(sql(`select has_function_privilege('${role}','privacy_ops.complete_deletion_request(uuid,text,text)','EXECUTE')`),'f');
  }
  assert.equal(sql("select has_function_privilege('anon','public.submit_community_moderation_report(text,uuid,text,text)','EXECUTE')"),'t');
  assert.equal(sql("select has_function_privilege('anon','public.request_community_report_deletion(text,uuid,text)','EXECUTE')"),'t');
});

test('complaints are bounded, idempotent, digest-only and do not disclose private data',()=>{
  const report=insertReport('complaint-source');
  const operation=randomUUID();
  const accepted=JSON.parse(sql(`set role anon; select public.submit_community_moderation_report('${operation}','${report}','false_information','complainant-device')`));
  assert.equal(accepted.status,'accepted');
  assert.equal(JSON.parse(sql(`set role anon; select public.submit_community_moderation_report('${operation}','${report}','false_information','complainant-device')`)).status,'already_processed');
  assert.equal(sql(`select reason||':'||status||':'||(octet_length(operation_digest)=32)||':'||(octet_length(reporter_device_digest)=32) from moderation.complaints where target_report_id='${report}'`),'false_information:open:true:true');
  assert.doesNotMatch(sql(`select row_to_json(c) from moderation.complaints c where target_report_id='${report}'`),/complainant-device|complaint-source/);
  assert.equal(JSON.parse(sql(`set role anon; select public.submit_community_moderation_report('${randomUUID()}','${report}','unsupported','device')`)).status,'invalid_request');
});

test('moderator quarantine removes public visibility and action evidence is immutable',()=>{
  const report=insertReport('moderated-source');
  sql(`set role anon; select public.submit_community_moderation_report('${randomUUID()}','${report}','dangerous_content','reviewer-device')`);
  const complaint=sql(`select id from moderation.complaints where target_report_id='${report}'`);
  assert.equal(sql(`select moderation.apply_action('${complaint}','quarantine','credible unsafe instruction')`),'target_quarantined');
  assert.equal(sql(`set role anon; select count(id) from public.reports where id='${report}'`),'0');
  assert.equal(sql(`select action||':'||outcome from moderation.action_log where complaint_id='${complaint}'`),'quarantine:target_quarantined');
  sql(`update moderation.action_log set outcome='changed' where complaint_id='${complaint}'`,{fail:true});
});

test('source suppression remains private, removes current source content and rejects new submissions',()=>{
  const first=insertReport('repeat-abuser');
  const second=insertReport('repeat-abuser');
  sql(`set role anon; select public.submit_community_moderation_report('${randomUUID()}','${first}','spam','complainant')`);
  const complaint=sql(`select id from moderation.complaints where target_report_id='${first}'`);
  assert.equal(sql(`select moderation.apply_action('${complaint}','source_suppression','repeated coordinated spam')`),'source_suppressed_and_current_reports_removed');
  assert.equal(sql(`select count(*) from public.reports where id in ('${first}','${second}') and moderation_state='removed'`),'2');
  assert.equal(sql('select count(*) from moderation.source_suppressions'),'1');
  assert.doesNotMatch(sql('select row_to_json(s) from moderation.source_suppressions s'),/repeat-abuser/);
  sql("insert into public.reports(crossing_id,crossing_name,lat,lng,report_type,severity,device_id) values ('blocked','Crossing',30,-95,'blocked','high','repeat-abuser')",{fail:true});
});

test('deletion is same-device verified, cross-device forbidden and removes report/link atomically',()=>{
  const report=insertReport('delete-owner');
  const cross=JSON.parse(sql(`set role anon; select public.request_community_report_deletion('${randomUUID()}','${report}','other-device')`));
  assert.equal(cross.status,'forbidden');
  const operation=randomUUID();
  const accepted=JSON.parse(sql(`set role anon; select public.request_community_report_deletion('${operation}','${report}','delete-owner')`));
  assert.equal(accepted.status,'accepted');
  assert.equal(JSON.parse(sql(`set role anon; select public.request_community_report_deletion('${operation}','${report}','delete-owner')`)).status,'already_processed');
  assert.equal(sql(`select privacy_ops.complete_deletion_request('${accepted.request_id}','delete','verified in-app request')`),'delete');
  assert.equal(sql(`select count(*) from public.reports where id='${report}'`),'0');
  assert.equal(sql(`select count(*) from report_retention.device_links where report_id='${report}'`),'0');
  assert.equal(sql(`select status||':'||outcome||':'||(target_report_id is null)||':'||(requester_device_digest is null) from privacy_ops.deletion_requests where id='${accepted.request_id}'`),'completed:delete:true:true');
});

test('moderation and deletion never extend report retention boundaries',()=>{
  const report=insertReport('retention-source');
  const beforeValue=sql(`select original_submitted_at||'/'||linkage_deadline||'/'||cleanup_after from public.reports where id='${report}'`);
  sql(`set role anon; select public.submit_community_moderation_report('${randomUUID()}','${report}','other','complainant')`);
  sql(`set role anon; select public.request_community_report_deletion('${randomUUID()}','${report}','retention-source')`);
  assert.equal(sql(`select original_submitted_at||'/'||linkage_deadline||'/'||cleanup_after from public.reports where id='${report}'`),beforeValue);
  assert.equal(sql(`select bool_and(retain_until<=created_at+interval '149 days') from moderation.complaints where target_report_id='${report}'`),'t');
  assert.equal(sql(`select bool_and(retain_until<=created_at+interval '149 days') from privacy_ops.deletion_requests where target_report_id='${report}'`),'t');
});

test('compliance cleanup removes expired source, action, complaint and deletion evidence in dependency order',()=>{
  const report=insertReport('cleanup-source');
  sql(`set role anon; select public.submit_community_moderation_report('${randomUUID()}','${report}','other','cleanup-complainant')`);
  const complaint=sql(`select id from moderation.complaints where target_report_id='${report}'`);
  const request=JSON.parse(sql(`set role anon; select public.request_community_report_deletion('${randomUUID()}','${report}','cleanup-source')`)).request_id;
  sql(`update moderation.complaints set retain_until=clock_timestamp()-interval '32 days' where id='${complaint}';
    update privacy_ops.deletion_requests set retain_until=clock_timestamp()-interval '32 days' where id='${request}';
    insert into moderation.action_log(complaint_id,target_report_digest,action,outcome,created_at,retain_until)
      select id,target_report_digest,'no_action','cleanup_fixture',clock_timestamp()-interval '180 days',clock_timestamp()-interval '1 day'
      from moderation.complaints where id='${complaint}';
    insert into moderation.source_suppressions(device_digest,complaint_id,created_at,expires_at,reason)
      values (extensions.digest(convert_to('expired-source','UTF8'),'sha256'),null,clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 day','cleanup fixture')`);
  assert.ok(Number(sql('select moderation.run_compliance_cleanup()'))>=4);
  assert.equal(sql(`select (select count(*) from moderation.action_log where complaint_id='${complaint}')||':'||(select count(*) from moderation.complaints where id='${complaint}')||':'||(select count(*) from privacy_ops.deletion_requests where id='${request}')||':'||(select count(*) from moderation.source_suppressions where reason='cleanup fixture')`),'0:0:0:0');
  assert.equal(sql(`select count(*) from public.reports where id='${report}'`),'1','compliance metadata cleanup never deletes a still-live report');
});
