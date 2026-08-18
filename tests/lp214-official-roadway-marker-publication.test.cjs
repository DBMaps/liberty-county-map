const test = require('node:test');
const assert = require('node:assert/strict');
const marker = require('../js/gridlyOfficialRoadwayMarkerPublication.js');

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
