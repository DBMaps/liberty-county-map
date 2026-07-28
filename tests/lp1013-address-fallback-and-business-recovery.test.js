const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const qualitySource = fs.readFileSync('js/lp101-search-quality.js', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const client = fs.readFileSync('js/gridly-geocoding-client.js', 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(qualitySource, sandbox);
const quality = sandbox.window.GRIDLY_LP101_SEARCH_QUALITY;

const address = '274 County Road 677, Dayton, TX 77535';
const matchingRoad = { title: 'CR 677', type: 'road', raw: { address: { road: 'County Road 677', city: 'Dayton' }, categories: ['road'] } };
const unrelatedRoads = ['US 90', 'TX 321', 'FM 1960'].map((title) => ({ title, type: 'highway', raw: { address: { road: title, city: 'Dayton' }, categories: ['road'] } }));
assert.equal(quality.roadwayIdentity(address), 'cr 677');
assert.equal(quality.roadwayIdentity('CR 677'), 'cr 677');
assert.equal(quality.roadwayMatchesAddress(address, matchingRoad), true);
assert.ok(unrelatedRoads.every((result) => !quality.roadwayMatchesAddress(address, result)));

const mixed = quality.understand('Dayton Walmart');
assert.equal(mixed.geography, 'dayton');
assert.deepEqual([...mixed.destinationTerms], ['walmart']);
assert.equal(mixed.businessTerm, 'walmart');
assert.deepEqual([...quality.providerQueryVariants('Dayton Walmart')], ['walmart dayton Texas', 'walmart near dayton Texas', 'walmart Liberty County Texas']);
const walmart = { title: 'Walmart Supercenter', type: 'supermarket', raw: { display_name: 'Walmart Supercenter, Dayton, Liberty County, Texas', categories: ['retail'] } };
const road = { title: 'US 90', type: 'highway', raw: { display_name: 'US 90, Dayton, Liberty County, Texas', categories: ['road'] } };
assert.equal(quality.businessResultRelevant('Dayton Walmart', walmart), true);
assert.equal(quality.businessResultRelevant('Dayton Walmart', road), false);
assert.ok(quality.evaluate('Dayton Walmart', walmart).boost > quality.evaluate('Dayton Walmart', road).boost);

assert.match(app, /filterGridlyExplicitIntentRelevance\(dedupedResults/);
assert.match(app, /classification\.exactAddress \|\| classification\.roadAgreement/);
assert.match(app, /roadwayMatchesAddress/);
assert.match(app, /businessResultRelevant/);
assert.match(app, /providerQueryVariants/);
assert.match(app, /No matching destination found/);
assert.match(qualitySource, /caseName: "category"/);
assert.match(qualitySource, /caseName: "governed_destination"/);
assert.match(qualitySource, /routePreviewVerified/);
assert.match(qualitySource, /failedChecks\.length === 0/);
assert.match(client, /providerBoundary === "gridly"/);
assert.doesNotMatch(app, /nominatim\.openstreetmap\.org\/search/);
assert.doesNotMatch(client, /nominatim\.openstreetmap\.org\/search/);

console.log('LP101.3 address fallback and business query recovery contracts passed.');
