import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function functionSource(name) {
  const start = app.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} exists`);
  const end = app.indexOf('\nfunction ', start + 9);
  assert.ok(end > start, `${name} has a following function boundary`);
  return app.slice(start, end);
}

test('LP243.F5 reuses the existing reverse-geocode authority after final projection', () => {
  assert.match(app, /async function gridlyReverseGeocode\(lat, lng/);
  assert.match(app, /nominatim\.openstreetmap\.org\/reverse/);
  const renderer = functionSource('renderGridlySearchResults');
  assert.ok(renderer.indexOf('dedupeGridlySearchResults(prioritizedResults)') < renderer.indexOf('enrichGridlyPublishedDestinationResults(renderedResults'));
  assert.match(renderer, /options\?\.renderPhase === "final"/);
  assert.match(app, /GRIDLY_DESTINATION_ADDRESS_ENRICHMENT_LIMIT = GRIDLY_SEARCH_RENDER_LIMIT/);
});

test('reverse lookups are canonical-coordinate cached, inflight-reused, timed out, and serialized', () => {
  const reverse = app.slice(app.indexOf('const GRIDLY_DESTINATION_ADDRESS_ENRICHMENT_LIMIT'), app.indexOf('function buildGridlyResultShapePreviewItem'));
  assert.match(reverse, /toFixed\(5\)/);
  assert.match(reverse, /gridlyReverseGeocodeCache\.has/);
  assert.match(reverse, /gridlyReverseGeocodeInflight\.has/);
  assert.match(reverse, /gridlyReverseGeocodeQueue\.then\(lookup, lookup\)/);
  assert.match(reverse, /gridlyReverseGeocodeNextAllowedAt = Date\.now\(\) \+ 1100/);
  assert.match(reverse, /controller\.abort\(\), 3500/);
  assert.match(reverse, /\.slice\(0, GRIDLY_DESTINATION_ADDRESS_ENRICHMENT_LIMIT\)/);
  assert.match(reverse, /runtimeSchemaVersion === "gridly\.poi\.runtime\.v2"/);
});

test('presentation formatter uses only provider-returned address fields and preserves locality types', () => {
  const source = functionSource('gridlyBuildPresentationAddress');
  const context = { Object };
  vm.runInNewContext(`${source}; this.format = gridlyBuildPresentationAddress;`, context);
  const full = context.format({ raw: { address: { house_number: '1234', road: 'Example Rd', city: 'Port Arthur' } } });
  assert.equal(full.consumerLine, '1234 Example Rd · Port Arthur');
  assert.equal(full.localityType, 'city');
  const roadOnly = context.format({ raw: { address: { road: 'Example Rd', town: 'Example Town' } } });
  assert.equal(roadOnly.consumerLine, 'Example Rd · Example Town');
  assert.equal(roadOnly.houseNumber, '');
  assert.equal(roadOnly.localityType, 'town');
  assert.equal(context.format({ raw: { address: {} } }), null);
});

test('enrichment is presentation-only and cannot enter ranking, governance, or route authority', () => {
  const enrichment = functionSource('enrichGridlyPublishedDestinationResults');
  assert.match(enrichment, /result\.presentationAddress = presentationAddress/);
  assert.doesNotMatch(enrichment, /\.sort\(|prioritizeGridlySearchResults|dedupeGridlySearchResults/);
  assert.doesNotMatch(enrichment, /result\.(?:lat|lng|providerId|id|category|countyContextId)\s*=/);
  assert.match(enrichment, /identityUnchanged/);
  const selection = app.slice(app.indexOf('itemBtn.addEventListener("click"'), app.indexOf('resultsContainer.appendChild(list)'));
  assert.match(selection, /selectGridlySearchResult\(picked\)/);
  assert.doesNotMatch(selection, /presentationAddress/);
});

test('failure remains a normal row and async enhancement does not rerender or reorder', () => {
  const reverse = app.slice(app.indexOf('async function gridlyReverseGeocode('), app.indexOf('async function enrichGridlyPublishedDestinationResults'));
  assert.match(reverse, /return null/);
  const enrichment = functionSource('enrichGridlyPublishedDestinationResults');
  assert.match(enrichment, /if \(!presentationAddress \|\| !isGridlyLiveSearchRenderCurrent\(options\)\) return/);
  assert.doesNotMatch(enrichment, /renderGridlySearchResults|textContent = ""|remove\(/);
  const display = functionSource('buildGridlySearchDisplayLines');
  assert.match(display, /presentationAddress\?\.consumerLine/);
});

test('LP243.F5 enrichment remains published through the current browser asset identity', () => {
  assert.match(html, /js\/app\.js\?v=2445c-owner-acceptance-correction/);
});
