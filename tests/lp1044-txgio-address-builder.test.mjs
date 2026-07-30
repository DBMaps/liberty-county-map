import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeStreet, normalizeFeature, ogrArguments, parseArguments } from '../tools/lp104/build-txgio-address-packages.mjs';

const county = { countyId: 'liberty', countyName: 'Liberty', fips: '48291' };
const feature = {
  type: 'Feature', geometry: { type: 'Point', coordinates: [-94.79512349, 30.05765449] },
  properties: { Add_Number: ' 123 ', St_PreDir: 'N', St_Name: 'Main', St_PosTyp: 'Rd', Full_Addr: '123 N Main Rd', Post_Comm: 'Liberty', Post_Code: '77575', County: 'Liberty', FIPS: '48291', Source: 'TxGIO', DateUpdate: '2026-01-15' },
};

test('Liberty is an explicit, exclusive build mode', () => {
  assert.deepEqual(parseArguments(['--liberty']), { liberty: true });
  assert.throws(() => parseArguments(['--liberty', '--all-texas']), /exactly one/);
  assert.throws(() => parseArguments([]), /exactly one/);
});

test('normalizes the strict runtime fields and deterministic ID', () => {
  assert.equal(completeStreet(feature.properties), 'N Main Rd');
  const first = normalizeFeature(feature, county).record;
  const second = normalizeFeature(structuredClone(feature), county).record;
  assert.deepEqual(first, second);
  assert.deepEqual(first, { i: first.i, h: '123', r: 'N Main Rd', a: '123 N Main Rd', p: 'Liberty', z: '77575', c: 'Liberty', f: '48291', x: -94.795123, y: 30.057654, s: 'TxGIO', u: '2026-01-15' });
  assert.match(first.i, /^[a-f0-9]{20}$/);
});

test('strictly rejects missing exact-address evidence', () => {
  for (const key of ['Add_Number', 'St_Name', 'Full_Addr']) {
    const altered = structuredClone(feature); altered.properties[key] = '';
    assert.ok(normalizeFeature(altered, county).rejection);
  }
  const wrong = structuredClone(feature); wrong.properties.FIPS = '48339';
  assert.match(normalizeFeature(wrong, county).rejection, /unexpected FIPS/);
});

test('ogr2ogr reads by numeric FIPS and transforms to WGS84 without updating source', () => {
  const args = ogrArguments('Texas-2026.gdb', 'stratmap_2026_address_points_48', '48291');
  assert.ok(!args.includes('-ro'));
  assert.equal(args[args.indexOf('-where') + 1], 'FIPS = 48291');
  assert.equal(args[args.indexOf('-t_srs') + 1], 'EPSG:4326');
  assert.equal(args[2], '/vsistdout/');
  assert.ok(!args.includes('-update'));
});
