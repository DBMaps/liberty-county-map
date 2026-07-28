const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('js/lp097-search-governance.js', 'utf8'), sandbox);
const governance = sandbox.window.GRIDLY_LP097_SEARCH_GOVERNANCE;
const app = fs.readFileSync('js/app.js', 'utf8');

const result = ({ title, lat = 30.0562, lng = -94.7936, provider = 'nominatim', categories = ['hospital'], city = 'Liberty', county = 'Liberty County', road = '1353 North Travis Street', aliases = [], seedSource = '' }) => ({
  title, label: title, lat, lng, provider, type: categories[0],
  raw: { categories, aliases, seedSource, address: { city, county, road, state: 'Texas' } }
});
const curated = (values) => result({ provider: 'local_poi_seed', seedSource: 'lp097_governed_curated', ...values });

for (const pair of [
  [curated({ title: 'Liberty-Dayton Regional Medical Center', aliases: ['Liberty Dayton Regional Medical Center'] }), result({ title: 'Liberty Dayton Regional Medical Center' })],
  [curated({ title: 'Dayton City Hall', categories: ['government', 'city_hall'], city: 'Dayton', road: '117 Cook Street', lat: 30.046, lng: -94.8913 }), result({ title: 'Dayton City Hall', categories: ['government'], city: 'Dayton', road: '117 Cook Street', lat: 30.0461, lng: -94.8912 })]
]) {
  const output = governance.deduplicate(pair);
  assert.equal(output.results.length, 1);
  assert.equal(output.results[0].raw.seedSource, 'lp097_governed_curated');
  assert.equal(output.evidence.curatedOverProviderSurvivorCount, 1);
}

assert.equal(governance.deduplicate([
  result({ title: 'Regional Hospital', lat: 30, lng: -94 }),
  result({ title: 'Regional Hospital', lat: 31, lng: -95 })
]).results.length, 2, 'coordinate disagreement must remain unresolved');
assert.equal(governance.deduplicate([
  result({ title: 'County Office', categories: ['government'], road: '100 Main Street' }),
  result({ title: 'Tax Department', categories: ['government'], road: '100 Main Street' })
]).results.length, 2, 'same-address departments remain distinct');
assert.equal(governance.deduplicate([
  result({ title: 'Community Center', categories: ['government'] }),
  result({ title: 'Community Center', categories: ['medical'] })
]).results.length, 2, 'category disagreement remains distinct');
assert.equal(governance.deduplicate([result({ title: 'Provider Only' })]).results.length, 1);
assert.equal(governance.deduplicate([curated({ title: 'Curated Only' })]).results.length, 1);

assert.match(app, /gridlyLp097HasExplicitOutOfAreaIntent/);
assert.match(app, /preserveGridlyLp097StrongLocalResults/);
for (const phrase of ['providerRequestObservedThisSession', 'providerResponseObservedThisSession', 'providerResultRenderedThisSession', 'safeForPublicLaunch: false', 'queryRedacted: true']) assert.ok(app.includes(phrase), phrase);
assert.match(app, /window\.gridlyRecordLp097BrowserCertification/);
assert.match(app, /Unknown LP097\.1 certification field/);
assert.doesNotMatch(app + fs.readFileSync('js/lp097-search-governance.js', 'utf8'), /localStorage\.(?:setItem|getItem).*Lp097/i);
assert.doesNotMatch(app, /console\.(?:log|info|warn)\([^\n]*originalQuery/);

console.log('LP097.1 deduplication, locality, runtime certification, and privacy contracts passed.');
