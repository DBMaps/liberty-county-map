import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { P, buildReports, verify } from '../tools/lp161-certify-statewide-destination-integration.mjs';

const reports = buildReports();
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const reportSnapshot = () => Object.fromEntries(Object.values(P).filter(existsSync).map((p) => [p, sha(p)]));

test('LP161 reconciles statewide destination inventory and provider integration', () => {
  const integration = reports[P.integration];
  assert.equal(integration.status, 'PASS');
  assert.equal(integration.classification, 'INTEGRATION_CERTIFIED');
  assert.equal(integration.datasetInventory.countyCandidateManifestEntries, 254);
  assert.equal(integration.datasetInventory.uniqueCountyFips, 254);
  assert.equal(integration.datasetInventory.uniqueCountyNames, 254);
  assert.deepEqual(integration.datasetInventory.duplicateCountyFips, []);
  assert.deepEqual(integration.datasetInventory.missingCountyFips, []);
  assert.equal(integration.provider.initializesSuccessfully, true);
  assert.ok(integration.provider.countySwitchChecks.every((check) => check.lookupSucceeded));
});

test('LP161 certifies exact destination, business, alias, category, and no-result behavior', () => {
  const destinationSearch = reports[P.destinationSearch];
  const businessSearch = reports[P.businessSearch];
  const category = reports[P.category];
  assert.equal(destinationSearch.status, 'PASS');
  assert.equal(destinationSearch.fuzzyGuessingIntroduced, false);
  assert.equal(destinationSearch.queries.find((q) => q.query === 'Livingston Lake').resultCount > 0, true);
  assert.equal(destinationSearch.queries.find((q) => q.expectedNoResult).truthfulNoResult, true);
  assert.equal(businessSearch.status, 'PASS');
  assert.ok(businessSearch.queries.find((q) => q.query === 'Walmart').stableDestinationId.startsWith('txdest-'));
  assert.equal(businessSearch.queries.find((q) => q.expectedNoResult).resultCount, 0);
  assert.equal(category.status, 'PASS');
  assert.deepEqual(category.categoryChecks.map((check) => check.requestedCategory), ['restaurants', 'hospitals', 'schools', 'parks', 'government', 'shopping', 'fuel', 'lodging']);
  assert.equal(category.remappedCategories, false);
});

test('LP161 certifies routing, favorites, Route Watch, awareness, and Liberty preservation without behavior changes', () => {
  assert.equal(reports[P.routing].status, 'PASS');
  assert.equal(reports[P.routing].algorithmChanged, false);
  assert.equal(reports[P.favorites].status, 'PASS');
  assert.equal(reports[P.favorites].destinationIdentityStable, true);
  assert.equal(reports[P.routeWatch].status, 'PASS');
  assert.equal(reports[P.routeWatch].workflowChanged, false);
  assert.equal(reports[P.awareness].status, 'PASS');
  assert.equal(reports[P.awareness].awarenessLogicChanged, false);
  const libertyHits = read('data/lp160/texas-destination-candidate-registry.json').destinations.filter((d) => d.countyFips === '48291');
  assert.ok(libertyHits.length > 0);
  assert.ok(libertyHits.every((d) => d.routingEligibility && d.favoriteEligibility && d.routeWatchEligibility && d.awarenessEligibility));
});

test('LP161 runtime preservation remains unchanged and certification generation is deterministic', () => {
  const runtime = reports[P.runtime];
  assert.equal(runtime.status, 'PASS');
  assert.equal(runtime.runtime, 'UNCHANGED');
  assert.equal(runtime.deployment, 'UNAUTHORIZED');
  assert.equal(runtime.activation, 'UNAUTHORIZED');
  assert.equal(runtime.protectedArtifactsModified, false);
  const before = reportSnapshot();
  assert.deepEqual(verify(), reports[P.summary]);
  execFileSync('node', ['tools/lp161-certify-statewide-destination-integration.mjs'], { stdio: 'pipe' });
  assert.deepEqual(reportSnapshot(), before);
});


test('LP161 runtime hash contract excludes mutable package orchestration', () => {
  const runtime = reports[P.runtime];
  assert.equal(runtime.deterministicContract.protectedArtifactPolicy, 'Hash only runtime/data artifacts explicitly governed by LP161; exclude mutable orchestration surfaces added by later milestones.');
  assert.deepEqual(runtime.deterministicContract.excludedMutableOrchestrationArtifacts, ['package.json']);
  assert.equal(Object.hasOwn(runtime.protectedHashes, 'package.json'), false);
  const originalPackage = readFileSync('package.json', 'utf8');
  try {
    const mutatedPackage = `${originalPackage.trimEnd()}
`;
    writeFileSync('package.json', mutatedPackage);
    assert.deepEqual(buildReports()[P.runtime], runtime);
  } finally {
    writeFileSync('package.json', originalPackage);
  }
});

test('LP161 summary emits the expected final certification classification', () => {
  const summary = reports[P.summary];
  assert.equal(summary.status, 'PASS');
  assert.equal(summary.finalClassification, 'INTEGRATION_CERTIFIED');
  assert.equal(summary.runtime, 'UNCHANGED');
  assert.equal(summary.deployment, 'UNAUTHORIZED');
  assert.equal(summary.activation, 'UNAUTHORIZED');
  assert.deepEqual(Object.values(summary.summaryChecks), Object.values(summary.summaryChecks).map(() => true));
});
