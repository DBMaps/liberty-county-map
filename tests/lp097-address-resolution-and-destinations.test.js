const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const dataSource = fs.readFileSync('js/lp097-curated-destinations.js', 'utf8');
const fixtures = JSON.parse(fs.readFileSync('tests/fixtures/lp097-destination-certification.json', 'utf8')).fixtures;
const sandbox = { window: {} };
vm.runInNewContext(dataSource, sandbox);
const destinations = sandbox.window.GRIDLY_LP097_CURATED_DESTINATIONS;

assert.equal(fixtures.length, 60);
assert.ok(fixtures.filter((x) => x.kind === 'complete_address').length >= 15);
assert.ok(fixtures.filter((x) => ['rural_address', 'cr_abbreviation'].includes(x.kind)).length >= 10);
assert.ok(fixtures.filter((x) => x.kind === 'cr_abbreviation').length >= 5);
assert.ok(fixtures.filter((x) => x.kind === 'highway').length >= 5);
assert.ok(fixtures.filter((x) => x.kind === 'public_place').length >= 15);
assert.ok(fixtures.filter((x) => x.kind === 'no_match').length >= 5);

assert.ok(destinations.length >= 15);
assert.equal(new Set(destinations.map((x) => x.id)).size, destinations.length);
for (const place of destinations) {
  for (const field of ['id','name','category','subcategory','communityId','countyId','state','sourceAuthority','coordinateVerification','verifiedAt']) assert.ok(place[field], `${place.id}: ${field}`);
  assert.equal(place.active, true);
  assert.ok(Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90);
  assert.ok(Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180);
}
for (const category of ['medical','government','public_service','education','community_destination']) assert.ok(destinations.some((x) => x.category === category), category);

assert.match(app, /GRIDLY_LP097_MAX_PROVIDER_ATTEMPTS = 3/);
assert.match(app, /GRIDLY_LP097_EVALUATED_CANDIDATE_LIMIT = 15/);
assert.match(app, /buildGridlyLp097AddressModel/);
assert.match(app, /County Road \$1/);
assert.match(app, /structured: intent\.type === GRIDLY_DESTINATION_INTENTS\.ADDRESS/);
assert.match(app, /if \(exactInAttempt\) break/);
assert.match(app, /score \+= 2000/);
assert.match(app, /consumerType = "Exact address"/);
assert.match(app, /consumerType = "Approximate location"/);
assert.match(app, /Address search is temporarily unavailable\. Try again in a moment\./);
assert.match(app, /Search is temporarily paused\. Please try again shortly\./);
assert.match(app, /We couldn’t confirm that exact address/);
assert.match(app, /window\.gridlyLp097AddressResolutionAudit/);
assert.doesNotMatch(app + dataSource + JSON.stringify(fixtures), /274\s+County\s+Road\s+677/i);
console.log('LP097 address resolution and governed destination contracts passed.');
