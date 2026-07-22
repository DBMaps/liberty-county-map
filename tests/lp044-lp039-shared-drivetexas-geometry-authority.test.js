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

let activeSelection = alpha;
const activeSandbox = { console, Date, Math, URLSearchParams, setTimeout() {}, clearTimeout() {}, window: null, getGridlySelectedAwarenessArea: () => activeSelection };
activeSandbox.window = activeSandbox;
vm.createContext(activeSandbox);
vm.runInContext('function gridlySelectDriveTexasAuthority(input = {}) { return Object.freeze({ selectedAwarenessArea: input.selectedAwarenessArea, activeCounty: input.activeCounty || input.selectedAwarenessArea?.countyId || null, activeCommunity: input.activeCommunity || input.selectedAwarenessArea?.label || null, consumerEligibleSituations: [] }); } window.gridlySelectDriveTexasAuthority = gridlySelectDriveTexasAuthority;', activeSandbox);
vm.runInContext(fs.readFileSync('js/gridlyDriveTexasGeometryAuthority.js', 'utf8'), activeSandbox, { filename: 'js/gridlyDriveTexasGeometryAuthority.js' });
vm.runInContext(fs.readFileSync('js/gridlyDriveTexasAuthoritySourceIntegration.js', 'utf8'), activeSandbox, { filename: 'js/gridlyDriveTexasAuthoritySourceIntegration.js' });
vm.runInContext(fs.readFileSync('js/gridlyLp044DriveTexasCommunityAuthorityInventory.js', 'utf8'), activeSandbox, { filename: 'js/gridlyLp044DriveTexasCommunityAuthorityInventory.js' });

const alphaLp039 = activeSandbox.gridlySelectDriveTexasAuthority({ records: [line], nowMs });
const alphaProof = alphaLp039.recordProof[0];
const alphaLp044 = activeSandbox.gridlyBuildLp044DriveTexasCommunityAuthorityInventory({ records: [line], communities, counties, nowMs }).records[0];
assert.strictEqual(alphaLp039.selectedAwarenessArea, alpha, 'LP039 passes the current active awareness object when no injected selection is provided');
assert.strictEqual(alphaProof.finalEligibility, true, 'LP039 qualifies active Alpha geometry');
assert.strictEqual(alphaLp044.currentLp039Eligibility, alphaProof.finalEligibility, 'LP044 current LP039 projection uses the same active awareness object');
assert.strictEqual(alphaLp044.currentOwnershipMethod, alphaProof.geographicOwnershipMethod, 'LP044 and LP039 ownership methods match for active Alpha');
assert.strictEqual(alphaLp044.currentRejectionReason, null, 'LP044 and LP039 rejection reasons match for active Alpha');

assert.strictEqual(alphaLp044.globallyRelevant, true, 'LP044 reports global geographic relevance separately from active visibility');
assert.strictEqual(alphaLp044.activeConsumerVisible, true, 'LP044 active visibility matches runtime truth for an intersected active community');
assert.strictEqual(alphaLp044.currentConsumerVisible, alphaLp044.activeConsumerVisible, 'legacy current visibility is an explicit active-visibility alias');
assert.strictEqual(alphaLp044.visibleForIntersectedCommunity, true, 'LP044 reports visibility for at least one intersected community');
assert.notStrictEqual(alphaLp044.discrepancyClassification, 'GEOGRAPHICALLY_RELEVANT_BUT_NOT_VISIBLE', 'LP044 does not classify globally relevant records as invisible when an intersected active selection displays them');

activeSelection = far;
const farLp039 = activeSandbox.gridlySelectDriveTexasAuthority({ records: [line], nowMs });
const farProof = farLp039.recordProof[0];
const farLp044 = activeSandbox.gridlyBuildLp044DriveTexasCommunityAuthorityInventory({ records: [line], communities, counties, nowMs }).records[0];
assert.strictEqual(farLp039.selectedAwarenessArea, far, 'LP039 observes an active community change instead of stale Alpha awareness');
assert.strictEqual(farProof.finalEligibility, false, 'LP039 rejects the same geometry after active community changes to Far');
assert.strictEqual(farProof.geographicOwnershipMethod, 'not_established', 'LP039 ownership changes with the active community');
assert.strictEqual(farProof.ineligibilityReasons.includes('trusted_geometry_outside_selected_awareness'), true, 'LP039 rejection reason changes with the active community');
assert.strictEqual(farLp044.currentLp039Eligibility, farProof.finalEligibility, 'LP044 current projection changes identically with active community');
assert.strictEqual(farLp044.currentOwnershipMethod, farProof.geographicOwnershipMethod, 'LP044 ownership changes identically with active community');
assert.strictEqual(farLp044.currentRejectionReason, farProof.ineligibilityReasons.join('; '), 'LP044 rejection reason changes identically with active community');

assert.strictEqual(farLp044.globallyRelevant, true, 'LP044 keeps global relevance true when the active community is not intersected');
assert.strictEqual(farLp044.activeConsumerVisible, false, 'LP044 active visibility is false for a non-intersected active community');
assert.strictEqual(farLp044.activeAwarenessIntersectsRecord, false, 'LP044 identifies that the current active awareness does not intersect the record');
assert.strictEqual(farLp044.visibleForIntersectedCommunity, true, 'LP044 still reports that the record is visible under an appropriate intersected community selection');
assert.notStrictEqual(farLp044.discrepancyClassification, 'GEOGRAPHICALLY_RELEVANT_BUT_NOT_VISIBLE', 'runtime truth and LP044 inventory no longer contradict each other for inactive selections');
assert.strictEqual(activeSandbox.gridlySelectDriveTexasAuthority({ records: [line], selectedAwarenessArea: null, nowMs }).recordProof[0].finalEligibility, false, 'LP039 does not use home-town fallback awareness when active awareness is explicitly unavailable');

const lp039Source = fs.readFileSync('js/gridlyDriveTexasAuthoritySourceIntegration.js', 'utf8');
const lp044Source = fs.readFileSync('js/gridlyLp044DriveTexasCommunityAuthorityInventory.js', 'utf8');
assert(lp039Source.includes('gridlyQualifyDriveTexasGeometryAuthority(record'), 'LP039 calls the shared geometry authority implementation');
assert(lp044Source.includes('gridlyQualifyDriveTexasGeometryAuthority(r'), 'LP044 calls the shared geometry authority implementation');
assert(!lp039Source.includes('geometryIntersectionProof(trustedGeometry'), 'LP039 no longer invokes its former independent geometry intersection implementation');
console.log('LP044/LP039 shared DriveTexas geometry authority regression tests passed');
