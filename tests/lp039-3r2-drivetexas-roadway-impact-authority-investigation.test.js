const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const now = Date.parse('2026-07-21T12:00:00Z');
const dayton = { id: 'dayton', label: 'Dayton', storageValue: 'dayton', countyId: 'liberty-tx', lat: 30.0466, lng: -94.8852, radiusMiles: 8 };
const sandbox = { console, Date, Math, Object, Array, Number, String, Boolean, RegExp, Set, Map, URLSearchParams, window: null, getGridlySelectedAwarenessArea: () => dayton };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(`
function gridlySelectDriveTexasAuthority(input = {}) { return Object.freeze({ selectedAwarenessArea: input.selectedAwarenessArea || getGridlySelectedAwarenessArea(), activeCounty: (input.selectedAwarenessArea || getGridlySelectedAwarenessArea()).countyId, activeCommunity: (input.selectedAwarenessArea || getGridlySelectedAwarenessArea()).label, consumerEligibleSituations: [], roadwayEvidence: [] }); }
function gridlyGetDriveTexasAuthoritySnapshot(input = {}) { const authority = gridlySelectDriveTexasAuthority(input); return Object.freeze({ authority, selectedAwarenessArea: authority.selectedAwarenessArea, activeCounty: authority.activeCounty, activeCommunity: authority.activeCommunity }); }
window.gridlySelectDriveTexasAuthority = gridlySelectDriveTexasAuthority;
window.gridlyGetDriveTexasAuthoritySnapshot = gridlyGetDriveTexasAuthoritySnapshot;
`, sandbox);
vm.runInContext(fs.readFileSync('js/gridlyDriveTexasAuthoritySourceIntegration.js', 'utf8'), sandbox, { filename: 'js/gridlyDriveTexasAuthoritySourceIntegration.js' });

function rec(id, lat, lng, extra = {}) {
  return Object.assign({ sourceId: id, providerId: id, id, category: 'Crash', headline: `${id} crash`, routeName: 'SH 321', latitude: lat, longitude: lng, updateTime: '2026-07-21T11:30:00Z', startTime: '2026-07-21T10:00:00Z', endTime: '2026-07-21T18:00:00Z' }, extra);
}
const records = [
  rec('outside-point', 30.22, -94.88),
  rec('line-geometry', 30.23, -94.88, { geometry: { type: 'LineString', coordinates: [[-94.90, 30.10], [-94.86, 30.22]] }, fromLimit: 'A', toLimit: 'B' }),
  rec('inside-point', 30.05, -94.88)
];
const before = sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ records, selectedAwarenessArea: dayton, nowMs: now });
const audit = sandbox.gridlyLp0393r2DriveTexasRoadwayImpactAuthorityInvestigationAudit({ records, selectedAwarenessArea: dayton, nowMs: now });
const after = sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ records, selectedAwarenessArea: dayton, nowMs: now });

assert.strictEqual(typeof sandbox.gridlyLp0393r2DriveTexasRoadwayImpactAuthorityInvestigationAudit, 'function', 'helper exists');
assert.strictEqual(audit.investigationOnly, true, 'audit is investigation-only');
assert.strictEqual(audit.noFetches && audit.noPolling && audit.noWrites && audit.noStorageWrites, true, 'helper is passive and does not fetch, poll, or write');
assert.deepStrictEqual(after.consumerVisibleSituations, before.consumerVisibleSituations, 'audit does not alter production authority selection');
assert(audit.currentAuthorityContract.acceptedOwnershipMethods.includes('valid_source_point_inside_awareness_radius_miles'), 'current point method is reported');
assert.strictEqual(audit.currentAuthorityContract.pointContainmentRequired, true, 'point containment is distinct and required today');
assert.strictEqual(audit.currentAuthorityContract.sourceGeometryIntersectionUsed, false, 'source geometry is distinguished from point containment');
assert.strictEqual(audit.currentAuthorityContract.routeNameOnlyAccepted, false, 'route-name-only matching is not accepted');
assert.strictEqual(audit.currentAuthorityContract.certifiedRoadwayIntersectionUsed, false, 'certified roadway intersection is not a current gate');
assert(audit.sourceInventory.recordsWithLineGeometry >= 1, 'source line geometry is inventoried');
assert(audit.preservationTrace.firstGeometryLossStage, 'geometry preservation/loss stage is reported');
assert(audit.rootCause.classification, 'root-cause classification is produced');
assert(audit.recommendation.conclusion, 'authority recommendation is produced');
assert.strictEqual(audit.recommendation.rejectedRepairs.includes('Dayton-specific logic'), true, 'Dayton-specific production logic is rejected');
assert.strictEqual(audit.recommendation.rejectedRepairs.includes('Liberty-specific logic'), true, 'Liberty-specific production logic is rejected');
assert.strictEqual(audit.recommendation.rejectedRepairs.includes('arbitrary radius widening'), true, 'arbitrary radius widening is rejected');
assert.strictEqual(audit.recommendation.rejectedRepairs.includes('route-name-only ownership'), true, 'route-name-only fallback is rejected');
assert.strictEqual(audit.daytonNearestRecords.length, 3, 'nearest record output remains compact');
assert(audit.daytonNearestRecords.some((r) => r.rawGeometryType === 'LineString' && r.geographicIntersectionProvenWithoutRouteNameOnlyMatching === false), 'record distinguishes source geometry from proven awareness intersection');
assert.strictEqual(before.consumerVisibleSituationCount, 2, 'production authority now includes source geometry intersection and point fallback records');
console.log('LP039.3R2 DriveTexas roadway impact authority investigation checks passed');
