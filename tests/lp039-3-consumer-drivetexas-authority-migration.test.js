const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const now = Date.parse('2026-07-21T12:00:00Z');
const selectedAwarenessArea = { id: 'woodville', label: 'Woodville', storageValue: 'woodville', countyId: 'tyler', lat: 30.7752, lng: -94.4155, radiusMiles: 8 };
const sandbox = { console, Date, Math, URLSearchParams, setTimeout() {}, clearTimeout() {}, window: null, document: { head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return { classList: { add() {}, remove() {}, toggle() {} }, dataset: {}, style: {}, appendChild() {}, replaceChildren() {}, setAttribute() {}, addEventListener() {} }; } }, navigator: {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, getGridlySelectedAwarenessArea: () => selectedAwarenessArea, addEventListener() {}, removeEventListener() {}, crypto: { randomUUID() { return "test-uuid"; } }, location: { search: "", hash: "", href: "http://localhost/" } };
sandbox.window = sandbox;
vm.createContext(sandbox);

vm.runInContext(`
function gridlySelectDriveTexasAuthority(input = {}) {
  const records = Array.isArray(input.records) ? input.records : [];
  return Object.freeze({ selectedAwarenessArea: input.selectedAwarenessArea || getGridlySelectedAwarenessArea(), activeCounty: (input.selectedAwarenessArea || getGridlySelectedAwarenessArea()).countyId, activeCommunity: (input.selectedAwarenessArea || getGridlySelectedAwarenessArea()).label, authorityStatus: records.length ? 'active' : 'quiet', consumerEligibleSituations: records, roadwayEvidence: records.map(() => ({ roadwayOwnershipConfidence: 'source_roadway' })), sourceAvailability: { providerAvailable: input.providerAvailable !== false, connectorAvailable: input.connectorAvailable !== false, fetchFailed: input.fetchFailed === true }, quietStateReason: records.length ? null : 'no_loaded_records' });
}
function gridlyGetDriveTexasAuthoritySnapshot(input = {}) { const authority = gridlySelectDriveTexasAuthority(input); return Object.freeze({ authority, selectedAwarenessArea: authority.selectedAwarenessArea, activeCounty: authority.activeCounty, activeCommunity: authority.activeCommunity }); }
function gridlyStoryTransportationConnectorRecords() { if (typeof window.gridlySelectConsumerVisibleDriveTexasSituations === 'function') { const consumer = window.gridlySelectConsumerVisibleDriveTexasSituations(); return Array.isArray(consumer?.consumerVisibleSituations) ? consumer.consumerVisibleSituations : []; } return []; }
window.gridlySelectDriveTexasAuthority = gridlySelectDriveTexasAuthority;
window.gridlyGetDriveTexasAuthoritySnapshot = gridlyGetDriveTexasAuthoritySnapshot;
window.gridlyStoryTransportationConnectorRecords = gridlyStoryTransportationConnectorRecords;
`, sandbox, { filename: 'lp039-3-foundation-stub.js' });
vm.runInContext(fs.readFileSync('js/gridlyDriveTexasAuthoritySourceIntegration.js', 'utf8'), sandbox, { filename: 'js/gridlyDriveTexasAuthoritySourceIntegration.js' });

function rec(id, category, title, lat, lon, extra = {}) {
  return Object.assign({ id, sourceId: id, providerId: id, category, headline: title, description: `${title} on official roadway`, routeName: extra.routeName || 'US 190', roadway: extra.roadway || 'US 190', city: extra.city || 'Woodville', county: extra.county || 'Tyler', latitude: lat, longitude: lon, updateTime: '2026-07-21T11:30:00Z', startTime: '2026-07-21T10:00:00Z', endTime: '2026-07-21T18:00:00Z' }, extra);
}
const fixtures = [
  rec('crash-1', 'Crash', 'Crash reported', 30.776, -94.416),
  rec('closure-1', 'Road Closure', 'Road closed', 30.777, -94.417),
  rec('flood-1', 'Flooding', 'High water', 30.778, -94.418),
  rec('construction-1', 'Construction', 'Construction', 30.779, -94.419),
  rec('lane-1', 'Lane Closure', 'Lane closure', 30.780, -94.420),
  rec('bridge-1', 'Bridge Restriction', 'Bridge restriction', 30.781, -94.421),
  rec('advisory-1', 'Travel Advisory', 'Travel advisory', 30.782, -94.422),
  rec('crash-1', 'Crash', 'Duplicate provider ID', 30.783, -94.423),
  rec('event-source-a', 'Crash', 'Duplicate event A', 30.784, -94.424, { eventId: 'event-dup', sourceId: null }),
  rec('event-source-b', 'Crash', 'Duplicate event B', 30.785, -94.425, { eventId: 'event-dup', sourceId: null }),
  rec('same-title-a', 'Crash', 'Same title', 30.786, -94.426),
  rec('same-title-b', 'Crash', 'Same title', 30.787, -94.427),
  rec('expired', 'Crash', 'Expired', 30.776, -94.416, { endTime: '2026-07-21T09:00:00Z' }),
  rec('stale', 'Crash', 'Stale', 30.776, -94.416, { updateTime: '2026-07-20T01:00:00Z' }),
  rec('future', 'Crash', 'Future', 30.776, -94.416, { startTime: '2026-07-22T09:00:00Z' }),
  rec('missing-time', 'Crash', 'Missing timestamp', 30.776, -94.416, { updateTime: null, startTime: null, endTime: null }),
  rec('invalid-coordinate', 'Crash', 'Invalid coordinate', 10, 10),
  rec('reversed-coordinate', 'Crash', 'Reversed coordinate', -94.416, 30.776),
  rec('outside', 'Crash', 'Outside awareness', 31.55, -95.1),
  rec('route-only', 'Crash', 'Route only', null, null),
  rec('text-only', 'Crash', 'Woodville text only', null, null, { routeName: null, roadway: null }),
  rec('retained-only', 'Crash', 'Retained only', 30.776, -94.416, { connectorRetained: true, lastSuccessfulFallback: true })
];

const selector = sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ records: fixtures, selectedAwarenessArea, nowMs: now });
assert.strictEqual(typeof sandbox.gridlySelectConsumerVisibleDriveTexasSituations, 'function', 'consumer selector exists');
assert.strictEqual(typeof sandbox.gridlyGetDriveTexasAuthoritySnapshot, 'function', 'authority snapshot exists');
assert.strictEqual(selector.authorityEligibilityCertified, true, 'LP039.2R1 proof certification remains intact');
assert.strictEqual(selector.unprovenEligibleRecordCount, 0, 'no unproven eligible records are admitted');
assert.strictEqual(selector.consumerVisibleSituationCount, 10, 'only unique active proof-backed records are visible');
assert.strictEqual(selector.uniqueSituationCount, selector.consumerVisibleSituationCount, 'visible count owns unique situations');
assert(selector.consumerVisibleSituations.every((s) => s.sourceCoordinates && s.freshnessStatus === 'active'), 'visible situations expose certified coordinates and active freshness');
assert(!selector.consumerVisibleSituations.some((s) => /expired|stale|future|missing|invalid|outside|route only|text only/i.test(s.headline)), 'excluded lifecycle/location/text-only records cannot bypass authority');
assert.strictEqual(selector.consumerVisibleSituations.filter((s) => s.providerId === 'crash-1').length, 1, 'duplicate provider IDs are not double counted');
assert.strictEqual(selector.consumerVisibleSituations.filter((s) => /Duplicate event/.test(s.headline)).length, 1, 'duplicate event IDs are not double counted');
assert.strictEqual(selector.consumerVisibleSituations.filter((s) => s.headline === 'Same title').length, 2, 'distinct same-title records remain distinct');

const audit = sandbox.gridlyLp0393ConsumerDriveTexasAuthorityMigrationAudit();
assert.strictEqual(audit.consumerSelectorPresent, true);
assert.strictEqual(audit.consumerMigrationPerformed, true);
assert.strictEqual(audit.rawProviderCountDiagnosticOnly, true);
assert.strictEqual(audit.normalizedCountDiagnosticOnly, true);
assert.strictEqual(audit.connectorRetainedCountDiagnosticOnly, true);
assert.strictEqual(audit.connectorAwarenessCountDiagnosticOnly, true);
assert.strictEqual(audit.officialSituationCountDiagnosticOnly, true);
['markerUsesAuthority','markerPopupUsesAuthority','alertPanelUsesAuthority','awarenessBriefUsesAuthority','communityPulseUsesAuthority','travelBriefUsesAuthority','knowBeforeYouGoUsesAuthority','activeConditionsUseAuthority','countySummaryUsesAuthority','communitySummaryUsesAuthority','houstonParentUsesAuthority','houstonChildRegionsUseAuthority','pasadenaUsesAuthority','springBranchUsesAuthority'].forEach((key) => assert.strictEqual(audit[key], true, `${key} is authority-owned`));
assert.strictEqual(audit.officialSituationConsumesAuthority, true);
assert.strictEqual(audit.officialSituationAuthorityOwner, false);
assert.strictEqual(audit.legacyVisibleOwnersRemaining, 0);
assert.strictEqual(audit.compatibilityBypassDetected, false);
assert.strictEqual(audit.consumerLanguageTechnicalLeakDetected, false);
assert.strictEqual(audit.remainingDivergence, 'none');
assert.strictEqual(audit.allMigratedConsumerSurfacesUseAuthority, true);
assert.strictEqual(audit.implementationStatus, 'CONSUMER_MIGRATION_COMPLETE');
assert.strictEqual(audit.noFetches && audit.noPolling && audit.noStorageWrites && audit.noMapMovement, true, 'audit remains passive');

const quietStates = [
  [{ records: [], selectedAwarenessArea, nowMs: now }, 'No official roadway records are loaded yet.'],
  [{ records: [], selectedAwarenessArea, nowMs: now, providerAvailable: false }, 'Official roadway information is currently unavailable.'],
  [{ records: [], selectedAwarenessArea, nowMs: now, connectorAvailable: false }, 'Official roadway information is currently unavailable.'],
  [{ records: [], selectedAwarenessArea, nowMs: now, fetchFailed: true }, 'Official roadway information is currently unavailable.'],
  [{ records: [rec('all-outside', 'Crash', 'All outside', 31.55, -95.1)], selectedAwarenessArea, nowMs: now }, 'No active official roadway advisories are confirmed for this area.'],
  [{ records: [rec('all-stale', 'Crash', 'All stale', 30.776, -94.416, { updateTime: '2026-07-20T01:00:00Z' })], selectedAwarenessArea, nowMs: now }, 'No active official roadway advisories are confirmed for this area.']
];
quietStates.forEach(([input, meaning]) => assert.strictEqual(sandbox.gridlySelectConsumerVisibleDriveTexasSituations(input).quietStateConsumerMeaning, meaning));



const dayton = { id: 'dayton', label: 'Dayton', storageValue: 'dayton', countyId: 'liberty-tx', lat: 30.0466, lng: -94.8852, radiusMiles: 8 };
const woodville = selectedAwarenessArea;
const pearland = { id: 'pearland', label: 'Pearland', storageValue: 'pearland', countyId: 'brazoria-tx', lat: 29.5636, lng: -95.2860, radiusMiles: 8 };
function daytonOffset(id, milesNorth, extra = {}) { return rec(id, 'Crash', id, dayton.lat + (milesNorth / 69), dayton.lng, Object.assign({ city: 'Dayton', county: 'Liberty', routeName: 'SH 321', roadway: 'SH 321' }, extra)); }
const daytonRecords = [
  daytonOffset('one-mile', 1),
  daytonOffset('seven-mile', 7, { roadwayOwnershipConfidence: 'low' }),
  daytonOffset('missing-roadway', 2, { routeName: null, roadway: null, canonicalRoad: null }),
  daytonOffset('stale-dayton', 3, { updateTime: '2026-07-20T01:00:00Z' }),
  daytonOffset('nine-mile', 9)
];
const daytonSelector = sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ records: daytonRecords, selectedAwarenessArea: dayton, nowMs: now });
const daytonIds = daytonSelector.consumerVisibleSituations.map((s) => s.providerId).sort();
assert(daytonIds.includes('one-mile'), 'record one mile from Dayton appears');
assert(daytonIds.includes('seven-mile'), 'record seven miles from Dayton appears');
assert(daytonIds.includes('missing-roadway'), 'missing optional roadway fields do not reject valid geographic ownership');
assert(!daytonIds.includes('nine-mile'), 'record nine miles from Dayton does not appear');
assert(!daytonIds.includes('stale-dayton'), 'stale record inside Dayton remains excluded');
assert(daytonSelector.consumerVisibleSituations.every((s) => s.recordProof && s.eligibleRecordProof), 'recordProof and eligibleRecordProof survive into consumer projection');
assert(daytonSelector.consumerVisibleSituations.every((s) => s.sourceCoordinates && typeof s.sourceCoordinates.latitude === 'number' && typeof s.sourceCoordinates.longitude === 'number'), 'sourceCoordinates survive unchanged as application lat/lng');
assert(daytonSelector.consumerVisibleSituations.every((s) => s.selectedAwarenessRadiusMiles === 8), 'Dayton eight-mile radius survives through selector');
assert(daytonSelector.consumerVisibleSituations.some((s) => s.providerId === 'seven-mile'), 'low roadway confidence does not replace point-in-radius authority');
const daytonSnap = sandbox.gridlyGetDriveTexasAuthoritySnapshot({ records: daytonRecords, selectedAwarenessArea: dayton, nowMs: now });
assert.strictEqual(daytonSnap.selectedAwarenessArea.id, 'dayton', 'Dayton selected awareness survives snapshot');
assert.strictEqual(daytonSnap.selectedAwarenessRadiusMiles, 8, 'Dayton radius remains eight miles in snapshot');
assert.strictEqual(daytonSnap.authority.activeRecordCount + daytonSnap.authority.staleRecordCount + daytonSnap.authority.expiredRecordCount + daytonSnap.authority.futureEffectiveRecordCount + daytonSnap.authority.missingTimestampRecordCount, daytonSnap.authority.freshnessEvaluatedRecordCount, 'active and stale counts reconcile with canonical freshness totals');
assert.strictEqual(daytonSnap.authority.freshnessCountsReconciled, true, 'freshness counts are reconciled');
assert.strictEqual(daytonSnap.authority.eligibleRecordProof.some((p) => p.sourceId === 'nine-mile'), false, 'LP039.2 rejected record remains rejected');
assert.strictEqual(daytonSnap.authority.consumerEligibleSituations.length, daytonSelector.lp0393ConsumerProjectionInputCount, 'LP039.2 eligible set feeds LP039.3 projection');
assert.deepStrictEqual(daytonSelector.markerInputSituations, daytonSelector.consumerVisibleSituations, 'marker input receives certified consumer situation set');
assert.deepStrictEqual(daytonSelector.alertInputSituations, daytonSelector.consumerVisibleSituations, 'alert input receives certified consumer situation set');
assert.deepStrictEqual(daytonSelector.travelBriefInputSituations, daytonSelector.consumerVisibleSituations, 'Travel Brief input receives certified set before consolidation');
const woodvilleZero = sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ records: [daytonOffset('woodville-zero', 1)], selectedAwarenessArea: woodville, nowMs: now });
const afterWoodvilleDayton = sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ records: daytonRecords, selectedAwarenessArea: dayton, nowMs: now });
assert.strictEqual(woodvilleZero.consumerVisibleSituationCount, 0, 'Woodville context excludes Dayton record without caching');
assert(afterWoodvilleDayton.consumerVisibleSituationCount > 0, 'Woodville to Dayton switch recomputes authority');
const pearlandZero = sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ records: [daytonOffset('pearland-zero', 1)], selectedAwarenessArea: pearland, nowMs: now });
const afterPearlandDayton = sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ records: daytonRecords, selectedAwarenessArea: dayton, nowMs: now });
assert.strictEqual(pearlandZero.consumerVisibleSituationCount, 0, 'Pearland context excludes Dayton record without caching');
assert(afterPearlandDayton.consumerVisibleSituationCount > 0, 'Pearland to Dayton switch recomputes authority');
assert.strictEqual(afterPearlandDayton.selectedAwarenessArea.id, 'dayton', 'no cached selected-awareness object remains from prior area');
const reducedAuthorityInput = daytonSnap.authority.consumerEligibleSituations.map(({ sourceId, category, headline }) => ({ sourceId, category, headline }));
const reducedSelector = sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ records: reducedAuthorityInput, selectedAwarenessArea: dayton, nowMs: now });
assert.strictEqual(reducedSelector.consumerVisibleSituationCount, 0, 'consumer selector does not recalculate ownership from reduced fields');
assert.strictEqual(reducedSelector.unprovenEligibleRecordCount, 0, 'no unsupported fallback is admitted');
assert(!reducedSelector.consumerVisibleSituations.some((s) => !s.recordProof?.finalEligibility), 'no raw provider or connector bypass is restored');
assert.strictEqual(typeof sandbox.gridlyLp0393DaytonDriveTexasAuthorityTraceAudit, 'function', 'Dayton passive trace audit is exposed');

assert.strictEqual(sandbox.gridlyStoryTransportationConnectorRecords().length, 0, 'compatibility reader delegates to selector, not connector fallback');
console.log('LP039.3 consumer DriveTexas authority migration checks passed');
