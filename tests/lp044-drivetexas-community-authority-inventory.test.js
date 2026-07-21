const assert = require('assert');
const { build } = require('../js/gridlyLp044DriveTexasCommunityAuthorityInventory.js');

const communities = [
  { key: 'alpha', label: 'Alpha', countyId: 'county-a', lat: 30.0, lng: -95.0, radiusMiles: 3 },
  { key: 'beta', label: 'Beta', countyId: 'county-a', lat: 30.0, lng: -94.94, radiusMiles: 3 },
  { key: 'gamma', label: 'Gamma', countyId: 'county-b', lat: 30.0, lng: -94.88, radiusMiles: 3 },
  { key: 'zero', label: 'Zero', countyId: 'county-c', lat: 31.0, lng: -96.0, radiusMiles: 3 }
];
const counties = [
  { countyId: 'county-a', countyName: 'County A' },
  { countyId: 'county-b', countyName: 'County B' },
  { countyId: 'county-c', countyName: 'County C' }
];
function line(id, coords, extra = {}) { return { sourceId: id, category: 'Crash', routeName: `Route ${id}`, geometry: { type: 'LineString', coordinates: coords }, ...extra }; }
function multi(id) { return { sourceId: id, category: 'Construction', geometry: { type: 'MultiLineString', coordinates: [[[-95.0,30.0],[-94.99,30.0]],[[-94.88,30.0],[-94.87,30.0]]] } }; }
function point(id, lat, lng) { return { sourceId: id, category: 'Flooding', latitude: lat, longitude: lng, geometry: { type: 'Point', coordinates: [lng, lat] } }; }

const records = [
  line('001', [[-95.08,30],[-95.0,30],[-94.94,30],[-94.88,30]]),
  multi('002'),
  line('003', [[-95.3,30],[-95.2,30]], { latitude: 30, longitude: -95.0 }),
  point('004', 31.5, -96.5),
  { sourceId: '005', category: 'Other' }
];
const productionSnapshot = { recordProof: [{ sourceId: '001', finalEligibility: false, geographicOwnershipMethod: 'not_established', ineligibilityReasons: ['example'] }], consumerEligibleSituations: [] };
const result = build({ records, communities, counties, productionSnapshot });

assert.strictEqual(result.records.length, records.length, 'every normalized record produces one row');
assert.deepStrictEqual(result.records.map(r => r.sourceId), ['001','002','003','004','005'], 'output ordering is deterministic');
assert(result.records.find(r => r.sourceId === '001').communityIdsIntersected.includes('alpha'), 'LineString uses complete segment geometry');
assert(result.records.find(r => r.sourceId === '002').communityIdsIntersected.includes('gamma'), 'MultiLineString evaluates every component');
assert.strictEqual(result.records.find(r => r.sourceId === '003').communityIntersectionCount, 0, 'midpoint/representative point alone does not assign community ownership when geometry exists');
assert(result.records.find(r => r.sourceId === '001').crossesMultipleCommunities, 'one record can intersect multiple communities');
assert(result.records.find(r => r.sourceId === '001').crossesMultipleCounties, 'one record can intersect multiple counties');
assert(result.records.find(r => r.sourceId === '003').nearestCommunityId, 'nearest community is retained as informational evidence');
assert(!result.records.find(r => r.sourceId === '003').insideGridlyCoverage, 'nearest community does not assign ownership');
assert(result.communitySummaries.some(s => s.communityId === 'zero' && s.intersectingDriveTexasRecordCount === 0), 'communities with zero records remain in summary');
assert.strictEqual(result.records.find(r => r.sourceId === '001').discrepancyClassification, 'GEOGRAPHICALLY_RELEVANT_BUT_NOT_VISIBLE', 'current LP039 visibility discrepancies are classified');
assert.strictEqual(result.noFetches && result.noPolling && result.noWrites && result.noStorageWrites && result.noMapMovement, true, 'helper contract is passive');

const source = require('fs').readFileSync(require('path').join(__dirname, '../js/gridlyLp044DriveTexasCommunityAuthorityInventory.js'), 'utf8');
assert(!/Houston|Dayton|Harris|Liberty|US\s*90|I-?10|I-?45|740|739/.test(source), 'implementation does not hardcode prohibited places, routes, or record counts');
console.log('LP044 DriveTexas community authority inventory tests passed');
