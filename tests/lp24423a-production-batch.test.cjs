const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {createHash, randomUUID} = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const Module = require('node:module');
const {
  PRODUCTION_EXPECTED,
  assembleProductionBatch,
  productionExecutionPlan,
  renderAuthorization
} = require('./helpers/lp24422a-prelaunch.cjs');

const ROOT = path.resolve(__dirname, '..');
const PSQL = process.env.GRIDLY_TEST_PSQL || 'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const PORT = 55441;
const ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)));
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures/lp24421-baseline.sql'), 'utf8');
const FEEDBACK_MIGRATION = fs.readFileSync(path.join(ROOT, 'supabase/migrations/202606070001_create_gridly_feedback.sql'), 'utf8');
const GEOCODE_MIGRATION = fs.readFileSync(path.join(ROOT, 'supabase/migrations/202607280100_lp100_geocoding_governance.sql'), 'utf8');
const WRITER_EVALUATOR = fs.readFileSync(path.join(ROOT, 'supabase/retention/evaluate-community-writer-transition.sql'), 'utf8');

function psql(query, database = 'postgres', {fail = false} = {}) {
  const result = spawnSync(PSQL, [
    '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
    '-h', '127.0.0.1', '-p', String(PORT), '-U', 'postgres', '-d', database
  ], {input: query, encoding: 'utf8', env: ENV, windowsHide: true, timeout: 60000});
  if (fail) assert.notEqual(result.status, 0, 'statement must fail closed');
  else assert.equal(result.status, 0, result.error?.message || result.stderr);
  return {stdout: result.stdout.trim(), stderr: result.stderr.trim()};
}

function parseError(payload) {
  const fields = {};
  let offset = 0;
  while (offset < payload.length && payload[offset] !== 0) {
    const code = String.fromCharCode(payload[offset++]);
    const end = payload.indexOf(0, offset);
    fields[code] = payload.subarray(offset, end).toString('utf8');
    offset = end + 1;
  }
  return fields;
}

function simpleQuery(query, database) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({host: '127.0.0.1', port: PORT});
    let buffer = Buffer.alloc(0);
    let querySent = false;
    let settled = false;
    const errors = [];
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error); else resolve(result);
    };
    socket.setTimeout(120000, () => finish(new Error('PostgreSQL simple-query timeout')));
    socket.on('error', (error) => finish(error));
    socket.on('connect', () => {
      const parameters = Buffer.from(`user\0postgres\0database\0${database}\0client_encoding\0UTF8\0\0`, 'utf8');
      const startup = Buffer.alloc(8 + parameters.length);
      startup.writeInt32BE(startup.length, 0);
      startup.writeInt32BE(196608, 4);
      parameters.copy(startup, 8);
      socket.write(startup);
    });
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 5) {
        const type = String.fromCharCode(buffer[0]);
        const length = buffer.readInt32BE(1);
        if (buffer.length < length + 1) break;
        const payload = buffer.subarray(5, length + 1);
        buffer = buffer.subarray(length + 1);
        if (type === 'R') {
          const authentication = payload.readInt32BE(0);
          if (authentication !== 0) finish(new Error(`Unsupported PostgreSQL authentication method ${authentication}`));
        } else if (type === 'E') {
          errors.push(parseError(payload));
        } else if (type === 'Z') {
          if (!querySent) {
            querySent = true;
            const sql = Buffer.from(`${query}\0`, 'utf8');
            const message = Buffer.alloc(5 + sql.length);
            message.write('Q', 0, 1, 'ascii');
            message.writeInt32BE(4 + sql.length, 1);
            sql.copy(message, 5);
            socket.write(message);
          } else {
            finish(null, {ok: errors.length === 0, errors});
          }
        }
      }
    });
  });
}

function databaseName(label) {
  return `gridly_lp24423a_${label}_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
}

function setupBaseline(database) {
  psql(`create database ${database}`);
  psql(FIXTURE, database);
  psql('create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions', database);
  psql(FEEDBACK_MIGRATION, database);
  psql(GEOCODE_MIGRATION, database);
  psql(`
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(
      version text primary key,
      statements text[],
      name text
    );
    insert into supabase_migrations.schema_migrations(version,name,statements)
      values ('202607280100','lp100_geocoding_governance',array[]::text[]);
    insert into public.gridly_feedback(category,message)
      select 'fixture','fixture' from generate_series(1,7);
    insert into public.gridly_geocode_cache(cache_key,provider_namespace,response,status,expires_at)
      select encode(extensions.digest(value::text,'sha256'),'hex'),'fixture','{}','ok',now()+interval '1 day'
      from generate_series(1,480) as values(value);
    insert into public.gridly_geocode_provider_state(provider_namespace)
      values ('fixture-a'),('fixture-b');
    create function public.rls_auto_enable() returns event_trigger
      language plpgsql security definer set search_path=pg_catalog as $$ begin null; end $$;
    grant execute on function public.rls_auto_enable() to public,anon,authenticated;
    create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();
    truncate table public.reports;
    insert into public.reports(
      crossing_id,crossing_name,lat,lng,report_type,severity,device_id,created_at
    )
    select
      case
        when fixture_id <= 195 then 'hazard-cleared-device-'||fixture_id||'-'||(1788888888888+fixture_id)
        when fixture_id <= 321 then 'hazard-device-'||fixture_id||'-'||(1788888888888+fixture_id)
        else 'DOT-'||fixture_id
      end,
      'Crossing',30,-95,
      case when fixture_id <= 195 then 'hazard_cleared' else 'blocked' end,
      'high','device-'||fixture_id,now()-make_interval(days => fixture_id % 100)
    from generate_series(1,510) as fixtures(fixture_id);
    truncate table history_capture.historical_events;
    insert into history_capture.historical_events(event_type,source_report_id,envelope)
    select case when fixture_id <= 138 then 'report_cleared' else 'report_created' end,
      'fixture-'||fixture_id,'{}'::jsonb
    from generate_series(1,355) as fixtures(fixture_id);
    truncate table history_capture.writer_monitoring_events;
    truncate table history_capture.retention_runs;
  `, database);
}

function dropDatabase(database) {
  psql(`drop database if exists ${database} with(force)`);
  psql('drop role if exists gridly_retention_monitor');
}

function authorization() {
  return {...PRODUCTION_EXPECTED, owner_authorization_id: randomUUID(), mode: 'bootstrap-and-transition'};
}

function writerState(database) {
  return JSON.parse(psql(WRITER_EVALUATOR, database).stdout);
}

function armWithLedger(database, values) {
  psql(renderAuthorization({...values, owner_authorization_id:randomUUID()}), database);
  psql("update gridly_control.prelaunch_reset_authorization set status='revoked'", database);
  psql(renderAuthorization(values), database);
  assert.equal(psql('select count(*) from gridly_control.reset_revocations', database).stdout, '1');
}

function ledgerSnapshot(database, mode) {
  return mode === 'already-armed-transition'
    ? psql('select md5(json_agg(r order by revoked_at)::text) from gridly_control.reset_revocations r', database).stdout
    : '';
}

function baselineSnapshot(database) {
  return psql(`select json_build_object(
    'counts', array[(select count(*) from reports),(select count(*) from history_capture.historical_events),
      (select count(*) from history_capture.writer_monitoring_events),(select count(*) from history_capture.retention_runs),
      (select count(*) from gridly_feedback),(select count(*) from gridly_geocode_cache),(select count(*) from gridly_geocode_provider_state)],
    'authorization',(select md5(coalesce(json_agg(a)::text,'[]')) from gridly_control.prelaunch_reset_authorization a),
    'ledger',(select md5(coalesce(json_agg(r order by revoked_at)::text,'[]')) from gridly_control.reset_revocations r),
    'migrations',(select json_agg(m order by version) from supabase_migrations.schema_migrations m),
    'schemas',(select json_agg(nspname order by nspname) from pg_namespace),
    'relations',(select json_agg(row(relname,relnamespace,relkind,relrowsecurity,relacl) order by oid) from pg_class),
    'functions',(select json_agg(row(proname,pronamespace,prosrc,proacl) order by oid) from pg_proc),
    'triggers',(select json_agg(row(tgname,tgenabled) order by oid) from pg_trigger),
    'cron_absent',not exists(select 1 from pg_extension where extname='pg_cron') and to_regclass('cron.job') is null,
    'monitor_absent',not exists(select 1 from pg_roles where rolname='gridly_retention_monitor')
  )`, database).stdout;
}

test('mode selection is explicit, exclusive and validates identity without disclosing it', () => {
  const values = authorization();
  for (const mode of [undefined, null, '', 'auto', true, ['bootstrap-and-transition','already-armed-transition']]) {
    assert.throws(() => assembleProductionBatch({...values, mode}), /exactly one explicit/);
  }
  for (const id of ['', 'invalid', "' OR true --", {}, 1]) {
    assert.throws(() => assembleProductionBatch({...values, owner_authorization_id: id}));
  }
  assert.throws(() => assembleProductionBatch({...values, mode:'already-armed-transition', expected_reports:1}), /certified production/);
});

test('armed payload omits bootstrap, binds only a digest, and preserves every original transition statement', () => {
  const values = authorization();
  const bootstrap = renderAuthorization(values);
  const legacy = assembleProductionBatch(values);
  const helperPath = path.join(ROOT, 'tests/helpers/lp24422a-prelaunch.cjs');
  const committed = spawnSync('git', ['show', 'a1030be1e0541cd85de03cb0df07f57350d8ea66:tests/helpers/lp24422a-prelaunch.cjs'],
    {encoding:'utf8', windowsHide:true});
  assert.equal(committed.status, 0);
  const original = new Module(helperPath, module);
  original._compile(committed.stdout, helperPath);
  assert.equal(legacy, original.exports.assembleProductionBatch(values), 'explicit bootstrap mode preserves certified payload byte for byte');
  const armed = assembleProductionBatch({...values, mode:'already-armed-transition'});
  assert.ok(legacy.startsWith(bootstrap + '\n\nbegin;'));
  assert.ok(armed.startsWith('begin;'));
  assert.ok(!armed.includes(values.owner_authorization_id));
  assert.doesNotMatch(armed, /create schema if not exists gridly_control|insert into gridly_control.prelaunch_reset_authorization|create or replace function gridly_control.guard_prelaunch/);
  assert.doesNotMatch(armed, /^\s*\\/m);
  assert.doesNotMatch(armed, /create extension[^;]*pg_cron|cron\.schedule/i);
  assert.equal([...armed.matchAll(/^begin;$/gm)].length, 1);
  assert.equal([...armed.matchAll(/^commit;$/gm)].length, 1);
  const start = 'do $$\nbegin\n  if session_user';
  const originalCore = legacy.slice(bootstrap.length + 2).slice('begin;\n\n'.length, -'\n\ncommit;'.length);
  assert.ok(armed.includes(originalCore), 'certified reconciliation and six migrations are contiguous and byte-identical');
  assert.ok(armed.indexOf(start) > armed.indexOf('Already-armed authorization'));
});

test('already-armed transition binds the supplied UUID (omission alone failed this test)', async () => {
  const database = databaseName('identity_evidence');
  setupBaseline(database);
  try {
    const armed = authorization();
    psql(renderAuthorization(armed), database);
    const wrong = authorization();
    const before = baselineSnapshot(database);
    const result = await simpleQuery(assembleProductionBatch({...wrong, mode: 'already-armed-transition'}), database);
    assert.equal(result.ok, false, 'wrong UUID must fail before consuming the armed authorization');
    assert.deepEqual(baselineSnapshot(database), before);
  } finally { dropDatabase(database); }
});

test('assembled production payload is sourced from the committed seven-plus-six execution plan', () => {
  const plan = productionExecutionPlan();
  const batch = assembleProductionBatch(authorization());
  const productionBatch = assembleProductionBatch({owner_authorization_id: randomUUID(), mode: 'bootstrap-and-transition'});
  const texasMigrationPath = path.join(ROOT, 'supabase/migrations/202607290200_lp1041_texas_address_foundation.sql');
  const texasMigration = fs.readFileSync(texasMigrationPath);
  const texasPlan = plan.migrations.find((migration) => migration.id === '202607290200');
  const geocodeConsumer = fs.readFileSync(path.join(ROOT, 'supabase/functions/gridly-geocode/index.ts'), 'utf8');
  assert.equal(plan.proposedRepair.markApplied.length, 7);
  assert.throws(() => assembleProductionBatch(), /fresh owner_authorization_id/);
  assert.match(productionBatch, /true, '20260908200554', 'nhwhkbkludzkuyxmkkcj'/);
  assert.match(productionBatch, /'510'::bigint, '510'::bigint/);
  assert.match(productionBatch, /Migration history changed after Gate 1/);
  assert.deepEqual(plan.proposedRepair.mustExecuteSeparatelyBeforeReportTransition, [
    '202606110001', '202607290100', '202607290200'
  ]);
  const versions = [...batch.matchAll(/schema_migrations\(version,name,statements\) values \('([0-9]+)'/g)].map((match) => match[1]);
  assert.deepEqual(versions, [
    '202606070001', '202606160001', '202606160002', '202606170410',
    '202606170411', '202606170425', '202606170426', '202606110001',
    '202607290100', '202607290200', '202609080001', '202609080002', '20260908200554'
  ]);
  assert.match(batch, /longitude double precision,"precision" text/);
  assert.match(batch, /a\."precision"/);
  const canonicalTexasMigration = texasMigration.toString('utf8').replaceAll('\r\n', '\n');
  assert.equal(createHash('sha256').update(canonicalTexasMigration).digest('hex'), texasPlan.sha256);
  assert.match(geocodeConsumer, /gridly_lookup_texas_address/);
  assert.match(geocodeConsumer, /row\.precision/);
  assert.equal((batch.match(/^begin;$/gmi) || []).length, 2, 'authorization and transition retain two intended transaction boundaries');
  assert.equal((batch.match(/^commit;$/gmi) || []).length, 2, 'authorization and transition retain two intended transaction boundaries');
});

test('the whole payload parses as one PostgreSQL query before any statement executes', async () => {
  const database = databaseName('parse');
  setupBaseline(database);
  try {
    const batch = assembleProductionBatch(authorization());
    const result = await simpleQuery(batch, database);
    const postgisAvailable = psql("select exists(select 1 from pg_available_extensions where name='postgis')", database).stdout === 't';
    if (postgisAvailable) assert.equal(result.ok, true, JSON.stringify(result.errors));
    else {
      assert.equal(result.ok, false);
      assert.equal(result.errors[0]?.C, '0A000');
      assert.match(result.errors[0]?.M || '', /extension "postgis" is not available/);
      assert.doesNotMatch(result.errors[0]?.M || '', /syntax error/i);
    }
  } finally {
    dropDatabase(database);
  }
});

for (const mode of ['bootstrap-and-transition', 'already-armed-transition']) {
test(`${mode}: exact payload transitions data, history, security and admission atomically`, async (t) => {
  const database = databaseName('success');
  setupBaseline(database);
  try {
    if (psql("select exists(select 1 from pg_available_extensions where name='postgis')", database).stdout !== 't') {
      t.skip('PostGIS is not installed in this PostgreSQL 17 runtime');
      return;
    }
    const pre = writerState(database);
    assert.deepEqual(pre, {
      anon_history_insert_authorized: true,
      anon_report_insert_authorized: true,
      post_transition_match: false,
      pre_transition_match: true
    });
    // PG17 managed-owner membership: postgres administers the monitor but
    // cannot inherit or SET it through this automatic membership edge.
    psql(`create role gridly_retention_monitor nologin nosuperuser nocreatedb
      nocreaterole noinherit noreplication nobypassrls connection limit 0;
      grant gridly_retention_monitor to postgres with admin true, inherit false, set false`,database);
    const values = {...authorization(), mode};
    if (mode === 'already-armed-transition') armWithLedger(database, values);
    const ledgerBefore = ledgerSnapshot(database, mode);
    const batch = assembleProductionBatch(values);
    const result = await simpleQuery(batch, database);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(psql(`select row(
      (select count(*) from public.reports),
      (select count(*) from history_capture.historical_events),
      (select count(*) from history_capture.writer_monitoring_events),
      (select count(*) from history_capture.retention_runs),
      (select count(*) from public.gridly_feedback),
      (select count(*) from public.gridly_geocode_cache),
      (select count(*) from public.gridly_geocode_provider_state)
    )::text`, database).stdout, '(0,0,0,0,7,480,2)');
    assert.equal(psql("select count(*) from supabase_migrations.schema_migrations", database).stdout, '14');
    assert.deepEqual(JSON.parse(psql('select json_agg(version order by version) from supabase_migrations.schema_migrations', database).stdout),
      ['202606070001','202606110001','202606160001','202606160002','202606170410','202606170411','202606170425','202606170426',
        '202607280100','202607290100','202607290200','202609080001','202609080002','20260908200554']);
    assert.equal(psql("select count(*) from (select version from supabase_migrations.schema_migrations group by version having count(*)<>1) duplicates", database).stdout, '0');
    assert.equal(psql("select status||':'||(consumed_at is not null) from gridly_control.prelaunch_reset_authorization", database).stdout, 'consumed:true');
    assert.equal(psql("select to_regnamespace('report_retention') is not null", database).stdout, 't');
    assert.equal(psql("select count(*) from pg_proc where oid in (to_regprocedure('public.submit_community_observation(text,jsonb,text)'),to_regprocedure('public.mutate_community_observation(text,uuid,text,jsonb,text)'),to_regprocedure('public.cancel_community_operation(text)'))", database).stdout, '3');
    assert.equal(psql("select 'precision'=any(proargnames) from pg_proc where oid=to_regprocedure('public.gridly_lookup_texas_address(text,text)')", database).stdout, 't');
    assert.equal(psql("select (to_regprocedure('public.rls_auto_enable()') is null) and not exists(select 1 from pg_event_trigger where evtname='ensure_rls')", database).stdout, 't');
    assert.equal(psql("select protocol_version||':'||reporting_enabled from report_retention.admission_state", database).stdout, '2:false');
    assert.equal(psql("select exists(select 1 from pg_extension where extname='pg_cron')", database).stdout, 'f');
    assert.equal(psql("select to_regclass('cron.job') is null", database).stdout, 't');
    if (mode === 'already-armed-transition') assert.equal(ledgerSnapshot(database, mode), ledgerBefore);
    assert.deepEqual(writerState(database), {
      anon_history_insert_authorized: false,
      anon_report_insert_authorized: false,
      post_transition_match: true,
      pre_transition_match: false
    });
    const second = await simpleQuery(batch, database);
    assert.equal(second.ok, false, 'single-use batch must reject re-execution');
    assert.equal(psql("select status from gridly_control.prelaunch_reset_authorization", database).stdout, 'consumed');
  } finally {
    dropDatabase(database);
  }
});
}

for (const scenario of ['revoked', 'consumed', 'launched', 'missing', 'wrong-project',
  'stored-fingerprint', 'current-fingerprint', 'protected-before', 'protected-after', 'mid-error', 'late-error']) {
test(`already-armed ${scenario} fails and rolls back all transition effects`, async () => {
  const database = databaseName('armed_failure');
  setupBaseline(database);
  try {
    const values = {...authorization(), mode:'already-armed-transition'};
    if (scenario === 'missing') {
      const bootstrap = renderAuthorization(values);
      psql(bootstrap.slice(0, bootstrap.indexOf('insert into gridly_control.prelaunch_reset_authorization (')) + 'commit;', database);
    } else {
      armWithLedger(database, {...values,
        ...(scenario === 'stored-fingerprint' ? {expected_reports:511} : {}),
        ...(scenario === 'wrong-project' ? {project_ref:'syntheticfixtureonly'} : {})});
      if (scenario === 'revoked') psql("update gridly_control.prelaunch_reset_authorization set status='revoked'", database);
      if (['consumed','launched'].includes(scenario)) psql("update gridly_control.prelaunch_reset_authorization set status='consumed',consumed_at=clock_timestamp(),deleted_reports=510,deleted_historical_events=355,deleted_writer_events=0,deleted_retention_runs=0", database);
      if (scenario === 'launched') psql("update gridly_control.prelaunch_reset_authorization set status='launched',launched_at=clock_timestamp()", database);
    }
    if (scenario === 'current-fingerprint') psql("update reports set device_id=null where id=(select id from reports limit 1)", database);
    if (scenario === 'protected-before') psql("delete from gridly_feedback where id=(select id from gridly_feedback limit 1)", database);
    const before = baselineSnapshot(database);
    let batch = assembleProductionBatch(values);
    if (['mid-error','late-error','protected-after'].includes(scenario)) {
      const version = scenario === 'mid-error' ? '202607290100' : '20260908200554';
      const marker = `insert into supabase_migrations.schema_migrations(version,name,statements) values ('${version}'`;
      assert.ok(batch.includes(marker));
      batch = batch.replace(marker, (scenario === 'protected-after'
        ? 'delete from public.gridly_feedback where id=(select id from public.gridly_feedback limit 1);'
        : 'select 1/0;') + '\n\n' + marker);
    }
    const result = await simpleQuery(batch, database);
    assert.equal(result.ok, false, scenario);
    assert.equal(result.errors[0]?.C,
      scenario === 'missing' ? 'P0002' : scenario === 'current-fingerprint' ? '22023'
        : ['mid-error','late-error'].includes(scenario) ? '22012' : '55000');
    assert.deepEqual(baselineSnapshot(database), before, 'authorization, ledger, data counts, migrations and schema state must roll back');
  } finally { dropDatabase(database); }
});
}

test('a forced late error rolls back the guarded atomic transition', async (t) => {
  const database = databaseName('rollback');
  setupBaseline(database);
  try {
    if (psql("select exists(select 1 from pg_available_extensions where name='postgis')", database).stdout !== 't') {
      t.skip('PostGIS is not installed in this PostgreSQL 17 runtime');
      return;
    }
    const batch = assembleProductionBatch(authorization());
    const marker = "insert into supabase_migrations.schema_migrations(version,name,statements) values ('20260908200554'";
    const forced = batch.replace(marker, `select 1/0;\n\n${marker}`);
    const result = await simpleQuery(forced, database);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0]?.C, '22012');
    assert.equal(psql("select (select count(*) from reports)||':'||(select count(*) from history_capture.historical_events)||':'||status from gridly_control.prelaunch_reset_authorization", database).stdout, '510:355:authorized');
    assert.deepEqual(JSON.parse(psql("select json_agg(version order by version) from supabase_migrations.schema_migrations", database).stdout), ['202607280100']);
    assert.equal(psql("select to_regnamespace('report_retention') is null", database).stdout, 't');
    assert.equal(psql("select to_regprocedure('public.rls_auto_enable()') is not null", database).stdout, 't');
  } finally {
    dropDatabase(database);
  }
});
