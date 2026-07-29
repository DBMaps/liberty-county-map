const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const edge = fs.readFileSync('supabase/functions/gridly-geocode/index.ts', 'utf8');
const client = fs.readFileSync('js/gridly-geocoding-client.js', 'utf8');
const auditSource = fs.readFileSync('js/lp104-regional-rural-address-audit.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert.match(edge, /GRIDLY_AUTHORITATIVE_RURAL_PROVIDER/);
assert.match(edge, /resolveTexasAddressIndex/);
assert.ok(edge.indexOf('resolveAuthoritativeRuralProvider(body)') < edge.indexOf('resolveGovernedRuralRegistry(body, db)'), 'regional provider precedes protected registry');
assert.ok(edge.indexOf('resolveGovernedRuralRegistry(body, db)') < edge.indexOf('resolveRuralFallback(body)'), 'registry precedes strict Census fallback');
assert.match(edge, /locationType === "ROOFTOP" \? "rooftop"/);
assert.match(edge, /house_number_mismatch/);
assert.match(edge, /roadway_identity_conflict/);
assert.match(edge, /unsupported_or_missing_county/);
assert.match(edge, /outside_supported_region/);
assert.match(edge, /gridly_lookup_texas_address/);
assert.match(edge, /authoritativeCandidateDiagnostics: authoritativeCandidateDiagnostics\.map/);
assert.doesNotMatch(client, /maps\.googleapis\.com|GRIDLY_AUTHORITATIVE_RURAL_API_KEY/);
assert.match(html, /lp104-regional-rural-address-audit\.js/);

const fakeResult = { providerResultId: 'opaque', latitude: 30.1, longitude: -95.1, precision: 'rooftop', routePreviewEligible: true,
  sourceClassification: 'authoritative_rural_geocoder', address: { houseNumber: '412', road: 'County Road 912', county: 'Liberty County', state: 'TX', postalCode: '77535' } };
const window = { gridlyGeocodingClient: { directProviderRequestCount: () => 0, search: async (request) => ({ ok: true, status: 'success',
  providerBoundary: 'gridly', results: [{ ...fakeResult, address: { ...fakeResult.address, county: request.query === 'b' ? 'Montgomery County' : 'Liberty County' } }], diagnostics: request.requestMode === 'lp104_certification' ? { authoritativeRuralOutcome: 'relevant_result' } : undefined }) } };
vm.runInNewContext(auditSource, { window, Object, Array, Set, String, Number, Boolean });
(async () => {
  const cases = [
    { caseId: 'synthetic-liberty', query: 'a', expected: { houseNumber: '412', road: 'CR 912', county: 'Liberty', postalCode: '77535' } },
    { caseId: 'synthetic-montgomery', query: 'b', expected: { houseNumber: '412', road: 'Co Rd 912', county: 'Montgomery', postalCode: '77535' } }
  ];
  const inventory = require('../data/lp104/texas-counties.json'); const coverageReport = { counties: inventory.counties.map(c => ({...c, sourceAvailable: true, productionEligible: true, certificationStatus: 'certified'})) };
  const certified = await window.gridlyLp104VisibleRegionalRuralAddressCertification({ cases, coverageReport, googleProviderEnabled: false });
  for (const field of ['texasCountyInventoryPass', 'texasCountyCount', 'statewideArchitecturePass', 'statewideManifestAvailable', 'statewideSourceCoverageCount', 'statewideProductionEligibleCountyCount', 'initial28CoveragePass', 'initial28CertificationPass', 'addressPointPrecisionPass', 'houseNumberSafetyPass', 'roadIdentityPass', 'countyContainmentPass', 'providerBoundaryPreserved', 'googleProviderDisabled', 'censusMismatchRejected', 'routePreviewAgreement', 'privateDiagnosticsRedacted', 'ordinaryConsumerSearchPass', 'failedChecks', 'safeToMerge']) assert.notEqual(certified[field], undefined);
  assert.equal(certified.safeToMerge, true);
  assert.deepEqual([...certified.failedChecks], []);
  const incomplete = await window.gridlyLp104VisibleRegionalRuralAddressCertification();
  assert.equal(incomplete.safeToMerge, false, 'no live cases must fail closed');
  assert.ok(incomplete.failedChecks.includes('ordinaryConsumerSearchPass'));
  const serialized = JSON.stringify(await window.gridlyLp104RegionalRuralAddressAudit({ cases, coverageReport, googleProviderEnabled: false }));
  assert.doesNotMatch(serialized, /\"query\"|77535|-95\.1|30\.1/, 'audit output is address and coordinate redacted');
  console.log('LP104 regional rural address resolution contracts passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
