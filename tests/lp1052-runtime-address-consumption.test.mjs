import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lookupLibertyCertifiedAddress } from '../supabase/functions/_shared/liberty-certified-address.mjs';

const root = new URL('../', import.meta.url);
let packageAccesses = 0;
const localFetch = async (url) => {
  const relative = String(url).replace('https://gridly.test/', '');
  if (relative.endsWith('.gz')) packageAccesses += 1;
  try { return new Response(await readFile(new URL(relative, root)), { status: 200 }); }
  catch { return new Response('', { status: 404 }); }
};
const request = (query, overrides = {}) => ({ intent: 'address', query, limit: 5, requestMode: 'explicit_search', ...overrides });
const lookup = (query, overrides) => lookupLibertyCertifiedAddress(request(query, overrides), { baseUrl: 'https://gridly.test', fetch: localFetch });

test('certified Liberty lookup is exact across governed road aliases', async () => {
  for (const alias of ['County Road 677', 'County Rd 677', 'CR 677', 'Co Rd 677']) {
    const result = await lookup(`276 ${alias}, Dayton, TX 77535`);
    assert.equal(result.outcome, 'exact_match');
    assert.equal(result.results[0].address.houseNumber, '276');
    assert.equal(result.results[0].address.county, 'Liberty');
    assert.equal(result.results[0].routePreviewEligible, true);
    assert.ok(result.lookupMs >= 0 && result.totalMs >= result.lookupMs);
  }
});

test('nearby, road-only, and conflicting requests fail truthfully without substitution', async () => {
  const missing = await lookup('274 County Road 677, Dayton, TX 77535');
  assert.equal(missing.outcome, 'truthful_no_result');
  assert.deepEqual(missing.results, []);
  assert.equal((await lookup('County Road 677, Dayton, TX')).attempted, false);
  for (const query of ['276 County Road 677, Austin, TX 78701', '276 County Road 677, Liberty County, TX 77535']) {
    assert.equal((await lookup(query)).attempted, false);
  }
  assert.equal((await lookup('276 County Road 677, Dayton, TX 77535', { context: { countyFips: '48201' } })).attempted, false);
});

test('business, curated, and non-Liberty traffic never accesses the package', async () => {
  const before = packageAccesses;
  assert.equal((await lookupLibertyCertifiedAddress({ intent: 'business_place', query: 'Dayton Walmart' }, { baseUrl: 'https://gridly.test', fetch: localFetch })).attempted, false);
  assert.equal((await lookup('100 Congress Avenue, Austin, TX 78701')).attempted, false);
  assert.equal(packageAccesses, before);
  const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /GRIDLY_LP097_CURATED_DESTINATIONS/);
});

test('missing or invalid certificate fails closed and browser retains provider boundary', async () => {
  const unavailable = await lookupLibertyCertifiedAddress(request('276 County Road 677, Dayton, TX 77535'), { baseUrl: '' });
  assert.equal(unavailable.outcome, 'package_unavailable');
  assert.equal(unavailable.packageAccessed, false);
  const invalidFetch = async (url) => String(url).endsWith('.json') ? Response.json({ countyId: 'liberty-tx' }) : localFetch(url);
  assert.equal((await lookupLibertyCertifiedAddress(request('276 County Road 677, Dayton, TX 77535'), { baseUrl: 'https://gridly.test', fetch: invalidFetch })).outcome, 'package_unavailable');
  const client = await readFile(new URL('../js/gridly-geocoding-client.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(client, /functions\/v1\/gridly-geocode/);
  assert.doesNotMatch(html, /lp1045-txgio-address-runtime\.js/);
});
