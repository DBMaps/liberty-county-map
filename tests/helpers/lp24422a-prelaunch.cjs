const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

const ROOT = path.resolve(__dirname, '../..');
const AUTHORIZATION_PATH = path.join(ROOT, 'supabase/retention/authorize-prelaunch-community-reset.sql');
const ATOMIC_MIGRATION_PATH = path.join(ROOT, 'supabase/migrations/20260908200554_lp24422a_prelaunch_reset_and_atomic_report_transition.sql');
const RELEASE_PATH = path.join(ROOT, 'supabase/retention/release-community-reporting.sql');
const RECONCILIATION_PLAN_PATH = path.join(ROOT, 'supabase/migration-reconciliation/lp24422a-production-plan.json');
const MIGRATION_DIRECTORY = path.join(ROOT, 'supabase/migrations');
const SUPERSEDED_MIGRATIONS = [
  path.join(ROOT, 'supabase/migrations/202609080001_community_report_retention.sql'),
  path.join(ROOT, 'supabase/migrations/202609080002_community_submission_protocol.sql')
];
const FINAL_MIGRATIONS = Object.freeze([
  '202609080001_community_report_retention.sql',
  '202609080002_community_submission_protocol.sql',
  '20260908200554_lp24422a_prelaunch_reset_and_atomic_report_transition.sql'
]);

const BASELINE_EXPECTED = Object.freeze({
  project_ref: 'nhwhkbkludzkuyxmkkcj',
  owner_authorization_id: '2442200a-0000-4000-8000-000000000001',
  expected_reports: 7,
  expected_device_reports: 7,
  expected_synthetic_reports: 1,
  expected_embedded_device_reports: 1,
  expected_cleared_reports: 0,
  expected_historical_events: 1,
  expected_historical_clears: 0,
  expected_writer_events: 1,
  expected_retention_runs: 1
});
const PRODUCTION_EXPECTED = Object.freeze({
  project_ref: 'nhwhkbkludzkuyxmkkcj',
  expected_reports: 510,
  expected_device_reports: 510,
  expected_synthetic_reports: 321,
  expected_embedded_device_reports: 321,
  expected_cleared_reports: 195,
  expected_historical_events: 355,
  expected_historical_clears: 138,
  expected_writer_events: 0,
  expected_retention_runs: 0
});

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function renderAuthorization(values = {}) {
  const resolved = {...BASELINE_EXPECTED, ...values};
  const source = fs.readFileSync(AUTHORIZATION_PATH, 'utf8').replaceAll('\r\n', '\n');
  const kept = [];
  let skipping = false;
  for (const line of source.split('\n')) {
    if (line.startsWith('\\set ')) continue;
    if (line.startsWith('\\if ')) { skipping = true; continue; }
    if (skipping && line.startsWith('\\endif')) { skipping = false; continue; }
    if (!skipping) kept.push(line);
  }
  if (skipping) throw new Error('Unclosed psql conditional in authorization script');
  return kept.join('\n').replace(/:'([a-z_]+)'/g, (_, name) => {
    if (!(name in resolved)) throw new Error(`Missing authorization value: ${name}`);
    return quote(resolved[name]);
  });
}

function migrationSql() {
  return fs.readFileSync(ATOMIC_MIGRATION_PATH, 'utf8');
}

// Prepared only: owner supplies the failed UUID privately as a session setting.
// No UUID is printed or embedded in the repository-owned disarm payload.
function renderRevocation(values = PRODUCTION_EXPECTED) {
  const source = renderAuthorization(values);
  const prefix = source.slice(0, source.indexOf('insert into gridly_control.prelaunch_reset_authorization ('));
  return `${prefix}
do $$ declare a gridly_control.prelaunch_reset_authorization%rowtype; begin
  select * into strict a from gridly_control.prelaunch_reset_authorization where singleton for update;
  if a.status<>'authorized' or a.consumed_at is not null or a.launched_at is not null
    or a.owner_authorization_id::text is distinct from current_setting('gridly.failed_authorization_id',true)
    or a.project_ref<>${quote(values.project_ref)} or a.migration_id<>'20260908200554'
    or to_regnamespace('report_retention') is not null
    or (select count(*) from public.reports)<>${Number(values.expected_reports)}
    or (select count(*) from history_capture.historical_events)<>${Number(values.expected_historical_events)}
    or a.expected_reports<>${Number(values.expected_reports)}
    or a.expected_historical_events<>${Number(values.expected_historical_events)} then
    raise exception using errcode='55000',message='Failed deployment identity or baseline mismatch';
  end if;
  update gridly_control.prelaunch_reset_authorization set status='revoked' where singleton;
end $$;
commit;`;
}

function supersededMigrationSql() {
  return SUPERSEDED_MIGRATIONS.map((file) => fs.readFileSync(file, 'utf8'));
}

function stripOuterTransaction(source, file) {
  const normalized = source.replaceAll('\r\n', '\n');
  const begins = [...normalized.matchAll(/^begin;[ \t]*$/gmi)];
  const commits = [...normalized.matchAll(/^commit;[ \t]*$/gmi)];
  if (begins.length === 0 && commits.length === 0) return normalized;
  if (begins.length !== 1 || commits.length !== 1 || commits[0].index < begins[0].index) {
    throw new Error(`Expected one outer transaction in ${file}`);
  }
  return normalized
    .slice(0, begins[0].index)
    .concat(normalized.slice(begins[0].index + begins[0][0].length, commits[0].index))
    .concat(normalized.slice(commits[0].index + commits[0][0].length));
}

function migrationRecordSql(version, file) {
  const name = path.basename(file, '.sql').replace(`${version}_`, '');
  return `insert into supabase_migrations.schema_migrations(version,name,statements) values (${quote(version)},${quote(name)},array[]::text[]);`;
}

function productionExecutionPlan() {
  return JSON.parse(fs.readFileSync(RECONCILIATION_PLAN_PATH, 'utf8'));
}

function assembleProductionBatch(values = {}) {
  if (!values.owner_authorization_id) {
    throw new Error('A fresh owner_authorization_id is required for production batch assembly');
  }
  if (!['bootstrap-and-transition', 'already-armed-transition'].includes(values.mode)) {
    throw new Error('Select exactly one explicit production batch mode');
  }
  if (typeof values.owner_authorization_id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(values.owner_authorization_id)) {
    throw new Error('A valid private owner authorization UUID is required');
  }
  const alreadyArmed = values.mode === 'already-armed-transition';
  if (alreadyArmed && Object.entries(PRODUCTION_EXPECTED).some(([key, value]) =>
    values[key] !== undefined && values[key] !== value)) {
    throw new Error('Already-armed mode requires the certified production fingerprint');
  }
  const authorizationValues = {...PRODUCTION_EXPECTED, ...values};
  const plan = productionExecutionPlan();
  const markApplied = plan.proposedRepair.markApplied;
  const executable = [
    ...plan.proposedRepair.mustExecuteSeparatelyBeforeReportTransition,
    '202609080001',
    '202609080002',
    '20260908200554'
  ];
  if (markApplied.length !== 7 || executable.length !== 6) {
    throw new Error('Production execution plan must contain seven reconciliation and six execution versions');
  }
  const planFiles = new Map(plan.migrations.map((migration) => [migration.id, migration.file]));
  for (const file of FINAL_MIGRATIONS) planFiles.set(file.split('_', 1)[0], file);
  const chunks = [
    ...(!alreadyArmed ? [renderAuthorization(authorizationValues)] : []),
    'begin;',
    `do $$
begin
  if session_user <> 'postgres' then
    raise exception using errcode='42501', message='Migration reconciliation requires the postgres owner session';
  end if;
  if (select coalesce(array_agg(version::text order by version::text),array[]::text[])
      from supabase_migrations.schema_migrations)
     is distinct from array['202607280100']::text[] then
    raise exception using errcode='55000', message='Migration history changed after Gate 1';
  end if;
end $$;`
  ];
  if (alreadyArmed) {
    // Bind in memory using PostgreSQL uuid_send's 16-byte representation.
    // Never put the full UUID in the returned SQL, logs, files, or errors.
    const digest = createHash('sha256').update(Buffer.from(
      values.owner_authorization_id.replaceAll('-', ''), 'hex')).digest('hex');
    chunks.splice(1, 0, `set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path = pg_catalog;
select pg_advisory_xact_lock(24422, 1);
lock table public.reports, history_capture.historical_events,
  history_capture.writer_monitoring_events, history_capture.retention_runs
  in access exclusive mode;
lock table public.gridly_feedback, public.gridly_geocode_cache,
  public.gridly_geocode_provider_state in share mode;
do $$ declare a gridly_control.prelaunch_reset_authorization%rowtype; begin
  if session_user <> 'postgres' then
    raise exception using errcode='42501',message='Already-armed transition requires the postgres owner session';
  end if;
  select * into strict a from gridly_control.prelaunch_reset_authorization for update;
  if not a.singleton or a.status <> 'authorized'
    or a.consumed_at is not null or a.launched_at is not null
    or a.authorized_at is null
    or a.migration_id <> '20260908200554' or a.project_ref <> 'nhwhkbkludzkuyxmkkcj'
    or sha256(uuid_send(a.owner_authorization_id)) <> decode('${digest}','hex')
    or row(a.expected_reports,a.expected_device_reports,a.expected_synthetic_reports,
      a.expected_embedded_device_reports,a.expected_cleared_reports,
      a.expected_historical_events,a.expected_historical_clears,
      a.expected_writer_events,a.expected_retention_runs)
      is distinct from row(510::bigint,510::bigint,321::bigint,321::bigint,195::bigint,
        355::bigint,138::bigint,0::bigint,0::bigint) then
    raise exception using errcode='55000',message='Already-armed authorization identity, state or fingerprint mismatch';
  end if;
end $$;
${protectedCountsGuard()}`);
  }
  for (const version of markApplied) {
    const file = planFiles.get(version);
    if (!file) throw new Error(`Missing reconciliation file for ${version}`);
    chunks.push(migrationRecordSql(version, file));
  }
  for (const version of executable) {
    const file = planFiles.get(version);
    if (!file) throw new Error(`Missing executable migration file for ${version}`);
    const source = fs.readFileSync(path.join(MIGRATION_DIRECTORY, file), 'utf8');
    chunks.push(stripOuterTransaction(source, file));
    chunks.push(migrationRecordSql(version, file));
  }
  if (alreadyArmed) chunks.push(protectedCountsGuard());
  chunks.push('commit;');
  return chunks.join('\n\n');
}

function protectedCountsGuard() {
  return `do $$ begin
  if row((select count(*) from public.gridly_feedback),
    (select count(*) from public.gridly_geocode_cache),
    (select count(*) from public.gridly_geocode_provider_state))
    is distinct from row(7::bigint,480::bigint,2::bigint) then
    raise exception using errcode='55000',message='Protected production counts changed';
  end if;
end $$;`;
}

function renderRelease(values = {}) {
  const resolved = {...BASELINE_EXPECTED, ...values};
  const source = fs.readFileSync(RELEASE_PATH, 'utf8').replaceAll('\r\n', '\n');
  const kept = [];
  let skipping = false;
  for (const line of source.split('\n')) {
    if (line.startsWith('\\set ')) continue;
    if (line.startsWith('\\if ')) { skipping = true; continue; }
    if (skipping && line.startsWith('\\endif')) { skipping = false; continue; }
    if (!skipping) kept.push(line);
  }
  if (skipping) throw new Error('Unclosed psql conditional in release script');
  return kept.join('\n').replace(/:'([a-z_]+)'/g, (_, name) => {
    if (!(name in resolved)) throw new Error(`Missing release value: ${name}`);
    return quote(resolved[name]);
  });
}

module.exports = {
  AUTHORIZATION_PATH,
  ATOMIC_MIGRATION_PATH,
  BASELINE_EXPECTED,
  PRODUCTION_EXPECTED,
  RECONCILIATION_PLAN_PATH,
  assembleProductionBatch,
  migrationSql,
  productionExecutionPlan,
  renderAuthorization,
  renderRevocation,
  renderRelease,
  stripOuterTransaction,
  supersededMigrationSql
};
