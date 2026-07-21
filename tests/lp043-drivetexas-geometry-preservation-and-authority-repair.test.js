const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const now = Date.parse('2026-07-21T12:00:00Z');
const sandbox = { console, Date, setTimeout, clearTimeout, window: {}, globalThis: {} };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.gridlySelectDriveTexasAuthority = (input = {}) => ({ selectedAwarenessArea: input.selectedAwarenessArea, consumerEligibleSituations: [] });
sandbox.gridlyGetDriveTexasAuthoritySnapshot = (input = {}) => ({ selectedAwarenessArea: input.selectedAwarenessArea, authority: { consumerEligibleSituations: [] } });
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/gridlyDriveTexasProvider.js', 'utf8'), sandbox, { filename: 'js/gridlyDriveTexasProvider.js' });
vm.runInContext(fs.readFileSync('js/gridlyDriveTexasAuthoritySourceIntegration.js', 'utf8'), sandbox, { filename: 'js/gridlyDriveTexasAuthoritySourceIntegration.js' });

const dayton = { id: 'generic-awareness', label: 'Generic Awareness', lat: 30.0466, lng: -94.8852, radiusMiles: 5 };
const distant = { id: 'distant-awareness', label: 'Distant Awareness', lat: 31.4, lng: -96.4, radiusMiles: 5 };
const active = { startTime: '2026-07-21T10:00:00Z', updateTime: '2026-07-21T11:00:00Z', endTime: '2026-07-21T18:00:00Z' };
function rec(id, extra = {}) { return Object.assign({ id, sourceId: id, provider: 'DriveTexas', providerId: 'drivetexas', category: 'Road Closure', title: `Road Closure ${id}`, routeName: 'Generic Road', latitude: 30.50, longitude: -94.50 }, active, extra); }
function select(records, area = dayton) { return sandbox.gridlySelectDriveTexasAuthority({ records, selectedAwarenessArea: area, nowMs: now }); }

const payload = { features: [
  { geometry: { type: 'Point', coordinates: [-94.88, 30.04] }, properties: { id: 'pt', category: 'Crash', updateTime: active.updateTime, startTime: active.startTime, endTime: active.endTime } },
  { geometry: { type: 'LineString', coordinates: [[-95.2, 30.0466], [-94.8852, 30.0466], [-94.4, 30.0466]] }, properties: { id: 'line', category: 'Road Closure', updateTime: active.updateTime, startTime: active.startTime, endTime: active.endTime } },
  { geometry: { type: 'MultiLineString', coordinates: [[[ -95.3, 30.1], [-95.2, 30.1]], [[-94.95, 30.0466], [-94.8, 30.0466]]] }, properties: { id: 'multi', category: 'Lane Closure', updateTime: active.updateTime, startTime: active.startTime, endTime: active.endTime } },
  { geometry: { type: 'LineString', coordinates: [[-94.9, 30.0]] }, properties: { id: 'bad', category: 'Crash' } }
] };
const before = JSON.stringify(payload.features[1].geometry.coordinates);
const normalized = sandbox.gridlyDriveTexasProvider.normalizeRecords(payload);
assert.strictEqual(normalized.length, 4, 'provider normalization keeps records');
assert.strictEqual(JSON.stringify(normalized[0].sourceGeometry), JSON.stringify({ type: 'Point', coordinates: [-94.88, 30.04] }), 'Point geometry preserved');
assert.strictEqual(normalized[1].sourceGeometry.type, 'LineString', 'LineString geometry preserved');
assert.strictEqual(JSON.stringify(normalized[1].sourceGeometry.coordinates[0]), JSON.stringify([-95.2, 30.0466]), 'coordinate order remains longitude latitude');
assert.strictEqual(normalized[2].sourceGeometry.type, 'MultiLineString', 'MultiLineString geometry preserved');
assert.strictEqual(normalized[3].sourceGeometry, null, 'malformed geometry rejected');
assert.strictEqual(JSON.stringify(payload.features[1].geometry.coordinates), before, 'input geometry is not mutated');
assert(!('__geometry' in normalized[1]), 'raw provider feature geometry field not retained');
assert(Number.isFinite(normalized[1].latitude) && Number.isFinite(normalized[1].longitude), 'midpoint fields remain available');

const adapted = sandbox.gridlyAdaptDriveTexasRecordsForAuthority(normalized).records;
assert.strictEqual(adapted[1].sourceGeometryType, 'LineString', 'LP039.2 adapter preserves source geometry');
assert.strictEqual(adapted[1].sourceGeometryValid, true, 'LP039.2 adapter marks trusted validated geometry');
const adaptedFallbackGeometry = sandbox.gridlyAdaptDriveTexasRecordsForAuthority([rec('geometry-field-only', { geometry: { type: 'LineString', coordinates: [[-95.2, 30.0466], [-94.4, 30.0466]] }, sourceGeometry: null })]).records[0];
assert.strictEqual(adaptedFallbackGeometry.sourceGeometryType, 'LineString', 'LP039.2 adapter promotes preserved geometry field into authority sourceGeometry when sourceGeometry is absent');

assert.strictEqual(select([rec('inside', { latitude: 30.0467, longitude: -94.8852 })]).authorityEligibleRecordCount, 1, 'point inside radius qualifies');
const outsidePoint = select([rec('outside-point')]);
assert.strictEqual(outsidePoint.recordProof[0].pointInsideAwarenessRadius, false, 'point outside radius does not qualify by point');
assert.strictEqual(outsidePoint.authorityEligibleRecordCount, 0, 'point outside radius rejected without geometry');
const crossing = rec('crossing', { routeName: 'State Route Fixture', latitude: 30.50, longitude: -94.50, sourceGeometry: { type: 'LineString', coordinates: [[-95.2, 30.0466], [-94.4, 30.0466]] } });
const crossingResult = select([crossing]);
assert.strictEqual(crossingResult.authorityEligibleRecordCount, 1, 'LineString crossing radius qualifies with endpoints outside');
assert.strictEqual(crossingResult.recordProof[0].geographicOwnershipMethod, 'trusted_source_geometry_intersects_awareness_radius', 'geometry proof method recorded');
assert.strictEqual(sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ records: [crossing], selectedAwarenessArea: dayton, nowMs: now }).consumerVisibleSituationCount, 1, 'consumer projection includes geometry-qualified record');
assert.strictEqual(select([rec('outside-line', { sourceGeometry: { type: 'LineString', coordinates: [[-94.2, 30.6], [-94.1, 30.7]] } })]).authorityEligibleRecordCount, 0, 'LineString entirely outside rejected');
assert.strictEqual(select([rec('multi-cross', { sourceGeometry: { type: 'MultiLineString', coordinates: [[[-94.2, 30.6], [-94.1, 30.7]], [[-95.2, 30.0466], [-94.4, 30.0466]]] } })]).authorityEligibleRecordCount, 1, 'MultiLineString one member intersects');
assert.strictEqual(select([rec('multi-out', { sourceGeometry: { type: 'MultiLineString', coordinates: [[[-94.2, 30.6], [-94.1, 30.7]]] } })]).authorityEligibleRecordCount, 0, 'MultiLineString entirely outside rejected');
assert.strictEqual(select([rec('malformed', { sourceGeometry: { type: 'LineString', coordinates: [[-95, 30], ['bad', 30]] } })]).authorityEligibleRecordCount, 0, 'malformed geometry does not qualify');
assert.strictEqual(select([rec('invalid-geometry-valid-point', { latitude: 30.0466, longitude: -94.8852, sourceGeometry: { type: 'LineString', coordinates: [[null, 30], [-94, 30]] } })]).authorityEligibleRecordCount, 1, 'invalid geometry does not defeat point containment');
assert.strictEqual(select([rec('expired', { sourceGeometry: crossing.sourceGeometry, endTime: '2026-07-21T11:00:00Z' })]).authorityEligibleRecordCount, 0, 'geometry does not bypass freshness');
assert.strictEqual(select([Object.assign({}, crossing, { sourceId: '', id: '', title: '', routeName: 'Route Only' })]).recordProof[0].identityMethod, 'deterministic_source_fallback', 'route-only identity remains fallback not promoted');
assert.strictEqual(select([rec('bad-category', { sourceGeometry: crossing.sourceGeometry, category: 'Other' })]).authorityEligibleRecordCount, 0, 'geometry does not bypass category eligibility');
assert.strictEqual(select([rec('fallback', { sourceGeometry: crossing.sourceGeometry, connectorRetained: true })]).authorityEligibleRecordCount, 0, 'connector retained fallback does not become authority');
assert.strictEqual(select([crossing, Object.assign({}, crossing)]).authorityEligibleRecordCount, 1, 'duplicate records remain deduplicated');
assert.strictEqual(select([crossing], distant).authorityEligibleRecordCount, 0, 'same record rejected for distant awareness');
assert.strictEqual(select([crossing], dayton).authorityEligibleRecordCount, 1, 'switch back recalculates correctly');
const repeated = select([crossing, Object.assign({}, crossing)], dayton);
assert.strictEqual(repeated.consumerEligibleSituations.length, 1, 'no duplicated visibility after repeated switches');
assert(repeated.geometryEvaluation.boundingBoxRejects >= 0, 'performance stats include bounding-box rejections');
assert.strictEqual(crossingResult.geometryEvaluation.boundingBoxesCreated, 1, 'bounding box diagnostics count created box');
assert.strictEqual(crossingResult.geometryEvaluation.recordsReachingBroadPhase, 1, 'geometry record reaches broad phase');
assert.strictEqual(crossingResult.geometryEvaluation.boundingBoxesPassed, 1, 'bounding-box overlap true passes to segment evaluation');
assert.strictEqual(crossingResult.geometryEvaluation.recordsReachingSegmentLoop, 1, 'geometry record reaches segment loop');
assert.strictEqual(crossingResult.geometryEvaluation.boundingBoxRejects, 0, 'crossing LineString is not rejected by broad bounding box');
assert(crossingResult.geometryEvaluation.segmentsEvaluated > 0, 'segment evaluation executes after bounding-box pass');
assert(crossingResult.geometryEvaluation.segmentsEvaluated <= 1, 'segment loop exits after accepted intersection');
assert.strictEqual(crossingResult.geometryEvaluation.intersectionsFound, 1, 'segment intersection counted');
assert.strictEqual(Object.keys(crossingResult.geometryEvaluation.skipReasonCounts).length, 0, 'no skip reasons reported for crossing geometry execution path');
assert.strictEqual(crossingResult.geometryEvaluation.closestGeometryDistanceMiles, 0, 'closest geometry distance reported');
const outsideLineResult = select([rec('outside-line-regression', { sourceGeometry: { type: 'LineString', coordinates: [[-94.2, 30.6], [-94.1, 30.7]] } })]);
assert.strictEqual(outsideLineResult.geometryEvaluation.boundingBoxesCreated, 1, 'outside LineString creates bounding box');
assert.strictEqual(outsideLineResult.geometryEvaluation.boundingBoxRejects, 1, 'bounding-box overlap false skips segment evaluation');
assert.strictEqual(outsideLineResult.geometryEvaluation.boundingBoxesPassed, 0, 'outside LineString does not pass broad phase');
assert.strictEqual(outsideLineResult.geometryEvaluation.segmentsEvaluated, 0, 'segment evaluation skipped only after bounding-box rejection');
const negativeLongitudeTexas = rec('negative-lon-crossing', { sourceGeometry: { type: 'LineString', coordinates: [[30.0466, -95.2], [30.0466, -94.4]] } });
const negativeLongitudeResult = select([negativeLongitudeTexas]);
assert.strictEqual(negativeLongitudeResult.authorityEligibleRecordCount, 1, 'Texas coordinate ranges with reversed lat/lon source order are normalized for authority');
assert(negativeLongitudeResult.geometryEvaluation.segmentsEvaluated > 0, 'negative-longitude Texas geometry reaches segment evaluation');
const multiResult = select([rec('multi-cross-regression', { sourceGeometry: { type: 'MultiLineString', coordinates: [[[-94.2, 30.6], [-94.1, 30.7]], [[-95.2, 30.0466], [-94.4, 30.0466]]] } })]);
assert(multiResult.geometryEvaluation.segmentsEvaluated > 0, 'MultiLineString segment evaluation executes');
assert(!('fetch' in sandbox && sandbox.fetch.called), 'no extra network fetch');
assert.strictEqual(typeof sandbox.gridlyLp043DriveTexasGeometryAuthorityRepairAudit, 'function', 'LP043 audit exported');
const geometryFieldOnlyResult = select([rec('geometry-field-only-authority', { geometry: { type: 'LineString', coordinates: [[-95.2, 30.0466], [-94.4, 30.0466]] }, sourceGeometry: null })]);
assert.strictEqual(geometryFieldOnlyResult.geometryEvaluation.recordsReachingSegmentLoop, 1, 'production authority uses preserved geometry field when sourceGeometry is not present');
assert.strictEqual(geometryFieldOnlyResult.authorityEligibleRecordCount, 1, 'preserved geometry field can qualify through authority without midpoint forcing');
const audit = sandbox.gridlyLp043DriveTexasGeometryAuthorityRepairAudit({ records: [crossing], selectedAwarenessArea: dayton, nowMs: now });
assert.strictEqual(audit.geometryAuthorityCertified, true, 'LP043 audit certifies authority contract from fixtures');
assert.strictEqual(audit.consumerProjection.visibleCount, 1, 'LP043 audit sees consumer projection');
assert.strictEqual(audit.nearestGeometryCandidates.length, 1, 'LP043 audit exposes nearest geometry candidates instead of first geometry sample');
assert.strictEqual(audit.nearestGeometryCandidates[0].sourceId, 'crossing', 'LP043 nearest geometry candidate exposes source id');
assert.strictEqual(audit.nearestGeometryCandidates[0].route, 'State Route Fixture', 'LP043 nearest geometry candidate exposes route');
assert.strictEqual(audit.nearestGeometryCandidates[0].category, 'Road Closure', 'LP043 nearest geometry candidate exposes category');
assert.strictEqual(audit.nearestGeometryCandidates[0].geometryType, 'LineString', 'LP043 nearest geometry candidate exposes geometry type');
assert.deepStrictEqual({ latitude: audit.nearestGeometryCandidates[0].midpointLatitude, longitude: audit.nearestGeometryCandidates[0].midpointLongitude }, { latitude: 30.0466, longitude: -94.4 }, 'LP043 nearest geometry candidate exposes midpoint');
assert.strictEqual(audit.nearestGeometryCandidates[0].boundingBoxOverlapResult, true, 'LP043 nearest geometry candidate exposes broad phase result');
assert.strictEqual(audit.nearestGeometryCandidates[0].segmentEvaluationReached, true, 'LP043 nearest geometry candidate exposes segment loop reach');
assert.strictEqual(audit.nearestGeometryCandidates[0].segmentIntersectionResult, true, 'LP043 nearest geometry candidate exposes segment intersection result');
assert.strictEqual(audit.nearestGeometryCandidates[0].authorityOwnershipResult, 'trusted_source_geometry_intersects_awareness_radius', 'LP043 nearest geometry candidate exposes authority ownership');
assert.strictEqual(audit.nearestGeometryCandidates[0].finalEligibility, true, 'LP043 nearest geometry candidate exposes final eligibility');
assert.strictEqual(audit.nearestGeometryCandidates[0].consumerVisibility, true, 'LP043 nearest geometry candidate exposes consumer visibility');
assert.strictEqual(audit.nearestGeometryCandidates[0].rejectionReason, null, 'LP043 nearest geometry candidate exposes rejection reason');
assert.strictEqual(audit.nearestGeometryDistanceMiles, audit.nearestGeometryCandidates[0].nearestGeometryDistanceMiles, 'LP043 nearest distance mirrors nearest candidate');
assert.strictEqual(audit.nearestGeometryEvaluated, 1, 'LP043 nearest geometry evaluated count exposed');
assert.strictEqual(audit.nearestGeometryPassedBroadPhase, 1, 'LP043 nearest broad-phase pass count exposed');
assert.strictEqual(audit.nearestGeometryReachedSegmentLoop, 1, 'LP043 nearest segment-loop count exposed');
assert.strictEqual(audit.nearestGeometryQualified, 1, 'LP043 nearest qualified count exposed');
assert.deepStrictEqual(JSON.parse(JSON.stringify(audit.nearestGeometryDistanceBuckets)), { within10Miles: 0, within20Miles: 0, within30Miles: 1, within50Miles: 1, within100Miles: 1 }, 'LP043 distance buckets are reported');
assert.deepStrictEqual(JSON.parse(JSON.stringify(audit.geometryEvaluation.nearestGeometryDistanceBuckets)), JSON.parse(JSON.stringify(audit.nearestGeometryDistanceBuckets)), 'LP043 geometry evaluation carries nearest bucket diagnostics');
const bulkGeometryRecords = Array.from({ length: 30 }, (_, i) => rec(`bulk-${i}`, { latitude: 30.8, longitude: -94.2, sourceGeometry: { type: 'LineString', coordinates: [[dayton.lng + ((i + 1) * 0.01), dayton.lat], [dayton.lng + ((i + 1) * 0.01) + 0.001, dayton.lat]] } }));
const bulkAudit = sandbox.gridlyLp043DriveTexasGeometryAuthorityRepairAudit({ records: bulkGeometryRecords.reverse(), selectedAwarenessArea: dayton, nowMs: now });
assert.strictEqual(bulkAudit.nearestGeometryCandidates.length, 25, 'LP043 nearest geometry candidates are bounded to 25');
assert(bulkAudit.nearestGeometryCandidates.every((candidate, index, list) => index === 0 || list[index - 1].nearestGeometryDistanceMiles <= candidate.nearestGeometryDistanceMiles), 'LP043 nearest geometry candidates are sorted by distance');
assert.strictEqual(bulkAudit.nearestGeometryCandidates[0].sourceId, 'bulk-0', 'LP043 nearest geometry sorting ignores provider order');
assert(bulkAudit.nearestGeometryDistanceBuckets.within10Miles >= 10, 'LP043 distance buckets count nearby preserved geometries');
console.log('LP043 DriveTexas geometry preservation and authority repair checks passed');
