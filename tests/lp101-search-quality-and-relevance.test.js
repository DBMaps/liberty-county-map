const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('js/lp101-search-quality.js', 'utf8'), sandbox);
const quality = sandbox.window.GRIDLY_LP101_SEARCH_QUALITY;

for (const [query, expected] of [['HEB', 'heb'], ['H-E-B', 'heb'], ['H E B', 'heb'], ['Wal Mart', 'walmart'], ["McDonald's", 'mcdonalds'], ['274 CR 677', '274 county road 677'], ['1200 FM 1960', '1200 farm to market road 1960'], ['U.S. 90', 'us 90']]) assert.equal(quality.normalize(query), expected, query);
for (const [typo, corrected] of [['mcdonlds', 'mcdonalds'], ['walmartt', 'walmart'], ['hopsital', 'hospital'], ['libary', 'library']]) assert.equal(quality.normalize(typo), corrected);
for (const query of ['hospital', 'Nearest Hospital', 'school', 'airport', 'gas station', 'government', 'courthouse', 'city hall', 'fire dept', 'police', 'church', 'park', 'library', 'DMV', 'tax office', 'post office']) assert.ok(quality.understand(query).category, query);
assert.deepEqual({ geography: quality.understand('Dayton Walmart').geography, terms: [...quality.understand('Dayton Walmart').destinationTerms] }, { geography: 'dayton', terms: ['walmart'] });

const local = { title: 'Walmart Supercenter', confidence: 0.8, type: 'store', raw: { categories: ['retail'], address: { city: 'Dayton', county: 'Liberty County' } } };
const distant = { ...local, raw: { categories: ['retail'], address: { city: 'Dallas', county: 'Dallas County' } } };
assert.ok(quality.evaluate('Dayton Walmart', local).boost > quality.evaluate('Dayton Walmart', distant).boost);
const governed = { ...local, raw: { ...local.raw, seedSource: 'lp097_governed_curated' } };
assert.ok(quality.evaluate('Walmart', governed).boost > quality.evaluate('Walmart', local).boost);
assert.ok(quality.evaluate('Nearest Hospital', { title: 'Liberty Hospital', type: 'hospital', raw: { categories: ['hospital'] } }, { distanceMiles: 2 }).boost > quality.evaluate('Nearest Hospital', { title: 'Regional Hospital', type: 'hospital', raw: { categories: ['hospital'] } }, { distanceMiles: 60 }).boost);

const certification = sandbox.window.gridlyLp101BrowserCertification();
assert.equal(certification.safeToMerge, true);
assert.equal(certification.providerIndependent, true);
assert.equal(certification.additionalNetworkRequests, 0);

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const client = fs.readFileSync('js/gridly-geocoding-client.js', 'utf8');
assert.ok(html.indexOf('lp101-search-quality.js') < html.indexOf('js/app.js'));
assert.match(app, /GRIDLY_LP101_SEARCH_QUALITY\?\.evaluate/);
assert.match(client, /payload\.providerBoundary === "gridly"/);
assert.doesNotMatch(app, /nominatim\.openstreetmap\.org\/search/);
console.log('LP101 search quality and relevance certification passed.');
