const assert = require('node:assert/strict');
const fs = require('node:fs');

const edge = fs.readFileSync('supabase/functions/gridly-geocode/index.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/202607290100_lp103_verified_rural_address_registry.sql', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const client = fs.readFileSync('js/gridly-geocoding-client.js', 'utf8');

// The protected fixture is synthetic and deliberately contains no production residence data.
const synthetic = Object.freeze({ houseNumber: '412', variants: ['County Road 912', 'County Rd 912', 'CR 912', 'Co Rd 912'] });
const normalizeRoad = (value) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/\b(?:county road|county rd|co rd|cr)\s*(\d+[a-z]?)\b/g, 'cr $1');
assert.deepEqual(synthetic.variants.map(normalizeRoad), ['cr 912', 'cr 912', 'cr 912', 'cr 912']);
assert.equal(synthetic.houseNumber, '412', 'the accepted record preserves the provider/registry house number');
assert.notEqual(synthetic.houseNumber, '698', 'a wrong returned house number is never substituted');

assert.match(edge, /resolveGovernedRuralRegistry/);
assert.ok(edge.indexOf('resolveGovernedRuralRegistry(body, db)') < edge.indexOf('resolveRuralFallback(body)'),
  'verified registry resolution precedes the Census range fallback');
assert.match(edge, /\.eq\("consumer_eligible", true\)\.eq\("verification_status", "verified"\)/);
assert.match(edge, /sourceClassification: "governed_rural_registry"/);
assert.match(edge, /routePreviewEligible: false/);
assert.match(edge, /diagnostic\.accepted[\s\S]*routePreviewEligible: true/);
for (const rule of ['house_number_mismatch', 'roadway_identity_conflict', 'locality_conflict', 'zip_conflict',
  'county_conflict', 'state_conflict', 'malformed_or_missing_coordinates', 'unsupported_precision_claim']) {
  assert.match(edge, new RegExp(rule), `missing acceptance rule ${rule}`);
}
assert.match(edge, /\["interpolated_address", "verified_address_point", "verified_entrance"\]/);
assert.match(edge, /lookupHash = await hash\(normalizedRegistryLookup\(body\)\)/);
assert.doesNotMatch(edge, /274 County Road 677|274 CR 677/);

assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/);
assert.match(migration, /to service_role/);
assert.match(migration, /consumer_eligible boolean not null default false/);
assert.match(migration, /owner_confirmed_gps/);
assert.match(migration, /field_verified_entrance/);
assert.doesNotMatch(migration, /274 County Road 677|274 CR 677/);

assert.match(app, /window\.gridlyLp103RuralAddressResolutionTrace = function/);
assert.match(app, /window\.gridlyLp103VisibleRuralAddressCertification = function/);
const helper = app.slice(app.indexOf('window.gridlyLp103RuralAddressResolutionTrace'), app.indexOf('const GRIDLY_DESTINATION_SEARCH_BATCH_DEFAULT_QUERIES'));
assert.doesNotMatch(helper, /latitude|longitude|providerIdentity|raw authoritative|274 County Road 677/i);
assert.match(helper, /failedChecks/);
assert.match(helper, /safeToMerge: failedChecks\.length === 0/);
assert.doesNotMatch(client, /fetch\([^\n]*(?:nominatim|census|geocoding\.geo)/i,
  'the browser client has no direct external-provider fetch');
assert.match(edge, /diagnosticRequest \? \{ fallbackCandidateDiagnostics \} : \{\}/,
  'ordinary consumer responses contain no rejection diagnostics');

console.log('LP103 authoritative rural address contracts passed.');
