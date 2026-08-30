const test = require('node:test');
const assert = require('node:assert/strict');
const marker = require('../js/gridlyOfficialRoadwayMarkerPublication.js');
const fs = require('node:fs');

const records = [
  { consumerSituationId:'drivetexas:a', category:'Lane Closure', lat:29.779, lng:-95.375 },
  { consumerSituationId:'drivetexas:b', category:'Bridge Restriction', sourceCoordinates:{latitude:29.777,longitude:-95.381} },
  { consumerSituationId:'drivetexas:c', category:'Road Closure', lat:29.776, lng:-95.398 }
];

test('consumer-envelope records publish deterministic official roadway marker models', () => {
  const models = marker.build(records, {canonicalKey:'place-4835000'});
  assert.equal(models.length, 3);
  assert.ok(models.every(row => row.sourceOwnership === 'OFFICIAL_ROADWAY' && row.markerPublicationEligible));
  const outcomes = marker.reconcile(models, models.map(row => row.markerModelIdentity));
  assert.ok(outcomes.every(row => row.outcome === marker.OUTCOME.RENDERED));
});

test('a marker-ready record can never disappear without an auditable outcome', () => {
  const models = marker.build(records, {canonicalKey:'place-4819000'});
  const outcomes = marker.reconcile(models, [models[0].markerModelIdentity]);
  assert.equal(outcomes.filter(row => row.outcome === marker.OUTCOME.SILENTLY_DROPPED).length, 2);
  const missing = marker.build([{consumerSituationId:'x'}]);
  assert.equal(missing[0].outcome, marker.OUTCOME.EXPLICITLY_SUPPRESSED_BY_CONTRACT);
  assert.equal(missing[0].suppressionReason, 'MISSING_GOVERNED_PRESENTATION_COORDINATE');
});

test('trusted provider geometry publishes a marker while genuinely geometry-less records remain suppressed', () => {
  const geometryRecords = [
    { consumerSituationId: 'drivetexas:point', category: 'Flooding', sourceCoordinates: null, sourceGeometry: { type: 'Point', coordinates: [-97.7431, 30.2672] } },
    { consumerSituationId: 'drivetexas:geometry-line', category: 'Road Closure', sourceCoordinates: null, sourceGeometry: { type: 'LineString', coordinates: [[-94.2, 29.8], [-94.1, 29.9], [-94.0, 30.0]] } },
    { consumerSituationId: 'drivetexas:multi', category: 'Bridge Restriction', sourceCoordinates: null, sourceGeometry: { type: 'MultiLineString', coordinates: [[[-106.5, 31.7], [-106.4, 31.8]], [[-106.3, 31.9], [-106.2, 32.0]]] } }
  ];
  const [point, line, multi] = marker.build(geometryRecords);
  assert.deepEqual(point.markerCoordinate, { lat: 30.2672, lng: -97.7431 });
  assert.deepEqual(line.markerCoordinate, { lat: 29.9, lng: -94.1 });
  assert.deepEqual(multi.markerCoordinate, { lat: 31.9, lng: -106.3 });
  assert.ok([point, line, multi].every(row => row.markerPublicationEligible));

  const absent = marker.build([{ consumerSituationId: 'drivetexas:no-geometry' }])[0];
  assert.equal(absent.markerCoordinate, null);
  assert.equal(absent.markerPublicationEligible, false);
  assert.equal(absent.outcome, marker.OUTCOME.EXPLICITLY_SUPPRESSED_BY_CONTRACT);
});

test('direct coordinates take precedence and malformed geometry, duplicates, and fallback guesses fail closed', () => {
  const inputs = [
    { consumerSituationId: 'drivetexas:direct', category: 'Construction', sourceCoordinates: { latitude: 32.7767, longitude: -96.797 }, sourceGeometry: { type: 'Point', coordinates: [-100, 35] } },
    { consumerSituationId: 'drivetexas:malformed', sourceGeometry: { type: 'LineString', coordinates: [['bad', 30], [-94, 31]] }, communityCenter: { lat: 30, lng: -94 }, countyCenter: { lat: 30, lng: -94 }, presentationCoordinate: { lat: 30, lng: -94 } },
    { consumerSituationId: 'drivetexas:direct', category: 'Construction', sourceCoordinates: { latitude: 32.7767, longitude: -96.797 } }
  ];
  const [direct, malformed, duplicate] = marker.build(inputs);
  assert.deepEqual(direct.markerCoordinate, { lat: 32.7767, lng: -96.797 });
  assert.equal(direct.markerPublicationEligible, true);
  assert.equal(malformed.markerCoordinate, null, 'community/county/presentation coordinates are never marker fallbacks');
  assert.equal(malformed.outcome, marker.OUTCOME.EXPLICITLY_SUPPRESSED_BY_CONTRACT);
  assert.equal(duplicate.markerPublicationEligible, false);
  assert.equal(duplicate.outcome, marker.OUTCOME.GOVERNED_AGGREGATED);
  assert.equal(duplicate.suppressionReason, 'DUPLICATE_CONSUMER_SITUATION_ID');
});

test('browser audit exposes the canonical read-only marker publication summary', () => {
  const app = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
  for (const field of ['sourceRecordCount','eligibleMarkerModelCount','renderedMarkerCount','governedAggregatedCount','explicitlySuppressedCount','silentDropCount','representedRecordCount','publicationRevision']) {
    assert.match(app, new RegExp(`\\b${field}\\b`), field);
  }
  assert.match(app, /new Set\(outcomes\.flatMap\(row => row\.representedConsumerSituationIds \|\| \[\]\)\)\.size/);
});
