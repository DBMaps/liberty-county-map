const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const presentation = require('../data/generated/gridly-statewide-place-presentation-v1.json');

const dallas = Object.freeze({
  key: 'place-4819000', label: 'Dallas', countyId: 'dallas-tx',
  countyIds: ['collin-tx', 'dallas-tx', 'denton-tx', 'kaufman-tx', 'rockwall-tx'],
  lat: 32.7767, lng: -96.797
  // The live canonical PLACE shape intentionally has no radius field.
});
const nowMs = Date.parse('2026-08-17T12:00:00Z');
const activeTimes = { startTime: '2026-08-17T08:00:00Z', endTime: '2026-08-17T20:00:00Z' };

function record(id, category, latitude, longitude, sourceGeometry) {
  return { id, sourceId: id, category, latitude, longitude, sourceGeometry, ...activeTimes };
}

// Eight bounded reproductions of the live Dallas provider shapes.  They retain
// the observed categories, unique identities, representative-distance band and
// trusted GeoJSON geometry types without embedding transient provider payloads.
const dallasShapes = [
  record('dallas-live-shape-1', 'Bridge Restriction', 32.7857, -96.7970, { type: 'LineString', coordinates: [[-96.801, 32.7857], [-96.793, 32.7857]] }),
  record('dallas-live-shape-2', 'Bridge Restriction', 32.7802, -96.7970, { type: 'LineString', coordinates: [[-96.800, 32.7802], [-96.794, 32.7802]] }),
  record('dallas-live-shape-3', 'Lane Closure', 32.7892, -96.7970, { type: 'LineString', coordinates: [[-96.802, 32.7892], [-96.792, 32.7892]] }),
  record('dallas-live-shape-4', 'Bridge Restriction', 32.7801, -96.7970, { type: 'LineString', coordinates: [[-96.799, 32.7801], [-96.795, 32.7801]] }),
  record('dallas-live-shape-5', 'Lane Closure', 32.7887, -96.7970, { type: 'MultiLineString', coordinates: [[[-96.803, 32.7887], [-96.799, 32.7887]], [[-96.795, 32.7887], [-96.791, 32.7887]]] }),
  record('dallas-live-shape-6', 'Road Closure', 32.7882, -96.7970, { type: 'LineString', coordinates: [[-96.802, 32.7882], [-96.792, 32.7882]] }),
  record('dallas-live-shape-7', 'Bridge Restriction', 32.7861, -96.7970, { type: 'Point', coordinates: [-96.7970, 32.7861] }),
  record('dallas-live-shape-8', 'Bridge Restriction', 32.7845, -96.7970, { type: 'LineString', coordinates: [[-96.801, 32.7845], [-96.793, 32.7845]] })
];

const sandbox = { console, Date, Math, URLSearchParams, setTimeout() {}, clearTimeout() {}, window: null, getGridlySelectedAwarenessArea: () => dallas };
sandbox.window = sandbox;
sandbox.resolveGridlyCanonicalPlacePresentationFocus = (area) => {
  const geoid = /^place-(48\d{5})$/.exec(String(area?.key || area?.canonicalKey || ''))?.[1];
  const target = geoid && presentation.places[geoid];
  return target ? { canonicalKey: `place-${geoid}`, lat: target.lat, lng: target.lon, radiusMiles: 7, authority: 'LP201_CERTIFIED_STATEWIDE_PLACE_PRESENTATION_V1' } : null;
};
vm.createContext(sandbox);
vm.runInContext('window.gridlySelectDriveTexasAuthority = input => Object.freeze({ selectedAwarenessArea: input.selectedAwarenessArea, consumerEligibleSituations: [] });', sandbox);
vm.runInContext(fs.readFileSync('js/gridlyDriveTexasGeometryAuthority.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('js/gridlyDriveTexasAuthoritySourceIntegration.js', 'utf8'), sandbox);

function select(records, area = dallas) {
  return sandbox.gridlySelectDriveTexasAuthority({ records, selectedAwarenessArea: area, nowMs, providerAvailable: true, connectorAvailable: true, fetchFailed: false });
}

const result = select(dallasShapes);
assert.strictEqual(result.recordProof.length, 8);
assert.strictEqual(result.authorityEligibleRecordCount, 8, 'all eight nearby Dallas reproductions use their actual trusted geometry');
assert(result.recordProof.every((proof) => proof.configuredAwarenessRadiusMiles === 7), 'missing radius uses the governed seven-mile default without widening');
assert(result.recordProof.every((proof) => proof.finalEligibility && proof.selectedAwarenessMatch), 'all eight nearby geometries qualify');
assert(result.recordProof.every((proof) => proof.duplicateStatus === 'unique'), 'all eight authority identities remain unique');
assert(result.recordProof.some((proof) => proof.sourceGeometryType === 'Point' && proof.geographicOwnershipMethod === 'valid_source_point_inside_awareness_radius_miles'));
assert(result.recordProof.some((proof) => proof.sourceGeometryType === 'LineString' && proof.geographicOwnershipMethod === 'trusted_source_geometry_intersects_awareness_radius'));
assert(result.recordProof.some((proof) => proof.sourceGeometryType === 'MultiLineString' && proof.geographicOwnershipMethod === 'trusted_source_geometry_intersects_awareness_radius'));

const outside = record('outside-control', 'Road Closure', 32.7767, -96.797, { type: 'LineString', coordinates: [[-97.1, 33.0], [-97.0, 33.0]] });
const outsideProof = select([outside]).recordProof[0];
assert.strictEqual(outsideProof.finalEligibility, false, 'trusted geometry outside seven miles remains rejected despite a nearby representative point');
assert.strictEqual(outsideProof.geographicOwnershipMethod, 'not_established');
assert(outsideProof.ineligibilityReasons.includes('trusted_geometry_outside_selected_awareness'));

const geojson = sandbox.gridlyQualifyDriveTexasGeometryAuthority(dallasShapes[0], { communities: [{ ...dallas, radiusMiles: 7 }], selectedAwarenessArea: { ...dallas, radiusMiles: 7 } });
assert.deepStrictEqual(JSON.parse(JSON.stringify(geojson.normalizedGeometry.coordinates[0])), [-96.801, 32.7857], 'GeoJSON longitude/latitude order is preserved');
const swapped = record('swapped', 'Lane Closure', 32.7767, -96.797, { type: 'LineString', coordinates: [[32.77, -96.80], [32.78, -96.79]] });
assert.strictEqual(select([swapped]).recordProof[0].sourceGeometryValid, false, 'swapped GeoJSON coordinates fail closed');
const malformed = record('malformed', 'Lane Closure', 32.7767, -96.797, { type: 'LineString', coordinates: [[-96.8, 32.77], ['bad', 32.78]] });
assert.strictEqual(select([malformed]).recordProof[0].sourceGeometryValid, false, 'malformed geometry fails closed');

const fortWorth = { key: 'place-4827000', label: 'Fort Worth', countyId: 'tarrant-tx', lat: 32.7555, lng: -97.3308 };
assert.strictEqual(select(dallasShapes, fortWorth).authorityEligibleRecordCount, 0, 'community transition does not leak Dallas records');
assert.strictEqual(dallas.key, 'place-4819000');
assert.deepStrictEqual(dallas.countyIds, ['collin-tx', 'dallas-tx', 'denton-tx', 'kaufman-tx', 'rockwall-tx'], 'Dallas multi-county identity stays canonical');

console.log('LP214 Dallas geographic authority focused repair tests passed');
