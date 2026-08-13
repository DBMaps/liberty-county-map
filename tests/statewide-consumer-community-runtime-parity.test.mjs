import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { countyRegistryRange } from '../scripts/lp189-statewide-runtime-activation-guarded.mjs';
import { integrateRuntime } from '../tools/integrate-statewide-consumer-community-runtime.mjs';

const source = fs.readFileSync('js/app.js', 'utf8');
const projection = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-consumer-community-projection-v1.json', 'utf8'));
const geometry = JSON.parse(fs.readFileSync('assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json', 'utf8'));
const range = countyRegistryRange(source);
const context = {};
vm.runInNewContext(`${source.slice(0, range.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, context);
const registry = context.registry;
const idByFips = new Map(geometry.counties.map(county => [county.fips, county.countyId]));
const runtimeMemberships = Object.values(registry).flatMap(county => county.consumerAwarenessAreas || []);

test('runtime integration is byte-idempotent for LF and CRLF checkouts', () => {
  const lfSource = source.replace(/\r\n/g, '\n');
  const crlfSource = lfSource.replace(/\n/g, '\r\n');

  assert.equal(integrateRuntime(lfSource, projection, geometry), lfSource);
  assert.equal(integrateRuntime(crlfSource, projection, geometry), crlfSource);
});

test('runtime counts exactly equal the governed portable projection', () => {
  assert.equal(Object.keys(registry).length, 254);
  assert.equal(runtimeMemberships.length, projection.counts.membershipCount);
  assert.equal(new Set(runtimeMemberships.map(place => place.placeGeoid)).size, projection.counts.uniquePlaceCount);
  assert.equal(projection.communities.filter(place => place.countyMemberships.length > 1).length, projection.counts.multiCountyPlaceCount);
  assert.equal(projection.exclusions.length, projection.counts.excludedIneligibleCount);
  assert.ok(projection.exclusions.every(excluded => !runtimeMemberships.some(place => place.placeGeoid === excluded.placeGeoid)));
});

test('every county runtime list has exact source parity and complete memberships', () => {
  for (const county of projection.counties) {
    const runtime = registry[idByFips.get(county.countyFips)];
    assert.ok(runtime, county.countyFips);
    assert.equal(runtime.countyFips ?? county.countyFips, county.countyFips);
    assert.equal(runtime.consumerAwarenessAreas.length, county.communities.length, county.displayName);
    assert.deepEqual(
      JSON.parse(JSON.stringify(runtime.consumerAwarenessAreas.map(({ focus, ...place }) => place))),
      county.communities.map(place => ({ ...place, consumerEligible: true, canonicalIdentity: 'PLACE_GEOID' }))
    );
    assert.ok(runtime.defaultAwarenessAreas.length > 0, `${county.displayName} countywide path`);
  }
});

const majorCities = ['Houston','Dallas','San Antonio','Austin','Fort Worth','El Paso','Arlington','Corpus Christi','Plano','Lubbock','Laredo','Irving','Garland','Frisco','McKinney','Amarillo','Brownsville','Killeen','Pasadena','Mesquite','McAllen','Waco','Midland','Odessa','Abilene','Beaumont','Tyler','College Station','Palestine','Liberty'];

test('major-city inventory and required searches are governed', () => {
  for (const city of majorCities) assert.ok(runtimeMemberships.some(place => place.displayName === city), city);
  assert.ok(registry['el-paso-tx'].consumerAwarenessAreas.some(place => place.displayName === 'El Paso'));
  assert.ok(registry['webb-tx'].consumerAwarenessAreas.some(place => place.displayName === 'Laredo'));
  assert.equal(registry['dallas-tx'].consumerAwarenessAreas.length, projection.counties.find(county => county.countyFips === '48113').communities.length);
});

test('multi-county PLACE membership arrays remain intact in every county occurrence', () => {
  for (const place of projection.communities.filter(place => place.countyMemberships.length > 1)) {
    for (const fips of place.countyMemberships) {
      const occurrence = registry[idByFips.get(fips)].consumerAwarenessAreas.find(item => item.placeGeoid === place.placeGeoid);
      assert.deepEqual(JSON.parse(JSON.stringify(occurrence.countyMemberships)), place.countyMemberships, `${place.displayName}/${fips}`);
    }
  }
});

test('manual countywide apply is valid without fabricating a PLACE GEOID', () => {
  assert.match(source, /const countywideManual = area\?\.countyWide === true[\s\S]*?!record\.communityKey/);
  assert.match(source, /communityKey: area\.countyWide === true \? null/);
  assert.match(source, /resolutionStatus: area\.countyWide === true \? "manual_countywide_confirmed"/);
  assert.doesNotMatch(source, /communityKey: area\.countyWide === true \? ["']48\d{5}/);
});
