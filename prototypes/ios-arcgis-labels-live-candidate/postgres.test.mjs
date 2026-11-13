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
  database === 'gridly_labels_pilot_test' && user === 'gridly_pilot_test_owner');
const sqlFile = fileURLToPath(new URL('./pilot-state.sql', import.meta.url));
const spki = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey
  .export({ type: 'spki', format: 'der' }).toString('base64url');
const psql = async args => (await exec(join(bin, 'psql.exe'), ['-XqAt', '-w', '-v', 'ON_ERROR_STOP=1', ...args],
  { windowsHide: true, timeout: 20_000 })).stdout.trim();
const query = (sql, role = true) => psql(['-c', (role ? 'set role label_pilot_gateway; ' : '') + sql]);
const stamp = () => Date.now();
const issue = (id, challenge, install, lineage, now = stamp(), lifetime = 250_000) => query(
  `select label_pilot.issue('${JSON.stringify({ id, spki, installation: install, lineage, expiresAt: now + lifetime })}', '${challenge}', ${now + 119_000}, ${now})`);
const reserve = (id, request, now = stamp()) => query(`select label_pilot.reserve('${id}','${request}',${now})`);
const finish = (id, request, now = stamp()) => query(`select label_pilot.finish('${id}','${request}',${now})`);

test('disposable PostgreSQL enforces role grants, atomic replay and quotas, revocation and disable',
  { skip: !disposable, timeout: 90_000 }, async () => {
    await psql(['-f', sqlFile]);
    assert.equal(await query('select enabled from label_pilot.control where id'), 'f');
    await assert.rejects(query('select id from label_pilot.leases'), error => /permission denied/.test(error.stderr));
    await assert.rejects(query('select label_pilot.set_enabled(true)'), error => /permission denied/.test(error.stderr));
    await query('select label_pilot.set_enabled(true)', false);
    const a = randomUUID(), b = randomUUID(), challenge = randomUUID();
    const attempts = await Promise.all([a, b].map(id => issue(id, challenge, 'install', 'lineage')));
    assert.deepEqual(attempts.toSorted(), ['denied', 'ok']);
    const lease = attempts[0] === 'ok' ? a : b;
    const requestIds = Array.from({ length: 12 }, () => randomUUID());
    const reservations = await Promise.all(requestIds.map(id => reserve(lease, id)));
    const active = requestIds.filter((_, i) => reservations[i] === 'ok');
    assert.equal(active.length, 4);
    assert.equal(reservations.filter(value => value === 'limited').length, 8);
    assert.equal(await reserve(lease, active[0]), 'denied');
    assert.equal(await query('select attempts from label_pilot.control', false), '4');
    assert.equal(await finish(lease, active[0]), 'ok');
    assert.equal(await query(`select label_pilot.revoke('${lease}')`), 't');
    assert.equal(await finish(lease, active[1]), 'denied');
    assert.equal(await reserve(lease, randomUUID()), 'denied');
    await Promise.all(active.slice(2).map(id => finish(lease, id)));
    assert.equal(await query('select count(*) from label_pilot.active', false), '0');

    async function raceQuota(seed, check, expected, first, second) {
      await query(seed, false);
      const candidates = [randomUUID(), randomUUID()];
      assert.equal(await issue(candidates[0], randomUUID(), ...first), 'ok');
      assert.equal(await issue(candidates[1], randomUUID(), ...second), 'ok');
      const requests = [randomUUID(), randomUUID()];
      const results = await Promise.all(candidates.map((id, i) => reserve(id, requests[i])));
      assert.deepEqual(results.toSorted(), ['limited', 'ok']);
      assert.equal(await query(check, false), expected);
      const winner = results.indexOf('ok');
      return [candidates[winner], requests[winner]];
    }
    const install = await raceQuota("insert into label_pilot.installation_daily values ('capped', 499)",
      "select attempts from label_pilot.installation_daily where id = 'capped'", '500',
      ['capped', 'different1'], ['capped', 'different2']);
    assert.equal(await finish(...install), 'ok');
    const lineage = await raceQuota("insert into label_pilot.lineage_daily values ('shared', 999)",
      "select attempts from label_pilot.lineage_daily where id = 'shared'", '1000',
      ['different1', 'shared'], ['different2', 'shared']);
    assert.equal(await finish(...lineage), 'ok');
    const aggregate = await raceQuota('update label_pilot.control set attempts = 9999',
      'select attempts from label_pilot.control', '10000', ['agg1', 'agg1'], ['agg2', 'agg2']);
    await query('select label_pilot.set_enabled(false)', false);
    assert.equal(await finish(...aggregate), 'denied');
    assert.equal(await issue(randomUUID(), randomUUID(), 'new_install', 'new_lineage'), 'disabled');
  });
