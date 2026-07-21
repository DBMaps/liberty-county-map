const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const start = app.indexOf('function gridlyLp0391SafeArray');
const endExport = 'window.gridlyLp0391DriveTexasAuthorityFoundationAudit = gridlyLp0391DriveTexasAuthorityFoundationAudit; }';
const end = app.indexOf(endExport, start);
assert(start >= 0, 'LP039.1 authority foundation source exists');
assert(end > start, 'LP039.1 authority foundation export exists');
const source = app.slice(start, end + endExport.length);
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'lp0391-authority-foundation.js' });

assert.strictEqual(typeof sandbox.window.gridlySelectDriveTexasAuthority, 'function', 'authority selector exists');
assert.strictEqual(typeof sandbox.window.gridlyGetDriveTexasAuthoritySnapshot, 'function', 'snapshot exists');
assert.strictEqual(typeof sandbox.window.gridlyLp0391DriveTexasAuthorityFoundationAudit, 'function', 'audit helper exists');

const selectedAwarenessArea = { label: 'Liberty', storageValue: 'liberty-tx', countyId: 'liberty', lat: 30.05, lng: -94.8 };
const nowMs = Date.parse('2026-07-21T12:00:00Z');
const authority = sandbox.window.gridlySelectDriveTexasAuthority({
  selectedAwarenessArea,
  nowMs,
  records: [
    { id: 'dt-1', title: 'Road Closed', routeName: 'FM 1409', county: 'Liberty', latitude: 30.05, longitude: -94.8, lastUpdated: '2026-07-21T11:30:00Z' },
    { id: 'dt-1', title: 'Road Closed duplicate', routeName: 'FM 1409', county: 'Liberty', latitude: 30.05, longitude: -94.8, lastUpdated: '2026-07-21T11:35:00Z' },
    { id: 'dt-expired', title: 'Expired closure', routeName: 'US 90', county: 'Liberty', lastUpdated: '2026-07-21T08:00:00Z', endTime: '2026-07-21T09:00:00Z' },
    { id: 'dt-stale', title: 'Stale crash', routeName: 'SH 105', county: 'Liberty', lastUpdated: '2026-07-20T01:00:00Z' },
    { id: 'dt-future', title: 'Future work', routeName: 'TX 321', county: 'Liberty', startTime: '2026-07-22T01:00:00Z', lastUpdated: '2026-07-21T11:00:00Z' },
    { id: 'dt-missing', title: 'Missing timestamp', routeName: 'FM 1011', county: 'Liberty' }
  ]
});

['selectedAwarenessArea','activeCounty','activeCommunity','authorityStatus','provider','providerRecordCount','normalizedRecordCount','uniqueProviderRecordCount','consumerSituationCount','uniqueSituationCount','providerOwnership','geographicOwnership','roadwayOwnership','freshnessOwnership','deduplicationOwnership','consumerEligibilityOwnership','ownershipMethod','ownershipConfidence','fallbackUsed','fallbackReason','quietStateReason','containsDriveTexas','containsOfficialSituations','sourceAvailability','consumerEligibleSituations','expiredRecords','duplicateRecords','staleRecords','futureEffectiveRecords','missingTimestampRecords','roadwayEvidence','locationEvidence'].forEach((key) => assert(Object.prototype.hasOwnProperty.call(authority, key), `authority contract exposes ${key}`));
assert.strictEqual(authority.providerRecordCount, 6);
assert.strictEqual(authority.uniqueProviderRecordCount, 5);
assert.strictEqual(authority.duplicateRecordCount, 1, 'deduplication exists');
assert.strictEqual(authority.expiredRecordCount, 1, 'freshness expired exists');
assert.strictEqual(authority.staleRecordCount, 1, 'freshness stale exists');
assert.strictEqual(authority.futureEffectiveRecordCount, 1, 'freshness future effective exists');
assert.strictEqual(authority.missingTimestampRecordCount, 1, 'freshness missing timestamp exists');
assert(authority.roadwayEvidence.every((entry) => Object.prototype.hasOwnProperty.call(entry, 'roadwayOwnershipConfidence')), 'roadway ownership exists');
assert(authority.locationEvidence.every((entry) => Object.prototype.hasOwnProperty.call(entry, 'ownershipMethod')), 'geographic ownership exists');
assert.strictEqual(authority.containsOfficialSituations, false, 'official situations remain presentation only by default');

const snapshot = sandbox.window.gridlyGetDriveTexasAuthoritySnapshot({ selectedAwarenessArea, nowMs, records: [] });
assert(snapshot.authority && snapshot.counts && snapshot.sourceAvailability, 'snapshot exposes authority, counts, source availability');
assert.strictEqual(snapshot.quietState, 'no loaded records');

const audit = sandbox.window.gridlyLp0391DriveTexasAuthorityFoundationAudit();
assert.strictEqual(audit.authorityEnginePresent, true);
assert.strictEqual(audit.selectorPresent, true);
assert.strictEqual(audit.snapshotPresent, true);
assert.strictEqual(audit.authorityContractReady, true);
assert.strictEqual(audit.officialSituationIntegrated, false);
assert.strictEqual(audit.consumerMigrationPerformed, false);
assert.strictEqual(audit.implementationStatus, 'FOUNDATION_COMPLETE');
assert.strictEqual(audit.recommendedNextMilestone, 'LP039.2');
['passive','noFetches','noPolling','noWrites','noStorageWrites','noMapMovement','noRuntimeActivation'].forEach((key) => assert.strictEqual(audit[key], true, key));

assert(!source.includes('fetch('), 'passive: no fetches');
assert(!source.includes('setTimeout('), 'passive: no timeout polling');
assert(!source.includes('setInterval('), 'passive: no interval polling');
assert(!source.includes('localStorage'), 'passive: no localStorage writes');
assert(!source.includes('sessionStorage'), 'passive: no sessionStorage writes');
assert(!source.includes('startPolling('), 'passive: no runtime activation');
assert(!source.includes('setView('), 'passive: no map movement');
assert(!source.includes('renderGridlyDriveTexasOfficialMarkers'), 'no UI migration: markers untouched');
assert(!source.includes('gridlyRenderTravelBrief'), 'no UI migration: travel brief untouched');
console.log('LP039.1 DriveTexas authority foundation tests passed');
