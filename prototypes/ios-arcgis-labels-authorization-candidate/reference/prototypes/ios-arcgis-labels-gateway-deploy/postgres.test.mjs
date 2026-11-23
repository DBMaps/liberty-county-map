import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const { GRIDLY_PILOT_PG_BIN: bin, PGHOST: host, PGPORT: port, PGDATABASE: database, PGUSER: user } = process.env;
const disposable = Boolean(bin && host === '127.0.0.1' && /^\d{4,5}$/.test(port ?? '') &&
  database === 'gridly_labels_edge_test' && user === 'gridly_pilot_test_owner');
const sqlFiles = ['20261113000100_labels_foundation.sql', '20261113000200_labels_edge_state.sql']
  .map(file => fileURLToPath(new URL('./supabase/migrations/' + file, import.meta.url)));
const spki = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey
  .export({ type: 'spki', format: 'der' }).toString('base64url');
const psql = async args => (await exec(join(bin, 'psql.exe'), ['-XqAt', '-w', '-v', 'ON_ERROR_STOP=1', ...args],
  { windowsHide: true, timeout: 20_000 })).stdout.trim();
const query = (sql, role = true) => psql(['-c', (role ? 'set role label_pilot_runtime; ' : '') + sql]);
const stamp = () => Date.now();
const challengeFor = id => query(`select label_pilot.new_challenge('${id}')`);
const issue = (id, challenge, install, lineage, publicKey = spki, lifetime = 250_000) => {
  const now = stamp();
  return query(`select label_pilot.admit('${JSON.stringify({ id, spki: publicKey, installation: install, lineage,
    expiresAt: now + lifetime })}', '${challenge}', ${now + 119_000}, ${now})`);
};
const freshLease = async (id, install, lineage, lifetime) => {
  const challenge = randomUUID();
  const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey
    .export({ type: 'spki', format: 'der' }).toString('base64url');
  assert.match(await challengeFor(challenge), /^\d{13}$/);
  return issue(id, challenge, install, lineage, key, lifetime);
};
const reserve = (id, request, now = stamp()) => query(`select label_pilot.reserve('${id}','${request}',${now})`);
const finish = (id, request, now = stamp()) => query(`select label_pilot.finish('${id}','${request}',${now})`);

test('disposable PostgreSQL enforces role grants, atomic replay and quotas, revocation and disable',
  { skip: !disposable, timeout: 90_000 }, async () => {
    for (const path of sqlFiles) await psql(['-f', path]);
    assert.equal(await query("select nspowner = (select oid from pg_roles where rolname=current_user) from pg_namespace where nspname='label_pilot'", false), 't');
    await query('create role label_public_probe nologin', false);
    assert.equal(await query(`select has_schema_privilege('label_public_probe', 'label_pilot', 'usage'),
        has_table_privilege('label_public_probe', 'label_pilot.leases', 'select'),
        has_function_privilege('label_public_probe', 'label_pilot.get_lease(uuid)', 'execute')`, false), 'f|f|f');
    await assert.rejects(query('set role label_public_probe; select id from label_pilot.leases', false),
      error => /permission denied/.test(error.stderr));
    assert.equal(await query('select enabled from label_pilot.control where id'), 'f');
    await assert.rejects(query('select id from label_pilot.leases'), error => /permission denied/.test(error.stderr));
    await assert.rejects(query('select label_pilot.set_enabled(true)'), error => /permission denied/.test(error.stderr));
    await assert.rejects(query('select label_pilot.pilot_disable()'), error => /permission denied/.test(error.stderr));
    await assert.rejects(query('select label_pilot.recover_after_drain()'), error => /permission denied/.test(error.stderr));
    await assert.rejects(query('select counters from label_pilot.telemetry'), error => /permission denied/.test(error.stderr));
    await assert.rejects(query('select label_pilot.issue(null,null,null,null)'), error => /permission denied/.test(error.stderr));
    assert.equal(await query('select label_pilot.preflight()'), 'limited');
    await query(`select label_pilot.set_enabled(true); update label_pilot.control set
      ingress_limit=2, oauth_limit=2, ingress_minute=9223372036854775807, oauth_minute=9223372036854775807`, false);
    assert.deepEqual((await Promise.all(Array.from({length: 6}, () => query('select label_pilot.preflight()')))).toSorted(),
      ['limited', 'limited', 'limited', 'limited', 'ok', 'ok']);
    assert.deepEqual((await Promise.all(Array.from({length: 6}, () => query('select label_pilot.reserve_oauth()')))).toSorted(),
      ['f', 'f', 'f', 'f', 't', 't']);
    const a = randomUUID(), b = randomUUID(), challenge = randomUUID();
    assert.equal(await issue(a, challenge, 'install', 'lineage'), 'denied');
    assert.match(await challengeFor(challenge), /^\d{13}$/);
    assert.equal(await query(`select label_pilot.challenge_is_pending('${challenge}')`), 't');
    const attempts = await Promise.all([a, b].map(id => issue(id, challenge, 'install', 'lineage')));
    assert.deepEqual(attempts.toSorted(), ['denied', 'ok']);
    const lease = attempts[0] === 'ok' ? a : b;
    assert.equal(await query(`select label_pilot.challenge_is_pending('${challenge}')`), 'f');
    const otherChallenge = randomUUID();
    await challengeFor(otherChallenge);
    assert.equal(await issue(randomUUID(), otherChallenge, 'other_install', 'lineage'), 'denied');
    const expired = randomUUID();
    assert.equal(await freshLease(expired, 'expired', 'expired', 2000), 'ok');
    await query(`update label_pilot.leases set expires_at=1 where id='${expired}'`, false);
    assert.equal(await reserve(expired, randomUUID()), 'denied');
    const failed = randomUUID();
    await assert.rejects(query(`begin; select label_pilot.reserve('${lease}','${failed}',${stamp()}); select 1/0; commit`),
      error => /division by zero/.test(error.stderr));
    assert.equal(await query('select attempts from label_pilot.control', false), '0');
    assert.equal(await query('select count(*) from label_pilot.active', false), '0');
    assert.equal(await query('select count(*) from label_pilot.replays', false), '0');
    const requestIds = Array.from({ length: 12 }, () => randomUUID());
    const started = performance.now();
    const reservations = await Promise.all(requestIds.map(id => reserve(lease, id)));
    console.log(`12 concurrent loopback psql reservation clients incl. process startup: ${(performance.now() - started).toFixed(1)} ms`);
    const active = requestIds.filter((_, i) => reservations[i] === 'ok');
    assert.equal(active.length, 4);
    assert.equal(reservations.filter(value => value === 'limited').length, 8);
    assert.equal(await reserve(lease, active[0]), 'denied');
    assert.equal(await query('select attempts from label_pilot.control', false), '4');
    assert.equal(await finish(lease, active[0]), 'ok');
    assert.equal(await query(`select label_pilot.revoke('${lease}')`, false), 't');
    assert.equal(await finish(lease, active[1]), 'denied');
    assert.equal(await reserve(lease, randomUUID()), 'denied');
    await Promise.all(active.slice(2).map(id => finish(lease, id)));
    assert.equal(await query('select count(*) from label_pilot.active', false), '0');

    const timingLease = randomUUID(), timingRequest = randomUUID();
    assert.equal(await freshLease(timingLease, 'timing', 'timing'), 'ok');
    const profile = JSON.parse(await query(`explain (analyze, timing off, format json)
      select label_pilot.reserve('${timingLease}','${timingRequest}',${stamp()})`));
    console.log(`PostgreSQL reservation execution (one sample, excludes connection): ${profile[0]['Execution Time']} ms`);
    assert.equal(await finish(timingLease, timingRequest), 'ok');

    async function raceQuota(seed, check, expected, first, second) {
      await query(seed, false);
      const candidates = [randomUUID(), randomUUID()];
      assert.equal(await freshLease(candidates[0], ...first), 'ok');
      assert.equal(await freshLease(candidates[1], ...second), 'ok');
      const requests = [randomUUID(), randomUUID()];
      const results = await Promise.all(candidates.map((id, i) => reserve(id, requests[i])));
      assert.deepEqual(results.toSorted(), ['limited', 'ok']);
      assert.equal(await query(check, false), expected);
      const winner = results.indexOf('ok');
      return [candidates[winner], requests[winner]];
    }
    const install = await raceQuota("update label_pilot.control set installation_limit=7; insert into label_pilot.installation_daily values ('capped', 6)",
      "select attempts from label_pilot.installation_daily where id = 'capped'", '7',
      ['capped', 'different1'], ['capped', 'different2']);
    assert.equal(await finish(...install), 'ok');
    const lineage = await raceQuota("update label_pilot.control set lineage_limit=9; insert into label_pilot.lineage_daily values ('shared', 8)",
      "select attempts from label_pilot.lineage_daily where id = 'shared'", '9',
      ['different1', 'shared'], ['different2', 'shared']);
    assert.equal(await finish(...lineage), 'ok');
    const aggregate = await raceQuota('update label_pilot.control set attempts = 19, daily_limit = 20',
      'select attempts from label_pilot.control', '20', ['agg1', 'agg1'], ['agg2', 'agg2']);
    const pending = randomUUID();
    await challengeFor(pending);
    await query(`update label_pilot.pending_challenges set expires_at=1 where id='${pending}'; select label_pilot.cleanup_expired()`, false);
    assert.equal(await query('select count(*) from label_pilot.pending_challenges', false), '0');
    await challengeFor(randomUUID());
    // Disappeared worker: never call finish on the aggregate winner.
    assert.equal(await query('select count(*) from label_pilot.active', false), '1');
    await assert.rejects(query('select label_pilot.recover_after_drain()', false), error => /pilot_must_be_disabled/.test(error.stderr));
    await query('select label_pilot.pilot_disable()', false);
    assert.equal(await query('select count(*) from label_pilot.pending_challenges', false), '0');
    assert.equal(await query('select label_pilot.cleanup_expired(); select count(*) from label_pilot.active', false), '1');
    const recovered = await query('select label_pilot.recover_after_drain()', false);
    assert.equal(recovered, '1');
    assert.equal(await query('select label_pilot.recover_after_drain()', false), '0');
    assert.equal(await query('select attempts from label_pilot.control', false), '20');
    assert.equal(await query(`select count(*) from label_pilot.replays where lease='${aggregate[0]}' and id='${aggregate[1]}'`, false), '1');
    await query('select label_pilot.set_enabled(true)', false);
    assert.equal(await reserve(...aggregate), 'denied');
    await query('select label_pilot.pilot_disable()', false);
    assert.equal(await finish(...aggregate), 'denied');
    assert.equal(await issue(randomUUID(), randomUUID(), 'new_install', 'new_lineage'), 'disabled');
    await query("select label_pilot.record_outcome('authorization_denied', 45); select label_pilot.record_outcome('quota_exhausted', 220); select label_pilot.record_outcome('provider_failed', 99); select label_pilot.record_outcome('unexpected_marker', 42)");
    const counters = JSON.parse(await query('select counters from label_pilot.telemetry', false));
    assert.deepEqual(counters, { authorization_denied: 1, quota_exhausted: 1, provider_failed: 1, latency_le_50: 1, latency_le_250: 2 });
  });
