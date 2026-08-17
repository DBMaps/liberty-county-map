import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const audit = read('reports/lp206/statewide-roadway-geometry-source-and-coverage-audit.json');
const cohort = read('reports/lp206/statewide-roadway-missing-build-cohort.json');

test('freezes and conserves the governed 28 / missing 226', () => {
  assert.equal(cohort.totalTexasCounties, 254);
  assert.equal(cohort.existingRuntimeRoadwayCountyCount, 28);
  assert.equal(cohort.missingRoadwayCountyCount, 226);
  assert.deepEqual(cohort.conservation, { existingCount: 28, missingCount: 226, intersectionCount: 0, unionCount: 254, duplicateFipsCount: 0, unknownFipsCount: 0, missingTexasCountyCount: 0, extraNonTexasIdentityCount: 0 });
  const manifest = read('data/roadway-runtime-manifest.json');
  assert.deepEqual(cohort.existingRuntimeCounties.map(x => x.countyId).sort(), Object.keys(manifest.counties).sort());
  assert.ok(cohort.missingCounties.every(x => !x.currentRuntimeRoadway && x.requiredAction === 'MANUFACTURE_AND_CERTIFY'));
});

test('represents owner evidence without misclassifying artifacts', () => {
  assert.equal(audit.ownerEvidence.lp1883.communityIdentityPackageCount, 254);
  assert.equal(audit.ownerEvidence.lp1883.classifiedAsRoadwayPackages, false);
  assert.equal(audit.ownerEvidence.osmRaw.uniqueCountyCount, 26);
  assert.equal(audit.ownerEvidence.extractedTiger2025.shapefileCount, 6);
  assert.equal(audit.ownerEvidence.newerTiger2025Zips.zipCount, 3);
  assert.equal(audit.ownerEvidence.productionSupabase.totalObjectCount, 29);
  assert.equal(audit.ownerEvidence.productionSupabase.hiddenStatewideInventory, false);
});

test('closes source acquisition and manufacturing readiness explicitly', () => {
  const allowed = ['EXISTING_AUTOMATED_ACQUISITION_READY', 'EXISTING_ACQUISITION_NEEDS_REPAIR', 'NO_EXISTING_ACQUISITION_TOOLING', 'SOURCE_CONTRACT_UNRESOLVED'];
  assert.ok(allowed.includes(audit.decisions.sourceAcquisition));
  assert.equal(audit.decisions.sourceAcquisition, 'NO_EXISTING_ACQUISITION_TOOLING');
  assert.equal(audit.acquisitionTooling.reusableDownloaderExists, false);
  assert.equal(audit.manufacturingTooling.identified, true);
  assert.ok(audit.manufacturingTooling.scripts.includes('tools/lp118/extract-tiger-roadways.mjs'));
  assert.match(audit.sourceConsistency.conclusion, /SOURCE_GOVERNANCE/);
  assert.equal(audit.decisions.lp207Readiness, 'READY_FOR_LP207_PILOT');
});

test('three source controls are pilot-ready and existing 28 are protected', () => {
  assert.deepEqual(audit.zipControls.map(x => x.fips), ['48287', '48331', '48395']);
  assert.ok(audit.zipControls.every(x => x.zipOpens && x.expectedMembersPresent && x.schemaReadableByLp118 && x.pilotSuitable));
  assert.equal(audit.existing28Protection.excludedFips.length, 28);
  assert.equal(audit.existing28Protection.overwriteAllowed, false);
  assert.equal(audit.existing28Protection.preserveHarrisPartitions, true);
  assert.equal(audit.existing28Protection.preserveLibertySanJacintoLocalBehavior, true);
});

test('LP206 is audit-only and deterministic', () => {
  assert.deepEqual(audit.controls, { productionRuntimeFilesModified: false, roadwayPackagesManufactured: false, sourceFilesDownloaded: false, supabaseWritesPerformed: false });
  assert.doesNotThrow(() => execFileSync(process.execPath, ['tools/lp206/build-statewide-roadway-geometry-audit.mjs', '--verify'], { stdio: 'pipe' }));
});
