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
function multi(id) { return { sourceId: id, category: 'Construction', geometry: { type: 'MultiLineString', coordinates: [[[-95.0, 30.0], [-94.99, 30.0]], [[-94.88, 30.0], [-94.87, 30.0]]] } }; }
function point(id, lat, lng) { return { sourceId: id, category: 'Flooding', latitude: lat, longitude: lng, geometry: { type: 'Point', coordinates: [lng, lat] } }; }

const records = [
  line('001', [[-95.08, 30], [-95.0, 30], [-94.94, 30], [-94.88, 30]]),
  multi('002'),
  line('003', [[-95.3, 30], [-95.2, 30]], { latitude: 30, longitude: -95.0 }),
  point('004', 31.5, -96.5),
  { sourceId: '005', category: 'Other' }
];
const productionSnapshot = { recordProof: [{ sourceId: '001', finalEligibility: false, geographicOwnershipMethod: 'not_established', ineligibilityReasons: ['example'] }], consumerEligibleSituations: [] };
const result = build({ records, communities, counties, productionSnapshot });

function countRows(rows, predicate) { return rows.filter(predicate).length; }
function expectedCoverage(rows) { return { insideGridlyCoverage: countRows(rows, r => r.insideGridlyCoverage === true), outsideGridlyCoverage: countRows(rows, r => r.geographicStatus === 'outside_gridly_coverage'), geographicallyUnresolved: countRows(rows, r => r.geographicStatus === 'geographically_unresolved'), malformed: countRows(rows, r => r.geographicStatus === 'malformed'), registryUnavailable: countRows(rows, r => r.geographicStatus === 'registry_unavailable') }; }
function expectedDiscrepancyCounts(rows) { return rows.reduce((m, r) => { if (r.discrepancyClassification) m[r.discrepancyClassification] = (m[r.discrepancyClassification] || 0) + 1; return m; }, {}); }
function expectedProductionDiscrepancies(rows) { return rows.filter(r => r.discrepancyClassification).map(r => ({ sourceId: r.sourceId, route: r.routeName, category: r.category, groundTruthCounties: r.countyNamesIntersected, groundTruthCommunities: r.communityNamesIntersected, currentOwnershipMethod: r.currentOwnershipMethod, currentEligibility: r.currentLp039Eligibility, currentRejectionReason: r.currentRejectionReason, classification: r.discrepancyClassification, firstProductionStageWhereCorrectGeographicRelationshipIsLost: r.firstProductionStageWhereLost })); }
function expectedCommunitySummaries(rows, defs) { return defs.map(cm => { const hits = rows.filter(r => r.communityIdsIntersected.includes(cm.key)); return { county: cm.countyName || null, community: cm.label, communityId: cm.key, intersectingDriveTexasRecordCount: hits.length, pointAuthorityRecordCount: countRows(hits, r => r.geometryType === 'Point' || r.geographicResolutionMethod.includes('point')), lineStringAuthorityRecordCount: countRows(hits, r => r.geometryType === 'LineString'), multiLineStringAuthorityRecordCount: countRows(hits, r => r.geometryType === 'MultiLineString'), activeConsumerVisibleCount: countRows(hits, r => r.activeConsumerVisible === true), activeConsumerExcludedCount: countRows(hits, r => r.activeConsumerVisible !== true), visibleForIntersectedCommunityCount: countRows(hits, r => r.visibleForIntersectedCommunity === true), notVisibleForIntersectedCommunityCount: countRows(hits, r => r.visibleForIntersectedCommunity !== true), currentlyConsumerVisibleCount: countRows(hits, r => r.activeConsumerVisible === true), currentlyExcludedCount: countRows(hits, r => r.activeConsumerVisible !== true), categoriesRepresented: [...new Set(hits.map(r => r.category).filter(Boolean))].sort(), routesRepresented: [...new Set(hits.map(r => r.routeName).filter(Boolean))].sort(), sampleSourceIds: hits.slice(0, 10).map(r => r.sourceId) }; }); }
function expectedCountySummaries(rows, countyDefs, communityDefs, communitySummaries) { return countyDefs.map(cy => { const hits = rows.filter(r => r.countyIdsIntersected.includes(cy.countyId)); return { countyId: cy.countyId, countyName: cy.countyName, registryAvailable: true, intersectingDriveTexasRecordCount: hits.length, recordsAssignedByGeometry: countRows(hits, r => r.geographicResolutionMethod === 'trusted_complete_roadway_geometry'), recordsAssignedByPointFallback: countRows(hits, r => r.geographicResolutionMethod === 'trusted_representative_point_fallback'), multiCountyRecordCount: countRows(hits, r => r.crossesMultipleCounties === true), activeConsumerVisibleCount: countRows(hits, r => r.activeConsumerVisible === true), activeConsumerExcludedCount: countRows(hits, r => r.activeConsumerVisible !== true), visibleForIntersectedCommunityCount: countRows(hits, r => r.visibleForIntersectedCommunity === true), notVisibleForIntersectedCommunityCount: countRows(hits, r => r.visibleForIntersectedCommunity !== true), currentlyConsumerVisibleCount: countRows(hits, r => r.activeConsumerVisible === true), currentlyExcludedCount: countRows(hits, r => r.activeConsumerVisible !== true), categoryCounts: hits.reduce((m, r) => (m[r.category || 'unavailable'] = (m[r.category || 'unavailable'] || 0) + 1, m), {}), communityCoverageCount: communitySummaries.filter(s => communityDefs.find(cm => cm.key === s.communityId)?.countyId === cy.countyId && s.intersectingDriveTexasRecordCount > 0).length, unresolvedRecordCount: countRows(hits, r => r.geographicStatus === 'geographically_unresolved') }; }); }

assert.strictEqual(result.records.length, records.length, 'every normalized record produces one row');
assert.strictEqual(result.completeRecordRows, result.records, 'records and completeRecordRows point to the same complete row array');
assert.deepStrictEqual(result.records.map(r => r.sourceId), ['provider:001', 'provider:002', 'provider:003', 'provider:004', 'provider:005'], 'output ordering is deterministic after canonical identity resolution');
assert(result.records.find(r => r.sourceId === 'provider:001').communityIdsIntersected.includes('alpha'), 'LineString uses complete segment geometry');
assert(result.records.find(r => r.sourceId === 'provider:002').communityIdsIntersected.includes('gamma'), 'MultiLineString evaluates every component');
assert.strictEqual(result.records.find(r => r.sourceId === 'provider:003').communityIntersectionCount, 0, 'midpoint/representative point alone does not assign community ownership when geometry exists');
assert(result.records.find(r => r.sourceId === 'provider:001').crossesMultipleCommunities, 'one record can intersect multiple communities');
assert(result.records.find(r => r.sourceId === 'provider:001').crossesMultipleCounties, 'one record can intersect multiple counties');
assert(result.records.find(r => r.sourceId === 'provider:003').nearestCommunityId, 'nearest community is retained as informational evidence');
assert(!result.records.find(r => r.sourceId === 'provider:003').insideGridlyCoverage, 'nearest community does not assign ownership');
assert(result.communitySummaries.some(s => s.communityId === 'zero' && s.intersectingDriveTexasRecordCount === 0), 'communities with zero records remain in summary');
assert.strictEqual(result.records.find(r => r.sourceId === 'provider:001').globallyRelevant, true, 'multi-community record is globally geographically relevant');
assert.strictEqual(result.records.find(r => r.sourceId === 'provider:001').visibleForIntersectedCommunity, true, 'multi-community record is visible for an intersected community selection');
assert.strictEqual(result.records.find(r => r.sourceId === 'provider:001').activeConsumerVisible, false, 'multi-community record is not active-visible when the production active snapshot excludes it');
assert.notStrictEqual(result.records.find(r => r.sourceId === 'provider:001').discrepancyClassification, 'GEOGRAPHICALLY_RELEVANT_BUT_NOT_VISIBLE', 'global relevance no longer contradicts valid intersected-community visibility');
assert.strictEqual(result.noFetches && result.noPolling && result.noWrites && result.noStorageWrites && result.noMapMovement, true, 'helper contract is passive');
assert.deepStrictEqual(Object.keys(result.registryStatus).sort(), ['communityCount', 'communityRegistryAvailable', 'countyCount', 'countyRegistryAvailable', 'recordCount', 'recordSourceAvailable'].sort(), 'registryStatus exposes required availability contract');
assert.deepStrictEqual(result.coverageCounts, expectedCoverage(result.records), 'coverageCounts are reproduced exactly by filtering records');
assert.deepStrictEqual(result.discrepancyCounts, expectedDiscrepancyCounts(result.records), 'discrepancyCounts are reproduced exactly by filtering records');
assert.deepStrictEqual(result.productionDiscrepancies, expectedProductionDiscrepancies(result.records), 'productionDiscrepancies is exactly the discrepancy row filter projection');
assert.deepStrictEqual(result.communitySummaries, expectedCommunitySummaries(result.records, communities), 'community summaries are reproduced exactly by grouping records');
assert.deepStrictEqual(result.countySummaries, expectedCountySummaries(result.records, counties, communities, result.communitySummaries), 'county summaries are reproduced exactly by grouping records');

const mutable = build({ records: [point('mutable-1', 30, -95)], communities, counties, productionSnapshot: { consumerEligibleSituations: [point('mutable-1', 30, -95)] } });
assert.strictEqual(mutable.records, mutable.completeRecordRows, 'authoritative record aliases share object identity before mutation');
assert.strictEqual(mutable.coverageCounts.insideGridlyCoverage, 1, 'mutation fixture starts inside coverage');
assert.strictEqual(mutable.communitySummaries.find(s => s.communityId === 'alpha').currentlyConsumerVisibleCount, 1, 'mutation fixture starts visible in community summary');
mutable.records[0].insideGridlyCoverage = false;
mutable.records[0].activeConsumerVisible = false;
mutable.records[0].currentConsumerVisible = false;
mutable.records[0].visibleForIntersectedCommunity = false;
mutable.records[0].discrepancyClassification = null;
assert.deepStrictEqual(mutable.coverageCounts, expectedCoverage(mutable.records), 'coverage getter follows authoritative row mutations');
assert.deepStrictEqual(mutable.discrepancyCounts, expectedDiscrepancyCounts(mutable.records), 'discrepancy getter follows authoritative row mutations');
assert.deepStrictEqual(mutable.communitySummaries, expectedCommunitySummaries(mutable.records, communities), 'community summary getter follows authoritative row mutations');

const manyUuidRecords = Array.from({ length: 250 }, (_, index) => ({ sourceMetadata: { GLOBALID: `550e8400-e29b-41d4-a716-${String(index).padStart(12, '0')}` }, category: 'Crash', latitude: 30, longitude: -95 }));
const manyResult = build({ records: manyUuidRecords, communities, counties });
assert.strictEqual(manyResult.recordCount, manyUuidRecords.length, 'hundreds of UUID records are preserved');
assert.strictEqual(manyResult.uniqueSourceIdCount, manyUuidRecords.length, 'hundreds of UUID records remain unique through nested provider identity');
assert.strictEqual(manyResult.duplicateSourceIdInstances.length, 0, 'unique UUID records are not classified as duplicates');

const missingIdentity = build({ records: [
  { category: 'Crash', headline: 'A', routeName: 'One', latitude: 30.01, longitude: -95.01 },
  { category: 'Crash', headline: 'B', routeName: 'Two', latitude: 30.02, longitude: -95.02 }
], communities, counties });
assert.strictEqual(missingIdentity.uniqueSourceIdCount, 2, 'missing preferred source ID fields do not collapse unrelated records');
assert(missingIdentity.records.every(r => r.dataQualityFlags.includes('missing_source_identity')), 'missing preferred source identity is explicitly flagged');

const duplicateIdentity = build({ records: [line('repeat', [[-95, 30], [-94.99, 30]]), line('repeat', [[-95, 30], [-94.99, 30]])], communities, counties });
assert.strictEqual(duplicateIdentity.uniqueSourceIdCount, 1, 'genuinely repeated canonical identities share one identity');
assert.strictEqual(duplicateIdentity.duplicateSourceIdInstances.length, 2, 'duplicate classification applies only after canonical identity resolution');

const eventIdentity = build({ records: [{ event_id: 'evt-1', sourceId: 'src-1', globalId: 'gid-1' }], communities, counties });
assert.strictEqual(eventIdentity.records[0].sourceId, 'event:evt-1', 'canonical identity precedence matches the DriveTexas authority event-id-first contract');
assert.strictEqual(eventIdentity.records[0].sourceIdentityMethod, 'event_id', 'identity method records production authority contract');

const oldGlobal = {
  gridlyGetCountyGroupedAwarenessOptions: globalThis.gridlyGetCountyGroupedAwarenessOptions,
  resolveGridlyAwarenessArea: globalThis.resolveGridlyAwarenessArea
};
globalThis.gridlyGetCountyGroupedAwarenessOptions = () => [{ countyLabel: 'Runtime County', countyId: 'runtime-county', countyValue: 'runtime-county', communities: [{ key: 'runtime-alpha', label: 'Runtime Alpha', value: 'Runtime Alpha' }, { key: 'runtime-zero', label: 'Runtime Zero', value: 'Runtime Zero' }, { key: 'runtime-countywide', label: 'Countywide awareness', value: 'Runtime County', countyWide: true }] }];
globalThis.resolveGridlyAwarenessArea = (value) => value === 'Runtime Alpha'
  ? { key: 'runtime-alpha', label: 'Runtime Alpha', countyId: 'runtime-county', lat: 30, lng: -95, radiusMiles: 5 }
  : { key: 'runtime-zero', label: 'Runtime Zero', countyId: 'runtime-county', lat: 32, lng: -97, radiusMiles: 5 };
const registryResult = build({ records: [point('runtime-1', 30, -95)], counties: [{ countyId: 'runtime-county', countyName: 'Runtime County' }] });
assert.strictEqual(registryResult.registryStatus.communityRegistryAvailable, true, 'runtime Gridly community registry is available');
assert.strictEqual(registryResult.communitySummaries.length, 2, 'real Gridly community registry produces non-empty community summaries without countywide placeholders');
assert(registryResult.communitySummaries.some(s => s.communityId === 'runtime-zero' && s.intersectingDriveTexasRecordCount === 0), 'every configured runtime community appears, including zero-record communities');
globalThis.gridlyGetCountyGroupedAwarenessOptions = oldGlobal.gridlyGetCountyGroupedAwarenessOptions;
globalThis.resolveGridlyAwarenessArea = oldGlobal.resolveGridlyAwarenessArea;

const registryFailure = build({ records: [point('failure-1', 30, -95)], counties });
assert.strictEqual(registryFailure.registryStatus.communityRegistryAvailable, false, 'community registry failure is reported explicitly');
assert.strictEqual(registryFailure.coverageCounts.outsideGridlyCoverage, 0, 'registry failure does not classify every record as outside coverage');
assert.strictEqual(registryFailure.coverageCounts.registryUnavailable, 1, 'registry failure has a separate coverage state');
assert.strictEqual(registryFailure.communitySummaries.length, 0, 'unavailable registry does not produce authoritative-looking pseudo-community summaries');

const source = require('fs').readFileSync(require('path').join(__dirname, '../js/gridlyLp044DriveTexasCommunityAuthorityInventory.js'), 'utf8');
assert(!/Houston|Dayton|Harris|Liberty|US\s*90|I-?10|I-?45|740|739/.test(source), 'implementation does not hardcode prohibited places, routes, or record counts');
assert(!/const\s+(coverageCounts|discrepancyCounts|countySummaries|communitySummaries|productionDiscrepancies)\s*=/.test(source), 'derived LP044 outputs are not materialized through a second aggregation path');
console.log('LP044 DriveTexas community authority inventory tests passed');
