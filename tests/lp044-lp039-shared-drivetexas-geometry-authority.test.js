const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const shared = require('../js/gridlyDriveTexasGeometryAuthority.js');
const { build } = require('../js/gridlyLp044DriveTexasCommunityAuthorityInventory.js');

const nowMs = Date.parse('2026-07-21T12:00:00Z');
const alpha = { key: 'alpha', label: 'Alpha', countyId: 'county-a', lat: 30.0, lng: -95.0, radiusMiles: 3 };
const beta = { key: 'beta', label: 'Beta', countyId: 'county-a', lat: 30.0, lng: -94.94, radiusMiles: 3 };
const far = { key: 'far', label: 'Far', countyId: 'county-b', lat: 31.0, lng: -96.0, radiusMiles: 3 };
const communities = [alpha, beta, far];
const counties = [{ countyId: 'county-a', countyName: 'County A' }, { countyId: 'county-b', countyName: 'County B' }];
const active = alpha;
const line = { sourceId: 'line-1', id: 'line-1', category: 'Road Closure', headline: 'Line', routeName: 'SH 1', geometry: { type: 'LineString', coordinates: [[-95.02, 30], [-94.94, 30]] }, updateTime: '2026-07-21T11:00:00Z', startTime: '2026-07-21T10:00:00Z', endTime: '2026-07-21T18:00:00Z' };
const outside = { ...line, sourceId: 'outside-1', id: 'outside-1', geometry: { type: 'LineString', coordinates: [[-96.5, 31], [-96.4, 31]] } };

const lp044Row = build({ records: [line], communities, counties, selectedAwarenessArea: active }).records[0];
const sharedResult = shared.qualify(line, { communities, counties, selectedAwarenessArea: active });
assert.deepStrictEqual({ geometryQualified: sharedResult.geometryQualified, communityIdsIntersected: sharedResult.communityIdsIntersected, countyIdsIntersected: sharedResult.countyIdsIntersected, ownershipMethod: sharedResult.ownershipMethod, rejectionReason: sharedResult.rejectionReason }, { geometryQualified: true, communityIdsIntersected: lp044Row.communityIdsIntersected, countyIdsIntersected: lp044Row.countyIdsIntersected, ownershipMethod: 'trusted_source_geometry_intersects_awareness_radius', rejectionReason: null }, 'LP044 projects the shared geometry authority result');

const sandbox = { console, Date, Math, URLSearchParams, setTimeout() {}, clearTimeout() {}, window: null, getGridlySelectedAwarenessArea: () => active };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext('function gridlySelectDriveTexasAuthority(input = {}) { return Object.freeze({ selectedAwarenessArea: input.selectedAwarenessArea || getGridlySelectedAwarenessArea(), consumerEligibleSituations: [] }); } window.gridlySelectDriveTexasAuthority = gridlySelectDriveTexasAuthority;', sandbox);
vm.runInContext(fs.readFileSync('js/gridlyDriveTexasGeometryAuthority.js', 'utf8'), sandbox, { filename: 'js/gridlyDriveTexasGeometryAuthority.js' });
vm.runInContext(fs.readFileSync('js/gridlyDriveTexasAuthoritySourceIntegration.js', 'utf8'), sandbox, { filename: 'js/gridlyDriveTexasAuthoritySourceIntegration.js' });
const selected = sandbox.gridlySelectDriveTexasAuthority({ records: [line, outside], selectedAwarenessArea: active, nowMs });
const eligible = selected.recordProof.find((p) => p.sourceId === 'provider:line-1');
const excluded = selected.recordProof.find((p) => p.sourceId === 'provider:outside-1');
assert.strictEqual(eligible.finalEligibility, true, 'geometry-qualified LP039 record is eligible');
assert.strictEqual(eligible.geographicOwnershipMethod, sharedResult.ownershipMethod, 'LP039 ownership method matches shared authority');
assert.strictEqual(eligible.sourceGeometryIntersectsSelectedAwareness, sharedResult.geometryQualified, 'LP039 geometry qualification matches shared authority');
assert(selected.consumerEligibleSituations.some((r) => r.sourceId === 'provider:line-1'), 'geometry-qualified record is consumer-visible for the active intersected community');
assert(!sandbox.gridlySelectDriveTexasAuthority({ records: [line], selectedAwarenessArea: far, nowMs }).consumerEligibleSituations.length, 'same record is excluded for non-intersected communities');
assert.strictEqual(excluded.finalEligibility, false, 'outside-coverage record remains excluded');

const lp039Source = fs.readFileSync('js/gridlyDriveTexasAuthoritySourceIntegration.js', 'utf8');
const lp044Source = fs.readFileSync('js/gridlyLp044DriveTexasCommunityAuthorityInventory.js', 'utf8');
assert(lp039Source.includes('gridlyQualifyDriveTexasGeometryAuthority(record'), 'LP039 calls the shared geometry authority implementation');
assert(lp044Source.includes('gridlyQualifyDriveTexasGeometryAuthority(r'), 'LP044 calls the shared geometry authority implementation');
assert(!lp039Source.includes('geometryIntersectionProof(trustedGeometry'), 'LP039 no longer invokes its former independent geometry intersection implementation');
console.log('LP044/LP039 shared DriveTexas geometry authority regression tests passed');
