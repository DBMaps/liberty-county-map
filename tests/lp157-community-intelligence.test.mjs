import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { P, buildArtifacts, norm, verify } from '../tools/lp157-build-community-intelligence.mjs';

const artifacts = buildArtifacts();
const registry = JSON.parse(readFileSync(P.registry, 'utf8'));
const relationships = JSON.parse(readFileSync(P.relationships, 'utf8'));
const search = JSON.parse(readFileSync(P.search, 'utf8'));
const routing = JSON.parse(readFileSync(P.routing, 'utf8'));
const context = JSON.parse(readFileSync(P.context, 'utf8'));
const quality = JSON.parse(readFileSync(P.quality, 'utf8'));
const coverage = JSON.parse(readFileSync(P.coverage, 'utf8'));
function sha(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function snapshot() { return Object.fromEntries(Object.values(P).map(path => [path, sha(path)])); }

test('LP157 produces the required community intelligence deliverables without operational activation', () => {
  assert.deepEqual(artifacts.registry, registry);
  assert.equal(registry.milestone, 'LP157');
  assert.equal(registry.performsRuntimeChange, false);
  assert.equal(registry.performsDeploymentChange, false);
  assert.equal(registry.performsActivationChange, false);
  assert.equal(registry.rebuildsCertifiedPackages, false);
  assert.ok(registry.sources.some(source => source.includes('Census Bureau')));
});

test('LP157 communities have deterministic identities, county relationships, and valid Texas coordinates', () => {
  assert.equal(registry.communities.length, coverage.communityCount);
  assert.equal(new Set(registry.communities.map(c => c.id)).size, registry.communities.length);
  for (const community of registry.communities) {
    assert.equal(community.state, 'Texas');
    assert.equal(community.stateFips, '48');
    assert.match(community.countyFips, /^48\d{3}$/);
    assert.ok(community.coordinates.lat >= 25 && community.coordinates.lat <= 37, community.id);
    assert.ok(community.coordinates.lon >= -107 && community.coordinates.lon <= -93, community.id);
    assert.ok(relationships.relationships.some(r => r.communityId === community.id && r.countyFips === community.countyFips));
  }
  assert.deepEqual(quality.invalidCoordinates, []);
  assert.deepEqual(quality.missingCountyFips, []);
});

test('LP157 satisfies consumer search expectations and governed alias handling', () => {
  const expectationQueries = search.consumerExpectations.map(row => row.query);
  assert.deepEqual(expectationQueries, ['Dayton','Cleveland','Conroe','Waco','Amarillo','Laredo','Brownsville','Fredericksburg','Lufkin','Port Arthur']);
  assert.ok(search.consumerExpectations.every(row => row.status === 'PASS'));
  const searchable = new Map();
  for (const community of registry.communities) for (const token of community.searchTokens) searchable.set(norm(token), community.id);
  assert.equal(searchable.get('fburg'), 'tx-fredericksburg-48171');
  assert.equal(searchable.get('fredricksburg'), 'tx-fredericksburg-48171');
  assert.equal(searchable.get('pa tx'), 'tx-port-arthur-48245');
});

test('LP157 verifies routing destinations and notification community context', () => {
  assert.equal(routing.status, 'PASS');
  assert.equal(routing.destinationCount, registry.communities.length);
  assert.ok(routing.routableCommunities.every(row => row.routingDestination && Number.isFinite(row.lat) && Number.isFinite(row.lon)));
  assert.deepEqual(context.preferredNotificationExamples, ['Near Waco','Near Brenham','Near Dayton','Near Lufkin']);
  assert.equal(context.status, 'PASS');
});

test('LP157 preserves the Liberty benchmark and is deterministic/read-only under verification', () => {
  const libertyNames = registry.communities.filter(c => c.countyFips === '48291').map(c => c.name).sort();
  assert.deepEqual(libertyNames, ['Ames','Cleveland','Daisetta','Dayton','Devers','Hardin','Hull','Kenefick','Liberty','North Cleveland','Plum Grove']);
  assert.equal(quality.libertyBenchmark.status, 'PASS');
  const before = snapshot();
  assert.deepEqual(verify(), coverage);
  execFileSync('node', ['tools/lp157-build-community-intelligence.mjs'], { stdio: 'pipe' });
  assert.deepEqual(snapshot(), before);
});
