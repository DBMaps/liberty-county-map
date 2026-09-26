const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { renderAuthorization, migrationSql, supersededMigrationSql } = require('./helpers/lp24422a-prelaunch.cjs');

const ROOT = path.resolve(__dirname, '..');
const psql = process.env.GRIDLY_TEST_PSQL || 'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const port = process.env.GRIDLY_TEST_PGPORT || '55458';
const database = `gridly_lp24458_${process.pid}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)));
const migrationName = '20260926021558_lp24458_compliance_cleanup_health.sql';
const migration = fs.readFileSync(path.join(ROOT, 'supabase/migrations', migrationName), 'utf8');
const fixture = fs.readFileSync(path.join(ROOT, 'tests/fixtures/lp24421-baseline.sql'), 'utf8');
const availability = fs.readFileSync(path.join(ROOT, 'supabase/migrations/202609160001_lp24429a_reporting_availability_contract.sql'), 'utf8');
const compliance = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260916183911_google_play_compliance_closure.sql'), 'utf8');
const versions = [
  '202606070001','202606110001','202606160001','202606160002',
  '202606170410','202606170411','202606170425','202606170426',
  '202607280100','202607290100','202607290200','202609080001',
  '202609080002','20260908200554','202609160001','20260916183911',
];

function sql(query, { db = database, fail = false } = {}) {
  const result = spawnSync(psql, [
    '-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
    '-h','127.0.0.1','-p',port,'-U','postgres','-d',db,
  ], { input: query, encoding: 'utf8', env, windowsHide: true, timeout: 60000 });
  if (fail) {
    assert.notEqual(result.status, 0, 'statement must fail closed');
    return result.stderr;
  }
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  return result.stdout.trim();
}

function json(query) { return JSON.parse(sql(`select row_to_json(x) from (${query}) x`)); }
function healthRows() { return JSON.parse(sql('select json_agg(x order by subsystem) from public.gridly_cleanup_alert_health() x')); }

before(() => {
  sql(`create database ${database}`, { db: 'postgres' });
  sql(fixture);
  sql("do $$ begin if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator noinherit; end if; end $$;");
  sql(renderAuthorization());
  for (const old of supersededMigrationSql()) sql(old);
  sql(migrationSql());
  sql(availability);
  sql(compliance);
  sql(`create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key);
    insert into supabase_migrations.schema_migrations(version) values
      ${versions.map(v => `('${v}')`).join(',')};
    create schema cron;
    create table cron.job(jobid bigint primary key,jobname text not null,active boolean not null,
      schedule text not null,username text not null,database text not null,command text not null);
    create table cron.job_run_details(runid bigint generated always as identity primary key,
      jobid bigint not null,status text,start_time timestamptz,end_time timestamptz);
    insert into cron.job values
      (1,'gridly-community-report-retention',true,'* * * * *','postgres',current_database(),
        'select report_retention.run_cleanup()'),
      (2,'gridly-community-compliance-cleanup',true,'* * * * *','postgres',current_database(),
        'select moderation.run_compliance_cleanup()');
    insert into cron.job_run_details(jobid,status,start_time,end_time)
      values (1,'succeeded',clock_timestamp(),clock_timestamp()),
             (2,'succeeded',clock_timestamp(),clock_timestamp());`);
});
after(() => sql(`drop database if exists ${database} with(force)`, { db: 'postgres' }));

test('identity gate accepts only CRLF/LF representation differences', () => {
  const expected = 'f5385ff3208f62d333563254ea4b6903';
  const definition = JSON.parse(sql("select to_json(pg_get_functiondef('moderation.run_compliance_cleanup()'::regprocedure))"));
  // Hex transport keeps psql stdin line-ending handling out of this proof.
  const digest = value => sql(`select md5(replace(convert_from(decode('${Buffer.from(value,'utf8').toString('hex')}','hex'),'UTF8'),chr(13)||chr(10),chr(10)))`);
  assert.match(migration, /md5\(replace\(pg_get_functiondef\('moderation\.run_compliance_cleanup\(\)'::regprocedure\),\s*chr\(13\)\|\|chr\(10\),chr\(10\)\)\)\s*<> 'f5385ff3208f62d333563254ea4b6903'/);
  assert.equal(digest(definition), expected, 'current LF definition passes');
  assert.equal(digest(definition.replaceAll('\n','\r\n')), expected, 'equivalent CRLF definition passes');
  for (const changed of [
    definition.replace('total_removed','total_removeD'),
    definition + ' ',
    definition.replace('declare removed','declare  removed'),
    definition.replace('declare removed','declareremoved'),
    definition.replace('declare removed','declare\tremoved'),
    definition.replace('\n','\r'),
    definition.replace(' := 0',' := 1'),
    definition.replace("interval '31 days'", "interval '30 days'"),
  ]) assert.notEqual(digest(changed), expected, 'non-line-ending change rejected');
  assert.equal(sql(`select md5(replace(pg_get_functiondef(p.oid),p.prosrc,
      replace(p.prosrc,chr(10),chr(13)||chr(10))))
      from pg_proc p where p.oid='moderation.run_compliance_cleanup()'::regprocedure`),
    'ebfa0b470548a5314fe1569092a740c7', 'CRLF body reproduces recorded production/raw hash');
});

test('isolated migration: identity, one-time apply, safe singleton, unchanged launch state', () => {
  assert.equal(sql("select md5(replace(pg_get_functiondef('moderation.run_compliance_cleanup()'::regprocedure),chr(13)||chr(10),chr(10)))"),
    'f5385ff3208f62d333563254ea4b6903');
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'), '16');
  assert.equal(sql('select reporting_enabled from report_retention.admission_state where singleton'), 'f');
  const guardBefore = sql('select status||\':\'||(launched_at is null) from gridly_control.prelaunch_reset_authorization where singleton');
  const crlfDatabase = `${database}_crlf`;
  sql(`create database ${crlfDatabase} template ${database}`, { db: 'postgres' });
  try {
    sql(`do $$ declare definition text; begin
      select replace(pg_get_functiondef(p.oid),p.prosrc,replace(p.prosrc,chr(10),chr(13)||chr(10)))
        into definition from pg_proc p where p.oid='moderation.run_compliance_cleanup()'::regprocedure;
      execute definition;
    end $$;`, { db: crlfDatabase });
    sql('update cron.job set database=current_database()', { db: crlfDatabase });
    assert.equal(sql("select md5(pg_get_functiondef('moderation.run_compliance_cleanup()'::regprocedure))", { db: crlfDatabase }),
      'ebfa0b470548a5314fe1569092a740c7');
    sql(migration, { db: crlfDatabase });
    assert.equal(sql('select count(*) from moderation.cleanup_health', { db: crlfDatabase }), '1');
  } finally { sql(`drop database ${crlfDatabase} with(force)`, { db: 'postgres' }); }
  sql(migration);
  assert.deepEqual(json('select last_run_at,last_success_at,last_processed_count,last_late_processed_at,last_late_processed_count from moderation.cleanup_health where singleton'),
    { last_run_at: null,last_success_at: null,last_processed_count: 0,last_late_processed_at: null,last_late_processed_count: 0 });
  assert.equal(sql('select count(*) from moderation.cleanup_health'), '1');
  assert.equal(sql('select reporting_enabled from report_retention.admission_state where singleton'), 'f');
  assert.equal(sql('select status||\':\'||(launched_at is null) from gridly_control.prelaunch_reset_authorization where singleton'), guardBefore);
  assert.equal(sql('select count(*) from cron.job'), '2');
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'), '16');
  const definition = sql("select md5(pg_get_functiondef('moderation.run_compliance_cleanup()'::regprocedure))");
  sql(`insert into supabase_migrations.schema_migrations(version) values ('20260926021558')`);
  sql(migration, { fail: true });
  assert.equal(sql("select md5(pg_get_functiondef('moderation.run_compliance_cleanup()'::regprocedure))"), definition,
    'reapply fails closed without changing the installed function');
  assert.equal(sql('select count(*) from moderation.cleanup_health'), '1');
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'), '17');
});

test('zero-row cleanup writes a fresh bounded success heartbeat', () => {
  assert.equal(sql('select moderation.run_compliance_cleanup()'), '0');
  const h = json('select last_run_at is not null as ran,last_success_at is not null as succeeded,last_processed_count,last_late_processed_count from moderation.cleanup_health');
  assert.deepEqual(h, { ran: true,succeeded: true,last_processed_count: 0,last_late_processed_count: 0 });
  assert.equal(sql('select reporting_enabled from report_retention.admission_state where singleton'), 'f');
});

test('nonzero cleanup retains all six predicates and records only bounded aggregates', () => {
  sql(`insert into moderation.complaints(operation_digest,target_report_digest,reason,reporter_device_digest,retain_until)
        values (extensions.digest('lp58-complaint','sha256'),extensions.digest('lp58-report','sha256'),
          'other',extensions.digest('lp58-device','sha256'),clock_timestamp()-interval '32 days');
    insert into moderation.action_log(target_report_digest,action,outcome,retain_until)
        values (extensions.digest('lp58-report','sha256'),'no_action','test',clock_timestamp()-interval '1 day');
    insert into moderation.source_suppressions(device_digest,expires_at,reason)
        values (extensions.digest('lp58-suppression','sha256'),clock_timestamp()-interval '1 day','test');
    insert into privacy_ops.deletion_requests(operation_digest,target_report_digest,requester_device_digest,retain_until)
        values (extensions.digest('lp58-request','sha256'),extensions.digest('lp58-report','sha256'),
          extensions.digest('lp58-device-2','sha256'),clock_timestamp()-interval '1 day');`);
  assert.equal(sql('select moderation.run_compliance_cleanup()'), '6');
  assert.deepEqual(json('select last_processed_count,last_late_processed_count,last_late_processed_at is not null as late_at from moderation.cleanup_health'),
    { last_processed_count: 6,last_late_processed_count: 6,late_at: true });
  assert.equal(sql(`select (select count(*) from moderation.source_suppressions)
    +(select count(*) from moderation.complaints)
    +(select count(*) from moderation.action_log)
    +(select count(*) from privacy_ops.deletion_requests)`), '0');
});

test('unexpired work and the complaint 31-day row window remain intact', () => {
  const heartbeat = sql('select last_success_at::text from moderation.cleanup_health');
  const result = sql(`begin;
    insert into moderation.source_suppressions(device_digest,expires_at,reason)
      values(extensions.digest('lp58-future-suppression','sha256'),clock_timestamp()+interval '1 day','test');
    insert into moderation.action_log(target_report_digest,action,outcome,retain_until)
      values(extensions.digest('lp58-future-action','sha256'),'no_action','test',clock_timestamp()+interval '1 day');
    insert into privacy_ops.deletion_requests(operation_digest,target_report_digest,requester_device_digest,retain_until)
      values(extensions.digest('lp58-future-request','sha256'),extensions.digest('lp58-future-report','sha256'),
        extensions.digest('lp58-future-device','sha256'),clock_timestamp()+interval '1 day');
    insert into moderation.complaints(operation_digest,target_report_digest,reason,reporter_device_digest,retain_until)
      values(extensions.digest('lp58-recent-complaint','sha256'),extensions.digest('lp58-recent-report','sha256'),
        'other',extensions.digest('lp58-recent-device','sha256'),clock_timestamp()-interval '1 day');
    select moderation.run_compliance_cleanup();
    select json_build_object('suppressions',(select count(*) from moderation.source_suppressions),
      'actions',(select count(*) from moderation.action_log),
      'requests',(select count(*) from privacy_ops.deletion_requests),
      'complaints',(select count(*) from moderation.complaints),
      'scrubbed',(select reporter_device_digest is null from moderation.complaints),
      'future_link_retained',(select requester_device_digest is not null from privacy_ops.deletion_requests));
    rollback;`).split(/\r?\n/);
  assert.equal(result[0], '1');
  assert.deepEqual(JSON.parse(result[1]), {suppressions:1,actions:1,requests:1,complaints:1,scrubbed:true,future_link_retained:true});
  assert.equal(sql('select last_success_at::text from moderation.cleanup_health'), heartbeat,
    'outer rollback also rolls back the health success written in that transaction');
});

test('cleanup DML failure rolls back prior deletes and leaves health unchanged', () => {
  const heartbeat = sql('select last_success_at::text from moderation.cleanup_health');
  sql(`insert into moderation.source_suppressions(device_digest,expires_at,reason)
      values (extensions.digest('lp58-rollback','sha256'),clock_timestamp()-interval '1 day','test');
    insert into privacy_ops.deletion_requests(operation_digest,target_report_digest,retain_until)
      values (extensions.digest('lp58-fail-request','sha256'),extensions.digest('lp58-fail-report','sha256'),
        clock_timestamp()-interval '1 day');
    create function public.lp24458_reject_delete() returns trigger language plpgsql as
      $$ begin raise exception 'synthetic local cleanup failure'; end $$;
    create trigger lp24458_reject_delete before delete on privacy_ops.deletion_requests
      for each row execute function public.lp24458_reject_delete();`);
  sql('select moderation.run_compliance_cleanup()', { fail: true });
  assert.equal(sql('select count(*) from moderation.source_suppressions'), '1');
  assert.equal(sql('select last_success_at::text from moderation.cleanup_health'), heartbeat);
  sql(`insert into cron.job_run_details(jobid,status,start_time,end_time)
      values (2,'failed',clock_timestamp(),clock_timestamp())`);
  assert.equal(healthRows().find(x => x.subsystem === 'compliance_cleanup').latest_run_state, 'failed');
  sql('drop trigger lp24458_reject_delete on privacy_ops.deletion_requests; drop function public.lp24458_reject_delete()');
  assert.equal(sql('select moderation.run_compliance_cleanup()'), '2');
});

test('health-write failure preserves cleanup but cannot claim a new heartbeat', () => {
  sql(`update moderation.cleanup_health set last_run_at=clock_timestamp()-interval '10 minutes',
      last_success_at=clock_timestamp()-interval '10 minutes' where singleton;
    insert into moderation.source_suppressions(device_digest,expires_at,reason)
      values (extensions.digest('lp58-health-write','sha256'),clock_timestamp()-interval '1 day','test');
    create function public.lp24458_reject_health() returns trigger language plpgsql as
      $$ begin raise exception 'synthetic local health write failure'; end $$;
    create trigger lp24458_reject_health before update on moderation.cleanup_health
      for each row execute function public.lp24458_reject_health();`);
  assert.equal(sql('select moderation.run_compliance_cleanup()'), '1');
  assert.equal(sql('select count(*) from moderation.source_suppressions'), '0');
  assert.equal(sql("select last_success_at < clock_timestamp()-interval '9 minutes' from moderation.cleanup_health"), 't');
  sql('drop trigger lp24458_reject_health on moderation.cleanup_health; drop function public.lp24458_reject_health()');
  sql('delete from moderation.cleanup_health');
  assert.equal(sql('select moderation.run_compliance_cleanup()'), '0');
  assert.equal(healthRows().find(x => x.subsystem === 'compliance_cleanup').compliance_health_state, 'missing');
});

test('RPC is two safe rows, zero compliance source scans, and exact EXECUTE ACL', () => {
  const rows = healthRows();
  assert.deepEqual(rows.map(x => x.subsystem), ['compliance_cleanup','report_retention']);
  const keys = Object.keys(rows[0]).sort();
  assert.deepEqual(keys, ['subsystem','job_state','latest_run_state','latest_run_at','last_success_at',
    'retention_state','compliance_health_state','report_overdue_count','report_breached_count',
    'compliance_late_processed_count','compliance_late_processed_at'].sort());
  for (const row of rows) {
    for (const field of ['report_overdue_count','report_breached_count','compliance_late_processed_count']) {
      assert.ok(Number.isInteger(row[field]) && row[field] >= 0 && row[field] <= 1_000_000);
    }
  }
  const rpcDefinition = sql("select pg_get_functiondef('public.gridly_cleanup_alert_health()'::regprocedure)");
  assert.doesNotMatch(rpcDefinition,/moderation\.source_suppressions|moderation\.complaints|moderation\.action_log|privacy_ops\.deletion_requests/i);
  assert.doesNotMatch(rpcDefinition,/job_run_details\.(return_message|message)|\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
  assert.equal(sql("select (proowner='postgres'::regrole)::text||':'||prosecdef::text||':'||provolatile::text from pg_proc where oid='public.gridly_cleanup_alert_health()'::regprocedure"), 'true:true:s');
  assert.equal(sql("select count(*) from aclexplode((select proacl from pg_proc where oid='public.gridly_cleanup_alert_health()'::regprocedure)) where privilege_type='EXECUTE' and grantee not in ('postgres'::regrole::oid,'service_role'::regrole::oid)"), '0');
  for (const role of ['anon','authenticated']) {
    assert.equal(sql(`select has_function_privilege('${role}','public.gridly_cleanup_alert_health()','EXECUTE')`), 'f');
    sql(`set role ${role}; select * from public.gridly_cleanup_alert_health()`, { fail: true });
    assert.equal(sql(`select has_table_privilege('${role}','moderation.cleanup_health','SELECT')`), 'f');
  }
  assert.equal(sql("select has_function_privilege('service_role','public.gridly_cleanup_alert_health()','EXECUTE')"), 't');
  assert.equal(sql("select has_table_privilege('service_role','moderation.cleanup_health','SELECT')"), 'f');
  assert.equal(sql("select count(*) from aclexplode((select proacl from pg_proc where oid='public.gridly_cleanup_alert_health()'::regprocedure)) where privilege_type='EXECUTE' and grantee='service_role'::regrole::oid and not is_grantable"), '1');
  assert.equal(sql('select count(*) from cron.job'), '2');
  assert.equal(sql('select reporting_enabled from report_retention.admission_state where singleton'), 'f');
});

test('bounded health constraints and ACL postcheck reject broadened authority', () => {
  sql('insert into moderation.cleanup_health(singleton) values(true)');
  for (const value of [-1, 1000001]) {
    sql(`update moderation.cleanup_health set last_processed_count=${value}`, { fail: true });
    sql(`update moderation.cleanup_health set last_late_processed_count=${value},last_late_processed_at=clock_timestamp()`, { fail: true });
  }
  sql('update moderation.cleanup_health set last_late_processed_count=1000000,last_late_processed_at=clock_timestamp()');
  assert.equal(healthRows().find(x => x.subsystem==='compliance_cleanup').compliance_late_processed_count, 1000000);
  const postcheck = migration.match(/DO \$post\$[\s\S]*?END \$post\$;/)[0];
  sql(postcheck);
  sql('grant execute on function public.gridly_cleanup_alert_health() to public');
  sql(postcheck, { fail: true });
  sql('revoke execute on function public.gridly_cleanup_alert_health() from public');
  sql('create role lp24458_unexpected');
  try {
    sql('grant execute on function public.gridly_cleanup_alert_health() to lp24458_unexpected');
    sql(postcheck, { fail: true });
    sql('revoke execute on function public.gridly_cleanup_alert_health() from lp24458_unexpected');
    sql('grant service_role to lp24458_unexpected');
    sql(postcheck, { fail: true });
    sql('revoke service_role from lp24458_unexpected');
  } finally { sql('drop role lp24458_unexpected'); }
  sql('grant execute on function public.gridly_cleanup_alert_health() to service_role with grant option');
  sql(postcheck, { fail: true });
  sql('revoke grant option for execute on function public.gridly_cleanup_alert_health() from service_role');
  sql(postcheck);
  assert.equal(sql('set role service_role; select count(*) from public.gridly_cleanup_alert_health()'), '2');
  assert.doesNotMatch(migration, /create\s+index|cron\.(schedule|alter_job|unschedule)|reporting_enabled\s*=\s*true/i);
});
