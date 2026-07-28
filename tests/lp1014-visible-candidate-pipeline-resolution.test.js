const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const qualitySource = fs.readFileSync('js/lp101-search-quality.js', 'utf8');
const client = fs.readFileSync('js/gridly-geocoding-client.js', 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(qualitySource, sandbox);
const quality = sandbox.window.GRIDLY_LP101_SEARCH_QUALITY;

// Concrete canonicalToLegacy / production normalization shape.
const walmart = { provider: 'gridly_geocode', title: 'Walmart Supercenter', type: 'supermarket', raw: {
  display_name: 'Walmart Supercenter, Dayton, Liberty County, Texas',
  address: { road: 'US 90', city: 'Dayton', county: 'Liberty County' }, categories: ['retail', 'grocery']
} };
const roads = ['US 90', 'TX 321', 'FM 1960'].map((title) => ({ provider: 'local_poi_seed', title, type: 'highway',
  localPoiSeed: true, raw: { address: { road: title, city: 'Dayton' }, categories: ['road'] } }));
assert.equal(quality.businessResultRelevant('Dayton Walmart', walmart), true, 'canonical Walmart result survives the target gate');
assert.ok(roads.every((road) => !quality.businessResultRelevant('Dayton Walmart', road)), 'local road seeds fail business relevance');
assert.ok(roads.every((road) => !quality.roadwayMatchesAddress('274 County Road 677, Dayton, TX 77535', road)), 'unrelated roads fail address relevance');

const searchStart = app.indexOf('async function gridlySearchAddress');
const renderStart = app.indexOf('function renderGridlySearchResults');
assert.ok(searchStart > 0 && renderStart > 0);
assert.ok(app.indexOf('setGridlyLp101PipelineStage(lp101CaseName, "relevanceGateOutput"', searchStart)
  < app.indexOf('setGridlyLp101PipelineStage(lp101CaseName, "finalRenderInput"', searchStart), 'final-stage gate precedes render input');
assert.match(app.slice(renderStart, searchStart), /filterGridlyExplicitIntentRelevance\([\s\S]*mergeGridlySavedPlaceDestinationResults/, 'renderer gates after its saved-place merge');
assert.match(app, /renderPhase: "immediate_seed"/, 'local seed injection is identified');
assert.match(app, /renderPhase: "final"/, 'final remote render is distinguishable');
assert.match(app, /canonical_provider_recall_no_business_target/, 'provider no-result is reported truthfully');
assert.match(app, /providerRecallFailure: !targetReturned/, 'no business candidate is fabricated');

assert.match(app, /window\.gridlyLp101CandidatePipelineDebug = async/);
assert.match(app, /case_identifier_not_allowed/);
assert.match(app, /normalizedRoadwayIdentity/);
assert.match(app, /normalizedBusinessTarget/);
assert.doesNotMatch(app.slice(app.indexOf('window.gridlyLp101CandidatePipelineDebug'), app.indexOf('const GRIDLY_DESTINATION_SEARCH_BATCH_DEFAULT_QUERIES')), /lat:|lng:|provider payload|credentials/i);

assert.match(qualitySource, /activeVisibleNodeCount/);
assert.match(qualitySource, /currentCaseIdentityAgreement/);
assert.match(qualitySource, /candidatePipelineAgreement/);
assert.match(qualitySource, /renderDomAgreement/);
assert.match(qualitySource, /card\.closest\?\.\("#gridlySearchResults"\) !== results/, 'nodes outside the active container are excluded');
assert.match(qualitySource, /card\.hidden/, 'hidden nodes are excluded');
assert.match(qualitySource, /card\.dataset\?\.lp101Case !== caseName/, 'prior-case and stale nodes are excluded');
assert.match(qualitySource, /caseName: "category"/);
assert.match(qualitySource, /caseName: "governed_destination"/);
assert.match(qualitySource, /routePreviewVerified/);
assert.match(qualitySource, /failedChecks\.length === 0/);
assert.match(client, /providerBoundary === "gridly"/);
assert.doesNotMatch(app, /nominatim\.openstreetmap\.org\/search/);
assert.doesNotMatch(client, /nominatim\.openstreetmap\.org\/search/);

console.log('LP101.4 visible candidate pipeline resolution contracts passed.');
