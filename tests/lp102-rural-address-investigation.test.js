const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const casesSource = fs.readFileSync('js/lp102-rural-address-cases.js', 'utf8');
const client = fs.readFileSync('js/gridly-geocoding-client.js', 'utf8');
const quality = fs.readFileSync('js/lp101-search-quality.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/gridly-geocode/index.ts', 'utf8');

const qualityContext = { window: {}, Object, Array, Set };
vm.runInNewContext(quality, qualityContext);
const normalize = qualityContext.window.GRIDLY_LP101_SEARCH_QUALITY.normalize;
assert.equal(normalize('274 County Rd 677, Dayton, TX 77535'), '274 county road 677 dayton tx 77535');
assert.equal(normalize('274 CR 677, Dayton, TX 77535'), '274 county road 677 dayton tx 77535');
assert.equal(normalize('274 Co Rd 677, Dayton, TX 77535'), '274 county road 677 dayton tx 77535');
assert.equal(normalize('274 Webb Road, Dayton, TX 77535'), '274 webb road dayton tx 77535');

const requiredQueries = [
  '274 County Road 677, Dayton, TX 77535', '274 County Rd 677, Dayton, TX 77535',
  '274 CR 677, Dayton, TX 77535', '274 Co Rd 677, Dayton, TX 77535',
  '274 Web Road, Dayton, TX 77535', '274 Webb Road, Dayton, TX 77535',
  'County Road 677, Dayton, TX 77535', 'CR 677, Dayton, TX 77535',
  'Web Road, Dayton, TX 77535', 'Webb Road, Dayton, TX 77535'
];
requiredQueries.forEach((query) => assert.ok(casesSource.includes(query), `missing LP102 case: ${query}`));
['urban_control', 'business_control', 'numbered_road_control', 'invalid_rural_control', 'out_of_area_control', 'governed_control']
  .forEach((name) => assert.ok(casesSource.includes(`["${name}"`), `missing control: ${name}`));

assert.match(app, /window\.gridlyLp102RuralAddressInvestigation = async function/);
assert.match(app, /normalizationTraceAvailable: true/);
assert.match(app, /exactnessReviewAvailable: true/);
assert.match(app, /aliasInventoryAvailable: true/);
assert.match(app, /pipelineDomAgreement/);
assert.match(app, /routePreviewPreserved/);
assert.match(app, /aggregateGridlyAddressVariantOutcomes\(diagnostics\.variants/);
assert.doesNotMatch(app.slice(app.indexOf('// LP102'), app.indexOf('const GRIDLY_DESTINATION_SEARCH_BATCH_DEFAULT_QUERIES')), /nominatim\.openstreetmap\.org|fetch\s*\(/);
assert.doesNotMatch(client, /fetch\([^)]*nominatim\.openstreetmap\.org/);
assert.match(edge, /status: "no_results"/);
assert.match(edge, /status: 200, headers: cors\(origin\)/);
assert.match(edge, /params\.set\("q", body\.query\)/);

console.log('LP102 rural address investigation contracts passed.');
