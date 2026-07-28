const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('js/lp097-curated-destinations.js', 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync('js/lp098-curated-destinations.js', 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync('js/lp099-business-search.js', 'utf8'), sandbox);
sandbox.window.gridlyDestinationSearchBatchTest = async () => [];

const model = sandbox.window.GRIDLY_LP099_BUSINESS_SEARCH;
const audit = sandbox.window.gridlyLp099BusinessSearchAudit();
assert.equal(audit.available, true);
assert.equal(audit.milestone, 'LP099');
assert.equal(audit.representativeBusinessQueries, 112);
assert.equal(audit.representativeBusinessPasses, 112);
assert.equal(audit.certifiedCountyCount, 28);
assert.equal(audit.duplicateBusinessResults, 0);
assert.equal(audit.safeToMerge, true);
assert.equal(new Set(model.certificationQueries.map(row => row.county)).size, 28);

for (const query of ['Walmart Liberty', 'HEB Cleveland', 'H-E-B Cleveland', "Buc-ee's Baytown", 'HomeDepot Baytown', "McDonald's Liberty", 'Houston Hobby Airport', 'First Baptist Church Dayton']) {
  assert.equal(model.classifyIntent(query)?.type, 'business_place', `${query}: named-place intent`);
}
assert.equal(model.classifyIntent('274 County Road 677'), null, 'LP097 address intent remains outside LP099');

const business = { title: 'Walmart Supercenter', provider: 'nominatim', type: 'store', raw: { categories: ['retail', 'grocery'] } };
const road = { title: 'US 90', provider: 'nominatim', type: 'highway', raw: { categories: ['road'] } };
const governed = { ...business, raw: { ...business.raw, seedSource: 'lp097_governed_curated' } };
const saved = { ...business, provider: 'saved_place', raw: { savedPlace: true, categories: ['retail'] } };
assert.ok(model.evaluate('Walmart', saved).tier < model.evaluate('Walmart', governed).tier);
assert.ok(model.evaluate('Walmart', governed).tier < model.evaluate('Walmart', business).tier);
assert.ok(model.evaluate('Walmart', business).tier < model.evaluate('Walmart', road).tier);
assert.equal(model.category({ type: 'restaurant', raw: {} }), 'Restaurant');
assert.equal(model.category({ type: 'pharmacy', raw: {} }), 'Pharmacy');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
assert.match(app, /BUSINESS_PLACE: "business_place"/);
assert.match(app, /GRIDLY_LP099_BUSINESS_SEARCH\?\.evaluate/);
assert.ok(html.indexOf('lp099-business-search.js') < html.indexOf('js/app.js'));
console.log('LP099 business/place search passed: 112 queries across 28 counties.');
