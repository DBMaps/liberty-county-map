const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('window.gridlyDestinationProviderAudit = async function gridlyDestinationProviderAudit');
assert.ok(cutoff > 0, 'destination search containment helpers are defined before provider audit binding');

function loadRuntime() {
  const fetchCalls = [];
  const sandbox = {
    console: { ...console, info: () => {}, warn: () => {} },
    window: {
      GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx',
      addEventListener: () => {},
      removeEventListener: () => {},
      setInterval,
      clearInterval,
      setTimeout,
      clearTimeout,
      matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
      navigator: {}
    },
    document: {
      addEventListener: () => {},
      removeEventListener: () => {},
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ className: '', dataset: {}, appendChild: () => {}, addEventListener: () => {} }),
      documentElement: { style: {} },
      body: { classList: { toggle: () => {}, add: () => {}, remove: () => {} } }
    },
    navigator: {},
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    activeGeoFilter: 'county',
    LOCATION_DEFAULTS: { country: 'USA', state: 'Texas', county: 'Liberty County' },
    normalizeGridlyUserFacingRoadText: (value) => String(value || '').replace(/\s+/g, ' ').trim(),
    getGridlySelectedAwarenessArea: () => ({ countyId: 'montgomery-tx', label: 'Conroe', key: 'conroe', storageValue: 'Conroe', lat: 30.3119, lng: -95.4558 }),
    crypto: { randomUUID: () => 'test-uuid' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    fetch: async (url) => {
      fetchCalls.push(String(url));
      return {
        ok: true,
        json: async () => [
          { place_id: 'conroe-walmart', display_name: 'Walmart Supercenter, Conroe, Montgomery County, Texas, United States', lat: '30.3285', lon: '-95.4710', type: 'supermarket', address: { city: 'Conroe', county: 'Montgomery County', state: 'Texas', country: 'United States' } },
          { place_id: 'liberty-walmart', display_name: 'Walmart Supercenter, Liberty, Liberty County, Texas, United States', lat: '30.0751', lon: '-94.7844', type: 'supermarket', address: { city: 'Liberty', county: 'Liberty County', state: 'Texas', country: 'United States' } },
          { place_id: 'harris-walmart', display_name: 'Walmart Supercenter, Houston, Harris County, Texas, United States', lat: '29.7604', lon: '-95.3698', type: 'supermarket', address: { city: 'Houston', county: 'Harris County', state: 'Texas', country: 'United States' } }
        ]
      };
    }
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(`${source.slice(0, cutoff)}\ngetGridlySelectedAwarenessArea = () => ({ countyId: 'montgomery-tx', label: 'Conroe', key: 'conroe', storageValue: 'Conroe', lat: 30.3119, lng: -95.4558 });
haversineDistance = (lat1, lng1, lat2, lng2) => { const r = 3958.8; const toRad = (v) => Number(v) * Math.PI / 180; const dLat = toRad(lat2 - lat1); const dLng = toRad(lng2 - lng1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2; return 2 * r * Math.asin(Math.sqrt(a)); };\nthis.api = { gridlySearchAddress, gridlyDestinationSearchContainmentAudit, searchGridlyLocalPoiSeeds, buildGridlySearchQueryVariants };`, sandbox);
  return { api: sandbox.api, fetchCalls };
}

(async () => {
  const { api, fetchCalls } = loadRuntime();
  const seedResults = api.searchGridlyLocalPoiSeeds('walmart');
  assert.strictEqual(seedResults.length, 0, 'Montgomery generic Walmart search does not use Liberty/Cleveland seeds');

  const variants = api.buildGridlySearchQueryVariants('walmart');
  assert(variants.includes('walmart near Conroe Texas'), 'Conroe context is added to local query variants');
  assert(variants.includes('walmart Montgomery County Texas'), 'Montgomery county context is added to local query variants');
  assert(!variants.includes('walmart Liberty County Texas'), 'Liberty query expansion is not used in Montgomery context');

  const results = await api.gridlySearchAddress('walmart', { limit: 5 });
  assert.strictEqual(results.length, 1, 'Out-of-county provider results are filtered for Montgomery generic searches');
  assert.match(results[0].raw.display_name, /Conroe|Montgomery County/i, 'Remaining result is Montgomery-local');
  assert(fetchCalls.some((url) => url.includes('bounded=1')), 'Provider query is bounded for Montgomery generic search');
  assert(fetchCalls.some((url) => url.includes('viewbox=-95.83024%2C30.630284%2C-95.0964%2C30.087076')), 'Provider query uses Montgomery awareness bounds');

  const audit = await api.gridlyDestinationSearchContainmentAudit('walmart');
  assert.strictEqual(audit.activeCounty, 'montgomery-tx');
  assert.strictEqual(audit.activeTown, 'Conroe');
  assert.strictEqual(audit.searchBoundsSource, 'montgomery-awareness-bounds');
  assert.strictEqual(audit.boundedSearchEnabled, true);
  assert.strictEqual(audit.libertyLeakDetected, false);
  assert.strictEqual(audit.harrisLeakDetected, false);
  assert.strictEqual(audit.safeForMontgomerySearch, true);
  console.log('Destination search containment V620 tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
