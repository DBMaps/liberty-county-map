import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const providerSource = fs.readFileSync('js/gridlyCrossingProvider.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('Crossing-Packages/production-crossing-manifest.json', 'utf8'));

function loadJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}

function providerHarness() {
  const window = {};
  const context = {
    window,
    fetch: async (path) => ({ ok: true, status: 200, json: async () => loadJson(path) }),
    Date
  };
  window.gridlyCrossingPackageAdapter = {
    buildAdaptedCrossingGeojson: async (path) => loadJson(path),
    getLastLoadTrace: () => null
  };
  vm.runInNewContext(providerSource, context);
  return window.gridlyCrossingProvider;
}

test('governed source cannot be overridden by the five-record diagnostic modes', async () => {
  const provider = providerHarness();
  provider.setMode('legacy');
  for (const county of ['Liberty', 'Montgomery', 'San Jacinto', 'Chambers', 'Jefferson', 'Travis']) {
    const record = manifest.records.find((row) => row.county === county);
    const result = await provider.getActiveCountyCrossings({ countyId: county.toLowerCase(), sourcePath: record.packageFile });
    assert.equal(result.features.length, record.crossingCount, county);
    assert.equal(provider.getLastLoadTrace().mode, 'production');
  }
});

test('all 254 governed county packages satisfy exact count and unique identity publication prerequisites', () => {
  assert.equal(manifest.records.length, 254);
  assert.equal(manifest.passCount, 254);
  for (const record of manifest.records) {
    const packageGeojson = loadJson(record.packageFile);
    const features = packageGeojson.features || [];
    const identities = features.map((feature, index) => {
      const p = feature.properties || {};
      return String(p.CROSSING || p.crossing || p.crossing_id || p.crossingId || p.id || feature.id || `index:${index}`);
    });
    assert.equal(features.length, record.crossingCount, `${record.county} exact count`);
    assert.equal(new Set(identities).size, identities.length, `${record.county} unique identities`);
  }
});

test('consumer copy distinguishes an incomplete inventory from governed zero', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  assert.match(app, /crossingInventoryComplete[\s\S]*"Crossing inventory unavailable"/);
  assert.match(app, /crossingInventoryComplete[\s\S]*`\$\{crossingsCount\} crossings watched`/);
  assert.match(app, /Governed Crossing duplicate identity/);
});

