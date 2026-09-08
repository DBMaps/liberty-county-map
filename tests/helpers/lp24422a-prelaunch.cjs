const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const AUTHORIZATION_PATH = path.join(ROOT, 'supabase/retention/authorize-prelaunch-community-reset.sql');
const ATOMIC_MIGRATION_PATH = path.join(ROOT, 'supabase/migrations/20260908200554_lp24422a_prelaunch_reset_and_atomic_report_transition.sql');
const RELEASE_PATH = path.join(ROOT, 'supabase/retention/release-community-reporting.sql');
const SUPERSEDED_MIGRATIONS = [
  path.join(ROOT, 'supabase/migrations/202609080001_community_report_retention.sql'),
  path.join(ROOT, 'supabase/migrations/202609080002_community_submission_protocol.sql')
];

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

function supersededMigrationSql() {
  return SUPERSEDED_MIGRATIONS.map((file) => fs.readFileSync(file, 'utf8'));
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

module.exports = {AUTHORIZATION_PATH, ATOMIC_MIGRATION_PATH, BASELINE_EXPECTED, renderAuthorization, renderRelease, migrationSql, supersededMigrationSql};
