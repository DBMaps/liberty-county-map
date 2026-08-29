import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const bodyStart = app.indexOf(' {\n', start) + 1;
  assert.notEqual(bodyStart, 0, `${name} body exists`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === '{') depth += 1;
    if (app[index] === '}') depth -= 1;
    if (depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

const resolverSource = functionSource('gridlyResolveCrossingRenderInventory');
const policySource = functionSource('getGridlyRegionalCrossingVisibilityPolicy');
const bounds = { contains: ([lat, lng]) => lat >= 29.32 && lat <= 29.42 && lng >= -101 && lng <= -100.88 };

function crossings(count, countyId, inViewCount = count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${countyId}-${index}`,
    countyId,
    lat: index < inViewCount ? 29.367 + index * 0.0001 : 30.5 + index * 0.001,
    lng: index < inViewCount ? -100.943 + index * 0.0001 : -102
  }));
}

function resolveFor({ countyId, inventory, canonicalResolution }) {
  const context = {
    gridlyGetActiveCountyId: () => countyId,
    gridlyGetActiveCountyCrossingInventory: () => inventory,
    gridlyCrossingSampleMatchesCounty: (crossing, active) => crossing.countyId === active
  };
  vm.runInNewContext(`${resolverSource}; this.resolve = gridlyResolveCrossingRenderInventory`, context);
  return context.resolve(canonicalResolution);
}

function policyFor(inventory, countyId, zoom = 12) {
  const context = {
    crossings: inventory,
    map: { getBounds: () => bounds },
    gridlyGetActiveCountyId: () => countyId,
    getCurrentCrossingInfrastructureZoom: () => zoom,
    CROSSING_INFRASTRUCTURE_MIN_ZOOM: 14,
    GRIDLY_REGIONAL_CROSSING_VISIBILITY_POLICY: {
      version: 'test-policy', mediumZoomMin: 12, neighborhoodZoomMin: 14,
      streetZoomMin: 15, veryCloseZoomMin: 17,
      mediumRepresentativeLimit: 80, neighborhoodViewportLimit: 160
    }
  };
  vm.runInNewContext(`${policySource}; this.policy = getGridlyRegionalCrossingVisibilityPolicy`, context);
  return context.policy({ zoom, inventoryCount: inventory.length, bounds, activeCountyId: countyId });
}

test('Cienegas empty PLACE projection cannot erase Val Verde governed inventory', () => {
  const governed = crossings(47, 'val-verde-tx', 16);
  const resolved = resolveFor({
    countyId: 'val-verde-tx', inventory: governed,
    canonicalResolution: { authorityAvailable: true, records: [] }
  });
  assert.equal(resolved.length, 47);
  const policy = policyFor(resolved, 'val-verde-tx');
  const candidates = resolved.filter((crossing) => bounds.contains([crossing.lat, crossing.lng]));
  const representative = candidates.slice(0, policy.markerLimit);
  const renderedMarkers = representative.map((crossing) => crossing.id);
  assert.equal(candidates.length, 16);
  assert.notEqual(policy.renderMode, 'none');
  assert.notEqual(policy.visibilityReason, 'active county crossing inventory is empty');
  assert.ok(representative.length > 0);
  assert.ok(renderedMarkers.length > 0);
});

test('genuine ACTIVE_EMPTY county retains empty policy without fallback', () => {
  const resolved = resolveFor({
    countyId: 'tyler-tx', inventory: [],
    canonicalResolution: { authorityAvailable: true, records: [] }
  });
  const policy = policyFor(resolved, 'tyler-tx');
  assert.equal(resolved.length, 0);
  assert.equal(policy.renderMode, 'none');
  assert.equal(policy.visibilityReason, 'active county crossing inventory is empty');
});

test('Huntsville populated canonical scope remains narrowed to exact governed IDs', () => {
  const governed = crossings(48, 'walker-tx');
  const canonical = [governed[4], governed[9], governed[20]];
  const resolved = resolveFor({
    countyId: 'walker-tx', inventory: governed,
    canonicalResolution: { authorityAvailable: true, records: canonical }
  });
  assert.deepEqual(Array.from(resolved, (crossing) => crossing.id), canonical.map((crossing) => crossing.id));
});

test('county transition rejects stale canonical records and uses the new county inventory', () => {
  const valVerde = crossings(47, 'val-verde-tx');
  const walker = crossings(48, 'walker-tx');
  const resolved = resolveFor({
    countyId: 'val-verde-tx', inventory: valVerde,
    canonicalResolution: { authorityAvailable: true, records: walker.slice(0, 3) }
  });
  assert.equal(resolved.length, 47);
  assert.ok(resolved.every((crossing) => crossing.countyId === 'val-verde-tx'));
  assert.equal(resolved.some((crossing) => walker.includes(crossing)), false);
});

test('repair introduces no crossing fallback or Cienegas-specific production branch', () => {
  assert.doesNotMatch(resolverSource, /fetch|fallback|Cienegas|val-verde/i);
  assert.match(resolverSource, /gridlyGetActiveCountyCrossingInventory\(\)/);
});
