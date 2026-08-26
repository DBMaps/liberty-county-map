import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { countyRegistryRange } from '../scripts/lp189-statewide-runtime-activation-guarded.mjs';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const app = read('js/app.js');
const statewide = JSON.parse(read('data/generated/gridly-statewide-consumer-community-projection-v1.json')).communities;
const range = countyRegistryRange(app);
const registrySandbox = { Object };
vm.createContext(registrySandbox);
vm.runInContext(`${app.slice(0, range.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, registrySandbox);
const registry = registrySandbox.registry;

const start = app.indexOf('function gridlyResolveCanonicalPlaceRegistryIdentity');
const end = app.indexOf('// LP239.4 deterministic browser parity surface', start);
const resolverSandbox = {
  GRIDLY_COUNTY_REGISTRY: registry,
  gridlyNormalizeCountyId: value => String(value || '').trim().toLowerCase(),
  normalizeGridlyAwarenessAreaLookupText: value => String(value || '').trim().toLowerCase().replaceAll(/[\s_–—-]+/g, ' ')
};
vm.createContext(resolverSandbox);
vm.runInContext(`${app.slice(start, end)};this.resolve=gridlyResolveCanonicalPlaceGeoid`, resolverSandbox);

const statewideById = new Map(statewide.map(place => [place.placeGeoid, place]));
const liveRows = Object.entries(registry).flatMap(([countyId, county]) =>
  (county.consumerAwarenessAreas || []).map(place => ({ countyId, ...place })));
const uniqueLiveRows = [...new Map(liveRows.map(row => [row.placeGeoid, row])).values()];

test('Beaumont thin selected-area identity resolves through the statewide canonical PLACE authority', () => {
  const selectedArea = { key: 'beaumont', label: 'Beaumont', storageValue: 'Beaumont', countyId: 'jefferson-tx' };
  assert.equal(resolverSandbox.resolve(selectedArea), '4807000');
  const place = statewideById.get('4807000');
  assert.equal(place.displayName, 'Beaumont');
  assert.deepEqual(place.countyMemberships, ['48245']);
});

test('all live canonical communities have exact live/statewide PLACE identity parity', () => {
  assert.equal(uniqueLiveRows.length, statewide.length);
  const parity = uniqueLiveRows.map(place => ({
    liveCanonicalCommunity: place.displayName,
    liveCanonicalPlaceId: resolverSandbox.resolve({ label: place.displayName, countyId: place.countyId }),
    statewideCanonicalPlaceId: statewideById.get(place.placeGeoid)?.placeGeoid || null
  })).map(row => ({ ...row, identityParityPass: row.liveCanonicalPlaceId === row.statewideCanonicalPlaceId }));
  assert.deepEqual(parity.filter(row => !row.identityParityPass), []);
  assert.ok(parity.every(row => Object.hasOwn(row, 'liveCanonicalCommunity') && Object.hasOwn(row, 'liveCanonicalPlaceId') && Object.hasOwn(row, 'statewideCanonicalPlaceId')));
});

test('LP239.4 resolver remains fail-closed and town-neutral', () => {
  assert.equal(resolverSandbox.resolve({ label: 'Known only to a consumer', countyId: 'jefferson-tx' }), null);
  assert.equal(resolverSandbox.resolve({ label: 'Beaumont' }), null);
  const source = app.slice(start, end);
  assert.doesNotMatch(source, /Beaumont|Katy|Pearland|Waskom|Texarkana|League City|San Antonio|Austin|Dallas/);
  assert.match(source, /candidates\.length !== 1/);
  assert.match(source, /GRIDLY_COUNTY_REGISTRY\[countyId\]\?\.consumerAwarenessAreas/);
});

test('owner cohort and major controls resolve from the same live path', () => {
  const controls = {
    Waskom: '4876636', Texarkana: '4872368', Katy: '4838476', Pearland: '4856348',
    'League City': '4841980', 'San Antonio': '4865000', Austin: '4805000', Dallas: '4819000'
  };
  for (const [name, id] of Object.entries(controls)) {
    const live = liveRows.find(row => row.placeGeoid === id);
    assert.ok(live, name);
    assert.equal(resolverSandbox.resolve({ label: name, countyId: live.countyId }), id, name);
  }
});

test('browser parity audit exposes the required result contract and fails any mismatch', () => {
  const source = app.slice(app.indexOf('function gridlyLiveCanonicalPlaceIdentityParityAudit'), app.indexOf('function gridlyResolveCanonicalCountyIdForOperationalContext'));
  for (const field of ['liveCanonicalCommunity', 'liveCanonicalPlaceId', 'statewideCanonicalPlaceId', 'identityParityPass', 'mismatchCount', 'overallPass']) assert.match(source, new RegExp(field));
  assert.match(source, /rows\.every\(\(row\) => row\.identityParityPass\)/);
});
