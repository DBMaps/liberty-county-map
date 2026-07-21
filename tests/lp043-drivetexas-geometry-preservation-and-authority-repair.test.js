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
assert.strictEqual(audit.sampleSourceId, 'crossing', 'LP043 audit exposes representative geometry source id');
assert.strictEqual(audit.sampleGeometryType, 'LineString', 'LP043 audit exposes representative geometry type');
assert.deepStrictEqual(JSON.parse(JSON.stringify(audit.sampleGeometryBounds)), { minLongitude: -95.2, maxLongitude: -94.4, minLatitude: 30.0466, maxLatitude: 30.0466 }, 'LP043 audit exposes representative geometry bounds');
assert(audit.sampleAwarenessBounds.minLongitude < dayton.lng && audit.sampleAwarenessBounds.maxLongitude > dayton.lng, 'LP043 audit exposes representative awareness longitude bounds');
assert.deepStrictEqual(JSON.parse(JSON.stringify(audit.sampleOverlapComparisons)), {
  geometryMaxLongitudeGteAwarenessMinLongitude: true,
  geometryMinLongitudeLteAwarenessMaxLongitude: true,
  geometryMaxLatitudeGteAwarenessMinLatitude: true,
  geometryMinLatitudeLteAwarenessMaxLatitude: true
}, 'LP043 audit exposes each broad-phase comparison result');
assert.strictEqual(audit.sampleOverallOverlap, true, 'LP043 audit exposes representative overall overlap');
assert.strictEqual(audit.geometryEvaluation.sample.coordinateCount, 2, 'LP043 geometry evaluation sample includes coordinate count');
assert.deepStrictEqual(JSON.parse(JSON.stringify(audit.geometryEvaluation.sample.firstCoordinate)), [-95.2, 30.0466], 'LP043 geometry evaluation sample includes first coordinate');
assert.deepStrictEqual(JSON.parse(JSON.stringify(audit.geometryEvaluation.sample.lastCoordinate)), [-94.4, 30.0466], 'LP043 geometry evaluation sample includes last coordinate');
assert.deepStrictEqual(JSON.parse(JSON.stringify(audit.geometryEvaluation.sample.normalizedMidpoint)), { longitude: -94.4, latitude: 30.0466 }, 'LP043 geometry evaluation sample includes normalized midpoint');
assert.strictEqual(audit.geometryEvaluation.sample.selectedAwareness, 'Generic Awareness', 'LP043 geometry evaluation sample includes selected awareness');
assert.strictEqual(audit.geometryEvaluation.sample.selectedCounty, null, 'LP043 geometry evaluation sample includes selected county');
console.log('LP043 DriveTexas geometry preservation and authority repair checks passed');
