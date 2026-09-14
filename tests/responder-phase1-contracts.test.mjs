import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const negative = JSON.parse(read('tests/contracts/responder/responder-v1-negative-vectors.json'));
const positive = JSON.parse(read('tests/contracts/responder/responder-v1-positive-vectors.json'));
const manifest = JSON.parse(read('reports/responder/responder-v1-county-authority-manifest.json'));
const mapping = JSON.parse(read('reports/responder/responder-phase1-vector-map.json'));
const vectors = [...negative.vectors, ...positive.vectors];
const contractVersion = 'responder.agency.v1.phase0.1';

test('all nine frozen Phase 0 contract documents remain present', () => {
  const names = fs.readdirSync(path.join(root, 'docs/RESPONDER')).filter(name => name.startsWith('RESPONDER-V1-'));
  assert.equal(names.length, 9);
  for (const name of names) assert.match(read(`docs/RESPONDER/${name}`), /responder\.agency\.v1\.phase0\.1/);
});

test('Phase 0 JSON versions and vector inventory are unchanged', () => {
  for (const item of [negative, positive, manifest]) assert.equal(item.contractVersion, contractVersion);
  assert.equal(negative.vectors.length, 34);
  assert.equal(positive.vectors.length, 20);
  assert.equal(new Set(vectors.map(vector => vector.id)).size, 54);
});

test('every vector action and status is frozen in the role and command contracts', () => {
  const role = read('docs/RESPONDER/RESPONDER-V1-ROLE-MATRIX.md');
  const command = read('docs/RESPONDER/RESPONDER-V1-COMMAND-CONTRACT.md');
  const actions = new Set([...role.matchAll(/^\| `([a-z_]+)` \|/gm)].map(match => match[1]));
  const statuses = new Set(['accepted','pending_review','already_processed','invalid_request','forbidden','out_of_scope','stale_revision','suspended','expired','rate_limited','maintenance','retryable_failure']);
  for (const vector of vectors) {
    assert.ok(actions.has(vector.action), vector.id);
    assert.ok(statuses.has(vector.expectedResult), vector.id);
  }
  for (const status of statuses) assert.ok(command.includes(`\`${status}\``), status);
});

test('county manifest matches canonical tracked source and 254 unique FIPS', () => {
  const git = spawnSync('git', ['show', `808c20bd4172b0644f8d1d997d2352413ed1bc21:${manifest.sourcePath}`], {
    cwd: root, encoding: null, maxBuffer: 30000000,
  });
  assert.equal(git.status, 0);
  assert.equal(createHash('sha256').update(git.stdout).digest('hex'), manifest.sourceSha256);
  assert.equal(git.stdout.length, manifest.sourceByteLength);
  const source = JSON.parse(git.stdout.toString('utf8'));
  assert.equal(source.counties.length, 254);
  assert.deepEqual(source.counties.map(county => county.fips), manifest.canonicalFipsInventory);
  assert.equal(new Set(manifest.canonicalFipsInventory).size, 254);
  assert.ok(source.counties.every(county => county.countyId && county.geometry?.type === 'Polygon'));
});

test('all 54 vectors have one valid Phase 1 mapping', () => {
  const categories = ['EXECUTABLE IN PHASE 1','REQUIRES PHASE 2 AUTH','REQUIRES PHASE 3 AUTHORITY LOGIC','REQUIRES PHASE 4 RLS','REQUIRES PHASE 5 COMMAND RPC','REQUIRES DASHBOARD','REQUIRES CONSUMER PROJECTION'];
  assert.equal(mapping.vectors.length, 54);
  assert.deepEqual(new Set(mapping.vectors.map(item => item.id)), new Set(vectors.map(vector => vector.id)));
  assert.ok(mapping.vectors.every(item => categories.includes(item.classification)));
  for (const category of categories) {
    assert.equal(mapping.counts[category], mapping.vectors.filter(item => item.classification === category).length);
  }
  assert.equal(mapping.counts['EXECUTABLE IN PHASE 1'], 0);
  assert.equal(Object.values(mapping.counts).reduce((sum, count) => sum + count, 0), 54);
});

test('Phase 1 schema does not enter production migration history or reuse community objects', () => {
  const apply = read('db/responder-local/001_agency_private_apply.sql');
  const rollback = read('db/responder-local/001_agency_private_rollback.sql');
  assert.match(apply, /CREATE SCHEMA agency_private/);
  assert.match(apply, /agency_publishing_enabled boolean NOT NULL DEFAULT false/);
  assert.doesNotMatch(apply, /\b(?:public\.reports|reporting_enabled|report_retention\.replay_evidence)\b/i);
  assert.match(rollback, /DROP SCHEMA agency_private CASCADE/);
  assert.doesNotMatch(rollback, /DROP EXTENSION|DROP SCHEMA public|DROP TABLE public/i);
});
