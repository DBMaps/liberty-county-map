import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildInventory, classifySourceOutcome, paths, run, TAXONOMY, validateInventory } from '../tools/lp214/build-drivetexas-coverage-inventory.mjs';

const phase1 = JSON.parse(fs.readFileSync(paths.phase1));
const checkedIn = JSON.parse(fs.readFileSync(paths.output));

test('uses exactly the governed Phase 1 canonical community universe', () => {
  const keys = [...new Set(phase1.counties.flatMap(county => county.communities.map(row => row.canonicalKey)))].sort();
  assert.equal(checkedIn.communities.length, 1859);
  assert.deepEqual(checkedIn.communities.map(row => row.canonicalKey), keys);
  validateInventory(checkedIn, phase1);
});

test('is deterministic and checked-in bytes match the builder', () => {
  assert.deepEqual(buildInventory(), buildInventory());
  assert.doesNotThrow(() => run({ verify: true }));
});

test('uses valid taxonomies and preserves multi-county identity including Dallas', () => {
  for (const row of checkedIn.communities) for (const [field, values] of Object.entries(TAXONOMY)) assert(values.includes(row[field]));
  const phase1Multi = new Map(phase1.counties.flatMap(county => county.communities).filter(row => row.multiCounty).map(row => [row.canonicalKey, row.memberCountyFips]));
  assert.equal(phase1Multi.size, 163);
  for (const [key, memberships] of phase1Multi) assert.deepEqual(checkedIn.communities.find(row => row.canonicalKey === key).memberCountyFips, memberships);
  assert.deepEqual(checkedIn.communities.find(row => row.placeGeoid === '4819000').memberCountyFips, ['48085', '48113', '48121', '48257', '48397']);
});

test('embeds no geometry, incident payloads, source responses, labels, or runtime actions', () => {
  for (const row of checkedIn.communities) assert.deepEqual(Object.keys(row).sort(), ['applicability', 'canonicalKey', 'findingCodes', 'liveVerificationStatus', 'memberCountyFips', 'placeGeoid', 'sourceHealthCapability', 'spatialResolutionCapability', 'staticCapability'].sort());
  assert.deepEqual(checkedIn.implementation.passiveGuarantees, { noRuntimeActivation: true, noFetches: true, noPolling: true, noWrites: true, noRemoteMutation: true });
  const source = fs.readFileSync(new URL('../tools/lp214/build-drivetexas-coverage-inventory.mjs', import.meta.url), 'utf8');
  assert(!/\bfetch\s*\(/.test(source));
});

test('models connector source-health outcomes without activating production', () => {
  assert.equal(classifySourceOutcome({ connected: true, normalizedRecordCount: 2 }), 'HEALTHY_WITH_DATA_DISTINGUISHABLE');
  assert.equal(classifySourceOutcome({ connected: true, normalizedRecordCount: 0 }), 'HEALTHY_EMPTY_DISTINGUISHABLE');
  assert.equal(classifySourceOutcome({ connected: false, normalizedRecordCount: 0, error: 'network failure' }), 'SOURCE_FAILURE_DISTINGUISHABLE');
  assert.equal(classifySourceOutcome({ connected: false, normalizedRecordCount: 0, error: 'schema validation failed' }), 'SOURCE_FAILURE_DISTINGUISHABLE');
});
