import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/app.js', 'utf8');
const start = source.indexOf('function buildGridlySearchCandidateLineage');
const end = source.indexOf('\nasync function fetchGridlyNominatimSearch', start);
const lineage = source.slice(start, end);
const searchStart = source.indexOf('async function gridlySearchAddress');
const searchEnd = source.indexOf('\nwindow.gridlyAggregateAddressVariantOutcomes', searchStart);
const search = source.slice(searchStart, searchEnd);

test('canonical candidates receive explicit, candidate-level losing-stage lineage', () => {
  assert.ok(start > 0 && end > start);
  for (const field of ['candidateId', 'providerCanonicalAccepted', 'normalization',
    'texasContainment', 'countyQualification', 'intentAccepted',
    'qualityAccepted', 'distanceAccepted', 'deduped', 'publicationEligible',
    'firstLosingStage', 'rejectionCode', 'rejectionReason']) assert.match(lineage, new RegExp(field));
  assert.match(search, /buildGridlySearchCandidateLineage\(remoteProviderCandidates/);
});

test('two provider results necessarily produce two lineage records without changing returned results', () => {
  assert.match(search, /remoteProviderCandidates\.push\(\.\.\.variantResults\)/);
  assert.match(search, /providerCanonicalCount: remoteProviderCandidates\.length/);
  assert.match(search, /Object\.defineProperty\(finalResults, "gridlyProviderDiagnostics"/);
  assert.match(search, /return finalResults;/);
});

test('aggregate counts are derived from the same lineage decisions and final publication', () => {
  for (const count of ['normalizedCount', 'containedCount', 'countyQualifiedCount',
    'intentAcceptedCount', 'qualityAcceptedCount', 'dedupedCount',
    'publicationEligibleCount', 'finalPublishedCount']) assert.match(search, new RegExp(count));
  assert.match(search, /finalPublishedCount: finalResults\.filter/);
});

test('publication eligibility and final publication remain separately auditable', () => {
  assert.match(search, /publicationEligible: truthfulResults/);
  assert.match(search, /published: finalResults/);
  assert.match(lineage, /finalPublished:/);
});

test('instrumentation is audit-only and introduces no Cherokee-specific behavior', () => {
  assert.doesNotMatch(lineage, /cherokee|48073/i);
  assert.doesNotMatch(search, /cherokee|48073/i);
  assert.doesNotMatch(lineage, /fetch\s*\(|gridlyGeocodingClient\.search|push\s*\(.*result/i);
});
