import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function functionSource(name) {
  const asyncStart = app.indexOf(`async function ${name}`);
  const start = asyncStart >= 0 ? asyncStart : app.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} exists`);
  const end = app.indexOf('\nfunction ', start + 9);
  assert.ok(end > start, `${name} has a following function boundary`);
  return app.slice(start, end);
}

test('eligible unqualified business acquisition retains loading and cannot publish an intermediate result list', () => {
  const live = functionSource('runGridlyLiveDestinationSearch');
  assert.match(live, /governedBusinessPipelinePending[\s\S]*BUSINESS_PLACE[\s\S]*gridlyQueryAllowsRuntimePoiAcquisition/);
  assert.match(live, /if \(!governedBusinessPipelinePending && shouldRender[\s\S]*renderPhase: "immediate_seed"/);
  assert.ok(live.indexOf('governedBusinessPipelinePending') < live.indexOf('await gridlySearchAddress'));
  assert.ok(live.indexOf('await gridlySearchAddress') < live.indexOf('renderPhase: "final"'));
  assert.match(app, /renderGridlySearchResults\(\[\], \{ state: "searching"/);
  assert.match(app, /Checking nearby places…/);
});

test('completed pipeline publishes once and retained trace proves no intermediate publication', () => {
  const live = functionSource('runGridlyLiveDestinationSearch');
  assert.match(live, /intermediateConsumerResultPublicationCount = 0/);
  assert.match(live, /if \(rendered\) finalConsumerResultPublicationCount \+= 1/);
  assert.match(live, /intermediateConsumerResultPublicationCount, finalConsumerResultPublicationCount/);
  assert.match(live, /anotherRenderAfterPublication: false/);
});

test('fallback, explicit remote, and no-result authority remain in the completed pipeline', () => {
  const search = functionSource('gridlySearchAddress');
  assert.match(search, /const providerResults = \[\.\.\.seedResults\]/, 'seeds remain final fallback candidates');
  assert.match(search, /providerResults\.push\(\.\.\.runtimePoiResults\)/);
  assert.match(search, /providerResults\.push\(\.\.\.variantResults\)/);
  const live = functionSource('runGridlyLiveDestinationSearch');
  assert.match(live, /allowEmptyMessage: true[\s\S]*renderPhase: "final"/);
  assert.match(app, /business_with_destination_indicator/);
  assert.match(app, /No matching destination found/);
});

test('address enrichment remains an in-place presentation update without reranking', () => {
  const enrichment = functionSource('enrichGridlyPublishedDestinationResults');
  assert.doesNotMatch(enrichment, /renderGridlySearchResults|prioritizeGridlySearchResults|dedupeGridlySearchResults|\.sort\(/);
  assert.match(enrichment, /identityUnchanged/);
});

test('LP243.F8 uses a unique browser asset identity', () => {
  assert.match(html, /js\/app\.js\?v=2445c-owner-acceptance-correction/);
});
