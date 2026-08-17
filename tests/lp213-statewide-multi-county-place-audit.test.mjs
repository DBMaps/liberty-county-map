import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/app.js', 'utf8');
const report = JSON.parse(fs.readFileSync('data/generated/lp213-statewide-multi-county-place-audit.json', 'utf8'));

function productionFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const brace = source.indexOf('{', source.indexOf(')', start));
  let depth = 0;
  for (let index = brace; index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('LP213 governed inventory covers every canonical multi-county PLACE', () => {
  assert.equal(report.totalCanonicalMultiCountyPlaceCount, 163);
  assert.equal(report.inventory.length, 163);
  assert.deepEqual(report.classificationTotals, { PASS: 163, SAME_DEFECT_CLASS: 0, DIFFERENT_DEFECT: 0, OWNER_REVIEW_REQUIRED: 0 });
  assert.equal(new Set(report.inventory.map(row => row.placeGeoid)).size, 163);
  for (const row of report.inventory) {
    assert.match(row.placeGeoid, /^48\d{5}$/);
    assert.equal(row.canonicalAwarenessKey, `place-${row.placeGeoid}`);
    assert.equal(row.canonicalIdentity, 'PLACE_GEOID');
    assert.equal(row.canonicalMultiCountyPlace, true);
    assert.ok(row.members.length > 1);
    assert.ok(row.members.some(member => member.fips === row.selectedTestOperationalCounty.countyFips));
    assert.equal(row.classification, 'PASS', `${row.label}: ${row.failureReason}`);
    assert.equal(row.roadwayRuntime.automaticallyActivated, true);
  }
});

test('all convergence owners select the audited operational member and return cleanly', () => {
  for (const row of report.inventory) {
    const expected = row.selectedTestOperationalCounty.countyId;
    for (const owner of ['activeCounty', 'selectedCounty', 'roadwayRuntimeCounty', 'settingsCounty', 'profileCounty', 'selectedAwarenessOperationalCounty', 'awarenessSnapshotCounty']) {
      assert.equal(row.results[owner], expected, `${row.label} ${owner}`);
    }
    assert.equal(row.results.selectedAwarenessKey, row.canonicalAwarenessKey);
    assert.notEqual(row.startupPredecessorCounty, expected);
    assert.equal(row.results.returnTransitionCounty, row.startupPredecessorCounty);
    assert.ok(row.results.settingsReadsBound <= 2);
    assert.equal(row.results.maximumSettingsNestingDepth, 1);
    assert.equal(row.results.stalePredecessorWorkCancelled, true);
    assert.equal(row.results.sameCountyRoadwayActivationDeduplicated, true);
  }
});

test('persisted precedence is generic across the full cohort', () => {
  const registry = Object.fromEntries(report.inventory.flatMap(row => row.members.map(member => [member.countyId, { id: member.countyId, countyFips: member.fips }])));
  const context = {
    Object, Set, GRIDLY_COUNTY_REGISTRY: registry,
    gridlyNormalizeCountyId: value => String(value || '').toLowerCase(),
    gridlyResolveCanonicalPlaceGeoid: area => area.placeGeoid
  };
  vm.createContext(context);
  vm.runInContext(`${productionFunction('gridlyResolvePersistedCanonicalPlaceOperationalCounty')};this.resolve=gridlyResolvePersistedCanonicalPlaceOperationalCounty`, context);
  for (const row of report.inventory) {
    const area = { key: row.canonicalAwarenessKey, placeGeoid: row.placeGeoid, canonicalMultiCountyPlace: true, countyMemberships: row.members.map(member => member.fips) };
    const profile = { awarenessAreaKey: row.canonicalAwarenessKey, awarenessAreaCountyId: row.selectedTestOperationalCounty.countyId };
    const settings = { community: { awarenessAreaKey: row.canonicalAwarenessKey, countyId: row.staleSettingsCounty } };
    assert.equal(context.resolve(area, null, profile, settings, 'unrelated-tx'), row.selectedTestOperationalCounty.countyId, row.label);
    assert.equal(context.resolve(area, null, {}, settings, 'unrelated-tx'), row.staleSettingsCounty, row.label);
    assert.equal(context.resolve(area, null, {}, { community: {} }, row.selectedTestOperationalCounty.countyId), row.selectedTestOperationalCounty.countyId, row.label);
    assert.equal(context.resolve(area, null, {}, { community: {} }, 'unrelated-tx'), null, row.label);
  }
});

test('canonical runtime synchronization rejects an explicit non-member county generically', () => {
  const row = report.inventory[0];
  const registry = Object.fromEntries([...row.members.map(member => [member.countyId, { id: member.countyId, countyFips: member.fips }]), ['unrelated-tx', { id: 'unrelated-tx', countyFips: '48291' }]]);
  const context = {
    Object, Set, Number, GRIDLY_COUNTY_REGISTRY: registry, gridlyOperationalCountyResolutionAudit: null, gridlyPlacePresentationTargets: null,
    gridlyNormalizeCountyId: value => String(value || '').toLowerCase(), gridlyIsKnownCountyId: value => Boolean(registry[value]),
    gridlyResolveCanonicalPlaceGeoid: area => area.placeGeoid, gridlyGetGovernedPlaceConsumerPresentationCamera: () => null
  };
  vm.createContext(context);
  vm.runInContext(`${productionFunction('gridlyResolveCanonicalCountyIdForOperationalContext')};this.resolve=gridlyResolveCanonicalCountyIdForOperationalContext`, context);
  const area = { placeGeoid: row.placeGeoid, canonicalMultiCountyPlace: true, countyMemberships: row.members.map(member => member.fips) };
  assert.equal(context.resolve(area, 'unrelated-tx'), null);
  assert.equal(context.gridlyOperationalCountyResolutionAudit.failureReason, 'explicit_county_outside_governed_memberships');
  assert.equal(context.resolve(area, row.selectedTestOperationalCounty.countyId), row.selectedTestOperationalCounty.countyId);
  assert.equal(context.gridlyOperationalCountyResolutionAudit.membershipValidated, true);
});

test('startup normalization and roadway race protections remain leaf and atomic', () => {
  assert.doesNotMatch(productionFunction('normalizeGridlySettings'), /getGridlySelectedAwarenessArea/);
  assert.doesNotMatch(productionFunction('gridlyResolveSettingsAwarenessArea'), /getGridlySelectedAwarenessArea/);
  const loader = productionFunction('loadRoadwayDataset');
  assert.doesNotMatch(loader, /await gridlyEnsureRoadwayRuntimeManifestLoaded/);
  assert.match(loader, /currentLoadPromise && gridlyRoadwayPackageRuntimeState\.currentPackageCacheKey === cacheKey/);
  assert.match(loader, /gridlyRoadwayPackageRuntimeState\.currentLoadPromise = loadPromise/);
  const activation = productionFunction('gridlyActivateRoadwayDatasetForActiveCounty');
  assert.match(activation, /reuseActiveLoad/);
  assert.match(activation, /activeActivationSequence/);
});
