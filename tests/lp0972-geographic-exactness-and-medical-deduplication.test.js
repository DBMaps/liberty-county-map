const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('js/lp097-search-governance.js', 'utf8'), sandbox);
const governance = sandbox.window.GRIDLY_LP097_SEARCH_GOVERNANCE;
const app = fs.readFileSync('js/app.js', 'utf8');

const model = (overrides = {}) => ({
  houseNumber: '810', street: '810 County Road 412',
  explicitGeography: {},
  expectedGeography: { city: 'Dayton', county: 'Liberty County', state: 'Texas', postalCode: '77535' },
  expectedCenter: { lat: 30.0466, lng: -94.8852 }, explicitOutOfArea: false, ...overrides
});
const address = (overrides = {}) => ({
  lat: 30.05, lng: -94.89,
  raw: { address: { house_number: '810', road: 'County Road 412', city: 'Dayton', county: 'Liberty County', state: 'TX', postcode: '77535', ...overrides } }
});
const evaluate = (m, r) => governance.evaluateAddressExactness(m, r);

assert.equal(evaluate(model(), address({ county: 'Medina County' })).exact, false, 'same number/road in a wrong county');
assert.ok(evaluate(model(), address({ county: 'Medina County' })).reasons.includes('enriched_locality_conflict'));
assert.equal(evaluate(model(), address({ postcode: '78016' })).exact, false, 'wrong ZIP');
assert.ok(evaluate(model(), address({ postcode: '78016' })).reasons.includes('postal_code_conflict'));
assert.ok(evaluate(model(), address({ state: 'Ohio' })).reasons.includes('state_mismatch'), 'wrong state');
assert.equal(evaluate(model(), address()).exact, true, 'correct county and ZIP');
assert.equal(evaluate(model({ expectedGeography: { county: 'Liberty County', state: 'Texas' } }), address()).exact, true, 'correct county without enriched ZIP');
assert.equal(evaluate(model({ explicitOutOfArea: true, explicitGeography: { city: 'Dayton', state: 'Ohio' }, expectedGeography: {}, expectedCenter: null }), address({ city: 'Dayton', state: 'Ohio', county: 'Montgomery County', postcode: '45402' })).exact, true, 'explicit out-of-area city/state');
assert.equal(evaluate(model({ explicitOutOfArea: true, explicitGeography: { state: 'Colorado' }, expectedGeography: {}, expectedCenter: null }), address({ city: 'Denver', county: 'Denver County', state: 'Colorado', postcode: '80202' })).exact, true, 'explicit out-of-area state');
assert.ok(evaluate(model(), { ...address({ county: 'Medina County', postcode: '78016' }), lat: 29.35, lng: -98.88 }).reasons.includes('outside_expected_geography'), 'distant enriched conflict');
assert.equal(evaluate(model(), address({ house_number: '' })).exact, false, 'no local exact result');
assert.ok(evaluate(model(), address({ road: 'County Road 413' })).reasons.includes('street_mismatch'), 'fallback is not exact');

const place = ({ title, curated = false, lat = 30.0562, lng = -94.7936, city = 'Liberty', county = 'Liberty County', postcode = '77575', road = '1353 North Travis Street', categories = ['hospital'], aliases = [], displayName = '' }) => ({
  title, label: title, lat, lng, provider: curated ? 'local_poi_seed' : 'nominatim', type: categories[0],
  raw: { seedSource: curated ? 'lp097_governed_curated' : '', categories, aliases, display_name: displayName, address: { city, county, postcode, road, state: 'Texas' } }
});
const curated = place({ title: 'Liberty-Dayton Regional Medical Center', curated: true, aliases: ['Liberty Dayton Regional Medical Center', 'Liberty Hospital'] });
const dedupe = (provider) => governance.deduplicate([provider, curated]);
assert.equal(dedupe(place({ title: 'Liberty Dayton Regional Medical Center', road: 'Travis Avenue' })).results.length, 1, 'different street strings');
assert.equal(dedupe(place({ title: 'Liberty Hospital', road: 'Travis Avenue' })).results.length, 1, 'governed alias');
assert.equal(dedupe(place({ title: 'Liberty Dayton Medical Center', lat: 30.057, lng: -94.794 })).results.length, 1, 'nearby coordinates');
assert.equal(governance.deduplicate([place({ title: 'Regional Medical Center', city: 'Liberty' }), place({ title: 'Regional Medical Center', city: 'Dayton', lat: 30.2 })]).results.length, 2, 'generic names in different communities');
assert.equal(governance.deduplicate([place({ title: 'Liberty Dayton Cardiology Department' }), curated]).results.length, 2, 'distinct department');
assert.equal(dedupe(place({ title: 'Liberty Dayton Medical Center', lat: 31.5, lng: -96, city: 'Other', county: 'Other County', postcode: '70000' })).results.length, 2, 'coordinate/locality disagreement');
assert.equal(governance.deduplicate([place({ title: curated.title, categories: ['school'] }), curated]).results.length, 2, 'category disagreement');
assert.equal(governance.deduplicate([curated]).results.length, 1, 'curated only');
assert.equal(governance.deduplicate([place({ title: 'Provider Only Medical' })]).results.length, 1, 'provider only');
assert.equal(dedupe(place({ title: '1353 North Travis Street', displayName: 'Liberty Dayton Regional Medical Center, 1353 North Travis Street, Liberty' })).results[0].raw.seedSource, 'lp097_governed_curated', 'confirmed curated survivor');

for (const contract of ['milestone: "LP097.2"', 'addressGeographyMatchPass', 'wrongCountyExactPrevented', 'curatedMedicalSurvivorObserved', 'safeForPublicLaunch: false']) assert.ok(app.includes(contract), contract);
assert.match(app, /Unknown LP097\.2 certification field/);
assert.doesNotMatch(app, /accepted = new Set\([^\n]*(?:rawQuery|coordinates|latitude|longitude)/);
assert.doesNotMatch(app, /localStorage\.(?:setItem|getItem).*Lp097/i);

console.log('LP097.2 geographic exactness, medical identity, and runtime certification contracts passed.');
