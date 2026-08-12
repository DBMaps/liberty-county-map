import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { consumerAvailabilityFromPackage } from '../scripts/lp189-statewide-runtime-activation-guarded.mjs';

const app = fs.readFileSync('js/app.js', 'utf8');
const resolverSource = app.match(/function resolveGridlyAwarenessAreaQuery\([\s\S]*?\n\}/)?.[0];

test('LP188 package projection retains county FIPS, eligible communities, and PLACE GEOID', () => {
  const projected = consumerAvailabilityFromPackage({
    county: { countyFips: '48001', displayName: 'Anderson' },
    censusPlaces: [
      { placeGeoid: '4854708', displayName: 'Palestine', consumerEligible: true },
      { placeGeoid: '4899999', displayName: 'Ineligible fixture', consumerEligible: false }
    ]
  });
  assert.deepEqual([...projected.defaultAwarenessAreas], ['Anderson County', 'Palestine']);
  assert.deepEqual(projected.consumerAwarenessAreas[0], { placeGeoid: '4854708', displayName: 'Palestine', canonicalIdentity: 'PLACE_GEOID' });
});

test('75801 and Palestine use the selectable canonical area while Liberty remains available and Dallas does not', () => {
  const areas = [
    { key: 'anderson-tx-palestine', label: 'Palestine', storageValue: 'Palestine', countyId: 'anderson-tx', placeGeoid: '4854708' },
    { key: 'liberty', label: 'Liberty', storageValue: 'Liberty', countyId: 'liberty-tx' }
  ];
  const records = [
    { zip: '75801', countyId: 'anderson-tx', countyName: 'Anderson County', awarenessAreaKey: 'anderson-tx-palestine', communityName: 'Palestine', resolutionStatus: 'resolved' },
    { zip: '77575', countyId: 'liberty-tx', countyName: 'Liberty County', awarenessAreaKey: 'liberty', communityName: 'Liberty', resolutionStatus: 'resolved' },
    { zip: '75201', countyId: 'dallas-tx', countyName: 'Dallas County', awarenessAreaKey: 'dallas-tx-dallas', communityName: 'Dallas', resolutionStatus: 'resolved' }
  ];
  const context = {
    GRIDLY_LP051_ZIP_AWARENESS_INDEX: { records }, GRIDLY_V858_FIRST_RUN_ZIP_TO_AREA: {},
    GRIDLY_AWARENESS_AREA_DEFINITIONS: areas,
    GRIDLY_AWARENESS_AREA_BY_KEY: Object.fromEntries(areas.map(area => [area.key, area])),
    GRIDLY_COUNTY_REGISTRY: { 'anderson-tx': { name: 'Anderson County' }, 'liberty-tx': { name: 'Liberty County' } },
    gridlyNormalizeCountyId: value => value,
    gridlyGetSelectableOperationalCountyIds: () => ['anderson-tx', 'liberty-tx'],
    normalizeGridlyAwarenessAreaLookupText: value => String(value || '').trim().toLowerCase(),
    resolveGridlyAwarenessArea: value => areas.find(area => area.label.toLowerCase() === String(value).toLowerCase()) || null
  };
  vm.runInNewContext(`${resolverSource}; this.resolve = resolveGridlyAwarenessAreaQuery`, context);
  assert.equal(context.resolve('75801').status, 'RESOLVED_OPERATIONAL');
  assert.equal(context.resolve('77575').status, 'RESOLVED_OPERATIONAL');
  assert.equal(context.resolve('75201').status, 'RESOLVED_NOT_OPERATIONAL');
  const town = context.resolve('Palestine');
  assert.equal(town.status, 'RESOLVED_OPERATIONAL');
  assert.equal(town.awarenessArea.placeGeoid, '4854708');
});

test('consumer bridge is isolated from protected systems and polygon resolver', () => {
  assert.match(app, /"anderson-tx"[\s\S]{0,1200}defaultAwarenessAreas:[\s\S]*?consumerAwarenessAreas:[\s\S]*?placeGeoid: "4854708"/);
  assert.doesNotMatch(consumerAvailabilityFromPackage.toString(), /gridlyResolveCountyIdForCoordinate|hazard|alert|supabase|route|crossing/i);
});
