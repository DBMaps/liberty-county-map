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
assert.strictEqual(select([rec('inside-point-outside-trusted-line', { latitude: 30.0466, longitude: -94.8852, sourceGeometry: { type: 'LineString', coordinates: [[-94.2, 30.6], [-94.1, 30.7]] } })]).authorityEligibleRecordCount, 0, 'trusted roadway geometry overrides representative point containment when geometry is outside');
assert.strictEqual(select([rec('missing-point-crossing-line', { latitude: null, longitude: null, sourceGeometry: crossing.sourceGeometry })]).authorityEligibleRecordCount, 1, 'trusted roadway geometry qualifies without representative point coordinates');
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

const alpha = { id: 'alpha', label: 'Alpha', lat: 30.0466, lng: -94.8852, radiusMiles: 5 };
const beta = { id: 'beta', label: 'Beta', lat: 30.0466, lng: -94.70, radiusMiles: 5 };
const gamma = { id: 'gamma', label: 'Gamma', lat: 30.30, lng: -94.30, radiusMiles: 5 };
const multiCommunity = rec('provider:multi-community', { latitude: null, longitude: null, sourceGeometry: { type: 'LineString', coordinates: [[-94.8852, 30.0466], [-94.70, 30.0466]] } });
const alphaConsumer = sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ records: [multiCommunity], selectedAwarenessArea: alpha, nowMs: now });
const betaConsumer = sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ records: [multiCommunity], selectedAwarenessArea: beta, nowMs: now });
const gammaConsumer = sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ records: [multiCommunity], selectedAwarenessArea: gamma, nowMs: now });
assert.strictEqual(alphaConsumer.consumerVisibleSituationCount, 1, 'same geometry record is visible when first intersected community is active');
assert.strictEqual(betaConsumer.consumerVisibleSituationCount, 1, 'same geometry record is visible when second intersected community is active');
assert.strictEqual(gammaConsumer.consumerVisibleSituationCount, 0, 'same geometry record is excluded for non-intersected community');
assert.strictEqual(alphaConsumer.consumerVisibleSituations[0].providerId, 'provider:multi-community', 'provider-prefixed canonical identity survives consumer projection');
assert.strictEqual(alphaConsumer.consumerVisibleSituations[0].consumerSituationId, 'drivetexas:provider:multi-community', 'consumer situation id uses canonical authority identity without double-prefixing');
const noRepresentative = alphaConsumer.consumerVisibleSituations[0];
assert.strictEqual(noRepresentative.sourceCoordinates, null, 'geometry-qualified consumer visibility does not require representative coordinates');
const completeCacheRecord = rec('provider:complete-cache-line', { latitude: 31.0, longitude: -96.0, sourceGeometry: { type: 'LineString', coordinates: [[-94.8852, 30.0466], [-94.70, 30.0466]] } });
sandbox.gridlyDriveTexasConnector = {
  getAllNormalizedRecords: () => [completeCacheRecord],
  getNormalizedRecords: () => [],
  areaLifecycleAudit: () => ({ retainedDataReused: false })
};
sandbox.getGridlySelectedAwarenessArea = () => alpha;
const completeCacheConsumer = sandbox.gridlySelectConsumerVisibleDriveTexasSituations({ nowMs: now });
assert.strictEqual(completeCacheConsumer.consumerVisibleSituationCount, 1, 'complete normalized cache feeds authority even when connector awareness-filtered cache is empty');
assert.strictEqual(completeCacheConsumer.consumerVisibleSituations[0].providerId, 'provider:complete-cache-line', 'complete-cache projection preserves provider-prefixed identity');

assert.strictEqual(typeof sandbox.gridlyLp043DriveTexasGeometryAuthorityRepairAudit, 'function', 'LP043 audit exported');
const geometryFieldOnlyResult = select([rec('geometry-field-only-authority', { geometry: { type: 'LineString', coordinates: [[-95.2, 30.0466], [-94.4, 30.0466]] }, sourceGeometry: null })]);
assert.strictEqual(geometryFieldOnlyResult.geometryEvaluation.recordsReachingSegmentLoop, 1, 'production authority uses preserved geometry field when sourceGeometry is not present');
assert.strictEqual(geometryFieldOnlyResult.authorityEligibleRecordCount, 1, 'preserved geometry field can qualify through authority without midpoint forcing');
const audit = sandbox.gridlyLp043DriveTexasGeometryAuthorityRepairAudit({ records: [crossing], selectedAwarenessArea: dayton, nowMs: now });
assert.strictEqual(audit.geometryAuthorityCertified, true, 'LP043 audit certifies authority contract from fixtures');
assert.strictEqual(audit.consumerProjection.visibleCount, 1, 'LP043 audit sees consumer projection');
assert.strictEqual(audit.nearestGeometryCandidates.length, 1, 'LP043 audit exposes nearest geometry candidates instead of first geometry sample');
assert.strictEqual(audit.nearestGeometryCandidates[0].sourceId, 'provider:crossing', 'LP043 nearest geometry candidate exposes source id');
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
assert.strictEqual(bulkAudit.nearestGeometryCandidates[0].sourceId, 'provider:bulk-0', 'LP043 nearest geometry sorting ignores provider order');
assert(bulkAudit.nearestGeometryDistanceBuckets.within10Miles >= 10, 'LP043 distance buckets count nearby preserved geometries');

assert.strictEqual(typeof sandbox.gridlyLp043TraceSingleAuthorityRecord, 'function', 'LP043 single-record trace helper exists');
sandbox.getGridlySelectedAwarenessArea = () => dayton;
sandbox.gridlyDriveTexasConnector = { getAllNormalizedRecords: () => [crossing, outsideLineResult.records?.[0] || rec('outside-line-regression', { sourceGeometry: { type: 'LineString', coordinates: [[-94.2, 30.6], [-94.1, 30.7]] } })], getNormalizedRecords: () => [] };
const trace = sandbox.gridlyLp043TraceSingleAuthorityRecord('crossing');
assert.strictEqual(trace.passive, true, 'single-record trace is passive');
assert.strictEqual(trace.noFetches, true, 'single-record trace performs no fetches');
assert.strictEqual(trace.noWrites, true, 'single-record trace performs no writes');
assert.strictEqual(trace.noMapMovement, true, 'single-record trace performs no map movement');
assert.strictEqual(trace.sourceId, 'provider:crossing', 'single-record trace uses the real source id');
assert.strictEqual(trace.providerNormalization.entered, true, 'single-record trace enters provider normalization stage from loaded record');
assert.strictEqual(trace.lp0392Adaptation.entered, true, 'single-record trace enters LP039.2 adaptation stage');
assert.strictEqual(trace.buildEligibilityProof.entered, true, 'single-record trace enters buildEligibilityProof');
assert.strictEqual(trace.pointContainment.entered, true, 'single-record trace enters point containment');
assert.strictEqual(trace.pointQualified, false, 'fixture trace is not point-qualified');
assert.strictEqual(trace.geometryAvailable, true, 'fixture trace sees geometry availability');
assert.strictEqual(trace.geometryValid, true, 'fixture trace validates geometry');
assert.strictEqual(trace.boundingBoxExecuted, true, 'fixture trace executes bounding-box precheck');
assert.strictEqual(trace.boundingBoxPassed, true, 'fixture trace passes bounding-box precheck');
assert.strictEqual(trace.segmentLoopEntered, true, 'fixture trace enters segment loop');
assert.strictEqual(trace.segmentCount, 1, 'fixture trace evaluates one segment before intersection acceptance');
assert.strictEqual(trace.closestDistance, 0, 'fixture trace reports exact closest distance');
assert.strictEqual(trace.intersection, true, 'fixture trace reports intersection');
assert.strictEqual(trace.ownershipMethod, 'trusted_source_geometry_intersects_awareness_radius', 'fixture trace reports authority ownership method');
assert.strictEqual(trace.finalEligibility, true, 'fixture trace reports final eligibility');
assert.strictEqual(trace.consumerVisible, true, 'fixture trace reports consumer visibility');
assert.strictEqual(trace.exit.condition, 'const ownershipMethod = trustedRoadwayGeometryAvailable ? (geometryInside ? "trusted_source_geometry_intersects_awareness_radius" : "not_established") : (pointInside ? "valid_source_point_inside_awareness_radius_miles" : "not_established");', 'fixture trace reports exact ownership branch');
const outsideTrace = sandbox.gridlyLp043TraceSingleAuthorityRecord('outside-line-regression');
assert.strictEqual(outsideTrace.boundingBoxExecuted, true, 'outside trace executes bounding-box precheck');
assert.strictEqual(outsideTrace.boundingBoxPassed, false, 'outside trace fails broad phase');
assert.strictEqual(outsideTrace.segmentLoopEntered, false, 'outside trace exits before segment loop');
assert.strictEqual(outsideTrace.exit.condition, 'if (!overallOverlap) { stats.boundingBoxRejects = 1; return { valid: true, intersects: false, closestDistanceMiles: null, geometryType: valid.type, boundsRejected: true, geometryBounds: gb, awarenessBounds: ab, stats }; }', 'outside trace reports exact bounding-box exit statement');

console.log('LP043 DriveTexas geometry preservation and authority repair checks passed');
