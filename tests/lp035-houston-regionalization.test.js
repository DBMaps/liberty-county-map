const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/LP035-HOUSTON-AWARENESS-REGIONALIZATION.md', 'utf8');

assert(source.includes('const GRIDLY_LP035_HOUSTON_REGION_MODEL = Object.freeze(['), 'LP035 region model is present');
assert(source.includes('window.gridlyLp035HoustonRegionalizationAudit = function gridlyLp035HoustonRegionalizationAudit()'), 'passive browser audit is exposed');
assert(source.includes('certificationStatus: unresolvedOwnershipFindings.length ? "implementation_ready_with_findings" : "implementation_ready"'), 'audit now reports LP035.1 implementation readiness truthfully');
assert(source.includes('regionSelectionAvailable: regionAreaCount === GRIDLY_LP035_HOUSTON_REGION_MODEL.length'), 'LP035.1 activates region selection only when every region is registered');
assert(source.includes('reportRegionOwnershipAvailable: true'), 'LP035.1 exposes report region ownership support');
assert(source.includes('officialIncidentRegionOwnershipAvailable: true'), 'LP035.1 exposes official incident region ownership support');
assert(source.includes('houstonWideFallbackAvailable: Boolean(harrisAreas.includes("Houston"))'), 'Houston-wide fallback remains tied to existing Houston selection');
assert(source.includes('harrisCountyFallbackAvailable: Boolean(harrisAreas.includes("Harris County"))'), 'Harris county fallback remains tied to existing county selection');
assert(source.includes('preferredRegionZoom'), 'audit exposes the selected Houston region preferred zoom');
assert(source.includes('actualRegionZoom'), 'audit exposes the actual map zoom for selected Houston regions');
assert(source.includes('regionSeedCoordinate'), 'audit exposes the selected Houston region seed coordinate');
assert(source.includes('zoomSource'), 'audit identifies the source of the selected Houston region zoom');

const idMatches = [...source.matchAll(/id: "(houston-[^"]+)"/g)].map((match) => match[1]);
const uniqueIds = new Set(idMatches);
assert.strictEqual(idMatches.length, 15, 'LP035 recommends a manageable 15-region model');
assert.strictEqual(uniqueIds.size, idMatches.length, 'Houston region IDs are stable and unique');

const regionModelBlock = source.slice(
  source.indexOf('const GRIDLY_LP035_HOUSTON_REGION_MODEL = Object.freeze(['),
  source.indexOf('const GRIDLY_LP035_HOUSTON_REGION_LOOKUP')
);
assert(!/startupZoom: 12/.test(regionModelBlock), 'broader Houston regions no longer open at the too-wide zoom 12 view');
assert.strictEqual((regionModelBlock.match(/startupZoom: 13/g) || []).length, 5, 'only the five broadest Houston regions use zoom 13 after the one-level refinement');
assert.strictEqual((regionModelBlock.match(/startupZoom: 14/g) || []).length, 10, 'the ten more compact Houston regions use zoom 14 after the one-level refinement');
assert(/id: "houston-med-center-rice"[^\n]+startupZoom: 14/.test(regionModelBlock), 'Medical Center / Rice starts at a more local zoom');
assert(/id: "houston-downtown-midtown"[^\n]+startupZoom: 14/.test(regionModelBlock), 'Downtown / Midtown starts at a more local zoom');

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
