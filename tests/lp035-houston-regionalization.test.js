const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/LP035-HOUSTON-AWARENESS-REGIONALIZATION.md', 'utf8');

assert(source.includes('const GRIDLY_LP035_HOUSTON_REGION_MODEL = Object.freeze(['), 'LP035 region model is present');
assert(source.includes('window.gridlyLp035HoustonRegionalizationAudit = function gridlyLp035HoustonRegionalizationAudit()'), 'passive browser audit is exposed');
assert(source.includes('certificationStatus: "investigation_complete_lp035_1_required"'), 'audit truthfully reports LP035.1 requirement');
assert(source.includes('regionSelectionAvailable: false'), 'LP035 does not claim activated region selection');
assert(source.includes('reportRegionOwnershipAvailable: false'), 'LP035 does not claim report region ownership activation');
assert(source.includes('officialIncidentRegionOwnershipAvailable: false'), 'LP035 does not claim official region ownership activation');
assert(source.includes('houstonWideFallbackAvailable: Boolean(harrisAreas.includes("Houston"))'), 'Houston-wide fallback remains tied to existing Houston selection');
assert(source.includes('harrisCountyFallbackAvailable: Boolean(harrisAreas.includes("Harris County"))'), 'Harris county fallback remains tied to existing county selection');

const idMatches = [...source.matchAll(/id: "(houston-[^"]+)"/g)].map((match) => match[1]);
const uniqueIds = new Set(idMatches);
assert.strictEqual(idMatches.length, 15, 'LP035 recommends a manageable 15-region model');
assert.strictEqual(uniqueIds.size, idMatches.length, 'Houston region IDs are stable and unique');

for (const community of ['Kingwood', 'Clear Lake', 'Pasadena', 'Baytown', 'Humble', 'Katy', 'Cypress', 'Aldine', 'North Houston', 'Bellaire', 'West University Place']) {
  assert(source.includes(`"${community}"`), `separate Harris community ${community} remains documented`);
}

assert(!/id: "houston-kingwood"/.test(source), 'Kingwood is not duplicated as a Houston region');
assert(!/id: "houston-clear-lake"/.test(source), 'Clear Lake is not duplicated as a Houston region');
assert(doc.includes('Existing `Houston` preferences remain valid'), 'documentation covers saved Houston compatibility');
assert(doc.includes('Road/intersection context must outrank the broad region label'), 'documentation preserves LP034 road-context precedence');
assert(doc.includes('Do not scan all polygons during render'), 'documentation covers hot-loop performance protection');
assert(doc.includes('LP035.1 — Houston Region State, Geometry, and Filtering Activation'), 'documentation recommends next milestone');

console.log('LP035 Houston regionalization audit/model checks passed');
