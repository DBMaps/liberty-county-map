import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { countyRegistryRange } from '../scripts/lp189-statewide-runtime-activation-guarded.mjs';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));

test('V783 provider is installed before the application crossing bootstrap', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const adapter = html.indexOf('js/gridlyCrossingPackageAdapter.js');
  const provider = html.indexOf('js/gridlyCrossingProvider.js');
  const app = html.indexOf('js/app.js?');

  assert.ok(adapter > 0 && provider > adapter, 'crossing adapter and provider retain V783 dependency order');
  assert.ok(provider < app, 'production provider exists before app.js registers its startup load');
  assert.equal(html.indexOf('js/gridlyCrossingProvider.js', provider + 1), -1, 'provider is loaded exactly once');
});

test('governed 254-county Crossing registry remains discoverable', () => {
  const registry = readJson('assets/package-registry/runtime-package-registry.json');
  const crossings = registry.packages.filter((pkg) => pkg.packageType === 'Crossing');
  const crossingType = registry.packageTypes.find((entry) => entry.packageType === 'Crossing');

  assert.equal(crossings.length, 254);
  assert.equal(crossingType.packageCount, 254);
  assert.equal(registry.totalPackages, 508);
  assert.deepEqual(crossings.find((pkg) => pkg.county === 'Liberty'), {
    packageType: 'Crossing',
    county: 'Liberty',
    status: 'manufactured',
    manifest: 'Crossing-Packages/liberty/package-manifest.json'
  });

  for (const record of crossings) {
    const manifest = readJson(record.manifest);
    assert.equal(manifest.packageType, 'Crossing');
    assert.equal(manifest.county, record.county);
  }

  const libertyManifest = readJson('Crossing-Packages/liberty/package-manifest.json');
  const libertyInventory = readJson(libertyManifest.packageFile);
  assert.equal(libertyManifest.crossingCount, 115);
  assert.equal(libertyInventory.features.length, 115);
});

test('254-county activation and original crossing availability remain intact', () => {
  const source = fs.readFileSync('js/app.js', 'utf8');
  const range = countyRegistryRange(source);
  const context = {};
  vm.runInNewContext(`${source.slice(0, range.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, context);
  const registry = context.registry;

  assert.equal(Object.values(registry).filter((county) => county.operational === true).length, 254);
  assert.equal(registry['liberty-tx'].runtimeSourceAvailability.crossings, 'available');
  assert.equal(registry['liberty-tx'].localCrossingsPath, 'Crossing-Packages/liberty/liberty-crossings.geojson');
  assert.deepEqual(
    [registry['anderson-tx'].operational, registry['anderson-tx'].selectable, registry['anderson-tx'].defaultAwarenessAreas.includes('Palestine')],
    [true, true, true]
  );
  assert.equal(registry['dallas-tx'].operational, true);
  assert.ok(registry['dallas-tx'].defaultAwarenessAreas.includes('Dallas'));
});
