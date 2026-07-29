const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const casesSource = fs.readFileSync('js/lp102-rural-address-cases.js', 'utf8');
const client = fs.readFileSync('js/gridly-geocoding-client.js', 'utf8');
const quality = fs.readFileSync('js/lp101-search-quality.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/gridly-geocode/index.ts', 'utf8');
const governanceSource = fs.readFileSync('js/lp097-search-governance.js', 'utf8');

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
['urban_control', 'business_control', 'numbered_road_control', 'invalid_rural_control', 'invalid_named_road_control', 'out_of_area_control', 'out_of_area_highway_control', 'governed_control']
  .forEach((name) => assert.ok(casesSource.includes(`["${name}"`), `missing control: ${name}`));

assert.match(app, /window\.gridlyLp102RuralAddressInvestigation = async function/);
assert.match(app, /window\.gridlyLp102VisibleRuralAddressCertification = async function/);
assert.match(app, /unknownCaseNames/);
assert.match(app, /executedCaseNames/);
assert.match(app, /rejectionTrace/);
assert.match(app, /primaryProviderOutcome/);
assert.match(app, /fallbackInvokedOnlyWhenEligible/);
assert.match(app, /diagnostics\.variants\.at\(-1\)\?\.fallbackInvoked/);
assert.match(app, /manualCases/);
assert.match(app, /delayMs/);
assert.match(app, /normalizationTraceAvailable: true/);
assert.match(app, /exactnessReviewAvailable: true/);
assert.match(app, /aliasInventoryAvailable: true/);
assert.match(app, /pipelineDomAgreement/);
assert.match(app, /routePreviewPreserved/);
for (const field of ['candidateDisposition', 'requestedHouseNumber', 'returnedHouseNumber', 'normalizedRequestedHouseNumber', 'normalizedReturnedHouseNumber',
  'houseNumberAgreement', 'requestedRoadIdentity', 'returnedRoadIdentity', 'roadIdentityAgreement', 'hardBlockingConflicts',
  'requestedState', 'returnedState', 'stateAgreement', 'requestedPostalCode', 'returnedPostalCode', 'postalCodeAgreement',
  'requestedCounty', 'returnedCounty', 'countyAgreement', 'resultType', 'precision', 'routePreviewEligible']) assert.match(edge, new RegExp(field));
for (const field of ['houseNumberSafetyPass', 'roadwayNormalizationPass', 'mismatchedCandidateRejected', 'truthfulNoResultObserved']) {
  assert.match(app, new RegExp(field));
}

const certificationStart = app.indexOf('window.gridlyLp102VisibleRuralAddressCertification = async function');
const certificationEnd = app.indexOf('\n\nconst GRIDLY_DESTINATION_SEARCH_BATCH_DEFAULT_QUERIES', certificationStart);
const certificationSource = app.slice(certificationStart, certificationEnd);
const requiredCertificationFields = [
  'available', 'milestone', 'productionBehaviorObserved', 'houseNumberSafetyPass', 'mismatchedCandidateRejected',
  'truthfulNoResultObserved', 'misleadingFallbackAbsent', 'roadwayNormalizationPass', 'candidatePipelineAgreement',
  'renderDomAgreement', 'canonicalNoResultHandlingPass', 'businessControlPass', 'governedControlPass',
  'routePreviewVerified', 'providerBoundaryPreserved', 'browserDirectProviderAccessAbsent',
  'protectedSystemsUnchanged', 'rateLimitBehaviorPass', 'internalCertificationError',
  'internalCertificationErrorMessage', 'failedChecks', 'safeToMerge'
];
for (const field of requiredCertificationFields.filter((field) => !['available', 'milestone', 'failedChecks', 'safeToMerge'].includes(field))) {
  assert.match(certificationSource, new RegExp(`let ${field} = `), `${field} must have a deterministic declaration`);
}
assert.ok(certificationSource.indexOf('let houseNumberSafetyPass = false') < certificationSource.indexOf('const checks ='),
  'houseNumberSafetyPass must be declared before failedChecks and safeToMerge assembly');

async function runCertification(investigation) {
  const context = { window: { gridlyLp102RuralAddressInvestigation: investigation,
    GRIDLY_LP101_SEARCH_QUALITY: { roadwayIdentity: qualityContext.window.GRIDLY_LP101_SEARCH_QUALITY.roadwayIdentity } }, console: { error() {} }, Object, Array, Number };
  vm.runInNewContext(certificationSource, context);
  return context.window.gridlyLp102VisibleRuralAddressCertification();
}

(async () => {
  const incomplete = await runCertification(async () => ({ available: false }));
  requiredCertificationFields.forEach((field) => assert.notEqual(incomplete[field], undefined, `${field} must be defined for an incomplete run`));
  assert.equal(incomplete.houseNumberSafetyPass, false);
  assert.equal(incomplete.safeToMerge, false);
  assert.ok(incomplete.failedChecks.includes('houseNumberSafetyPass'));

  const rateLimitedCase = { caseName: 'county_road_full', transport: [{ httpStatus: 429, failureCode: 'rate_limited' }],
    resolutionEvents: [], pipelineDomAgreement: false, misleadingFallbackDetected: false };
  let call = 0;
  const rateLimited = await runCertification(async () => (++call === 1
    ? { available: true, cases: [rateLimitedCase], unknownCaseNames: [], executedCaseNames: [] }
    : { available: true, productionBehaviorObserved: true, cases: [rateLimitedCase] }));
  requiredCertificationFields.forEach((field) => assert.notEqual(rateLimited[field], undefined, `${field} must be defined after a 429`));
  assert.equal(rateLimited.internalCertificationError, false);
  assert.equal(rateLimited.rateLimitBehaviorPass, false);
  assert.ok(rateLimited.failedChecks.includes('rateLimitBehaviorPass'));
  assert.equal(rateLimited.safeToMerge, false);

  const rejectionDiagnostic = { candidateDisposition: 'rejected_house_number_mismatch', rejectionRule: 'house_number_mismatch',
    rejectionStage: 'fallback_acceptance_gate', rejectionPhase: 'pre_relevance', hardBlockingConflicts: ['house_number_mismatch'],
    requestedHouseNumber: '274', returnedHouseNumber: '698', normalizedRequestedHouseNumber: '274',
    normalizedReturnedHouseNumber: '698', houseNumberAgreement: false, requestedRoadIdentity: 'cr 677',
    returnedRoadIdentity: 'cr 677', roadIdentityAgreement: true, routePreviewEligible: false };
  const emptyPipeline = { providerCandidates: [], relevanceGateOutput: [], finalRenderInput: [] };
  const goodCases = [
    { caseName: 'county_road_full', canonicalResultCount: 0, visibleResultCount: 0, routePreviewAvailable: false,
      providerOutcomeClassification: 'confirmed_no_result', pipelineDomAgreement: true, misleadingFallbackDetected: false,
      candidatePipeline: emptyPipeline, resolutionEvents: [{ primaryProviderOutcome: 'confirmed_no_result', fallbackEligible: true,
        fallbackInvoked: true, fallbackOutcome: 'confirmed_no_result', fallbackCandidateDiagnostics: [rejectionDiagnostic] }], transport: [{ httpStatus: 200 }] },
    ...['county_rd', 'cr', 'co_rd'].map((caseName) => ({ caseName, canonicalResultCount: 0, visibleResultCount: 0,
      providerOutcomeClassification: 'confirmed_no_result', pipelineDomAgreement: true, misleadingFallbackDetected: false,
      candidatePipeline: emptyPipeline, resolutionEvents: [], transport: [{ httpStatus: 200 }] })),
    { caseName: 'invalid_rural_control', providerOutcomeClassification: 'confirmed_no_result', visibleResultCount: 0,
      pipelineDomAgreement: true, misleadingFallbackDetected: false, resolutionEvents: [], transport: [{ httpStatus: 200 }] },
    { caseName: 'business_control', visibleResultCount: 1, pipelineDomAgreement: true, misleadingFallbackDetected: false,
      resolutionEvents: [], transport: [{ httpStatus: 200 }] },
    { caseName: 'governed_control', visibleResultCount: 1, pipelineDomAgreement: true, misleadingFallbackDetected: false,
      resolutionEvents: [], transport: [{ httpStatus: 200 }] }
  ];
  const successfulInvestigation = async (options = {}) => ({ available: true, productionBehaviorObserved: true,
    providerBoundaryPreserved: true, browserDirectProviderAccessAbsent: true, protectedSystemsUnchanged: true,
    routePreviewPreserved: true, unknownCaseNames: [], executedCaseNames: options.caseNames || goodCases.map((entry) => entry.caseName), cases: goodCases });
  const certified = await runCertification(successfulInvestigation);
  assert.equal(certified.houseNumberSafetyPass, true);
  assert.equal(certified.mismatchedCandidateRejected, true);
  assert.equal(certified.ruralPrecisionTruthful, true, 'truthful no-result after unsafe interpolation rejection is precision-truthful');
  assert.equal(certified.safeToMerge, true, `unexpected failures: ${[...certified.failedChecks].join(', ')}`);
  assert.deepEqual([...certified.failedChecks], []);

  const contradictory = await runCertification(async (options = {}) => ({ ...(await successfulInvestigation(options)),
    cases: goodCases.map((entry) => entry.caseName === 'county_road_full' ? { ...entry,
      resolutionEvents: [{ ...entry.resolutionEvents[0], fallbackCandidateDiagnostics: [{ ...rejectionDiagnostic, houseNumberAgreement: true }] }] } : entry) }));
  assert.equal(contradictory.houseNumberSafetyPass, false);
  assert.equal(contradictory.mismatchedCandidateRejected, false);
  assert.equal(contradictory.safeToMerge, false, 'contradictory rejection evidence must fail closed');

  const internalFailure = await runCertification(async () => { throw new Error('secret upstream token detail'); });
  requiredCertificationFields.forEach((field) => assert.notEqual(internalFailure[field], undefined, `${field} must be defined after an internal error`));
  assert.equal(internalFailure.internalCertificationError, true);
  assert.equal(internalFailure.internalCertificationErrorMessage, 'Unexpected LP102 certification error.');
  assert.doesNotMatch(internalFailure.internalCertificationErrorMessage, /secret|token/i);
  assert.ok(internalFailure.failedChecks.includes('internalCertificationError'));
  assert.equal(internalFailure.safeToMerge, false);

  console.log('LP102 certification runtime failure contracts passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
assert.match(app, /aggregateGridlyAddressVariantOutcomes\(diagnostics\.variants/);
assert.doesNotMatch(app.slice(app.indexOf('// LP102'), app.indexOf('const GRIDLY_DESTINATION_SEARCH_BATCH_DEFAULT_QUERIES')), /nominatim\.openstreetmap\.org|fetch\s*\(/);
assert.doesNotMatch(client, /fetch\([^)]*nominatim\.openstreetmap\.org/);
assert.match(edge, /status: "no_results"/);
assert.match(edge, /status: 200, headers: cors\(origin\)/);
assert.match(edge, /params\.set\("q", body\.query\)/);

const governanceContext = { window: {} };
vm.runInNewContext(governanceSource, governanceContext);
const evaluate = governanceContext.window.GRIDLY_LP097_SEARCH_GOVERNANCE.evaluateAddressExactness;
const model = { houseNumber: '274', street: '274 County Road 677', countyRoad: true, highwayAddress: false,
  expectedGeography: { city: 'Dayton', county: 'Liberty County', state: 'Texas', postalCode: '77535' }, explicitGeography: { city: 'Dayton' } };
const candidate = (overrides = {}) => ({ raw: { address: { house_number: '274', road: 'County Road 677', city: 'Kenefick', county: 'Liberty County', state: 'TX', postcode: '77535', ...overrides } } });
assert.ok(evaluate(model, candidate()).reasons.includes('city_conflict'), 'LP097 city-conflict exactness remains strict');
assert.doesNotMatch(governanceSource, /mailing_city_difference/, 'unsupported mailing-city exception was removed');
assert.doesNotMatch(app, /supportedRuralAddress/, 'unsupported rural retention behavior was removed');
assert.ok(evaluate(model, candidate({ house_number: '275' })).reasons.includes('house_number_mismatch'));
assert.ok(evaluate(model, candidate({ postcode: '77575' })).reasons.includes('postal_code_conflict'));
assert.ok(evaluate(model, candidate({ county: 'Harris County' })).reasons.includes('enriched_locality_conflict'));

assert.match(edge, /GRIDLY_RURAL_FALLBACK_ENABLED/);
assert.match(edge, /geocoding\.geo\.census\.gov/);
assert.match(edge, /\["explicit_search", "lp102_certification"\]\.includes\(body\.requestMode\)/);
assert.match(edge, /diagnosticRequest \? \{ fallbackCandidateDiagnostics \} : \{\}/,
  'ordinary consumer responses must not expose rejection diagnostics');
assert.match(edge, /requestMode: body\.requestMode \|\| ""/,
  'diagnostic mode must be isolated in the cache key so stale consumer no-results cannot erase evidence');
assert.match(app, /gridlyLp102DiagnosticRequestActive === true \? "lp102_certification" : "explicit_search"/);
assert.match(edge, /body\.intent !== "address"/);
assert.match(edge, /hasHouse && hasRoad && hasGeography/);
assert.match(edge, /primaryOutcome = results\.length/);
assert.match(edge, /fallbackEligible = !results\.length/);
assert.match(edge, /precision: "interpolated_address"/);
assert.match(edge, /confidenceBasis: "authoritative_address_range_match"/);
assert.match(edge, /sourceClassification: "government_address_range"/);
assert.match(edge, /fallbackOutcome = fallback\.outcome/);
assert.match(edge, /status === 429/);
assert.match(edge, /ruralFallbackTimeoutMs/);
assert.match(edge, /origins\.has\(origin\)/);
assert.doesNotMatch(client, /geocoding\.geo\.census\.gov/);
assert.match(app, /canonicalPrecision !== "interpolated_address"/);
assert.match(edge, /house_number_mismatch/);
assert.match(edge, /missing_house_number_for_numbered_address/);
assert.match(edge, /roadway_identity_conflict/);
assert.match(edge, /zip_conflict/);
assert.match(edge, /county_conflict/);
assert.match(edge, /state_conflict/);
assert.match(edge, /malformed_or_missing_coordinates/);
assert.match(edge, /road_only_result_promoted_as_house/);
assert.match(edge, /unsupported_precision_claim/);
assert.match(edge, /rejectionStage: accepted \? "none" : "fallback_acceptance_gate"/);
assert.match(edge, /rejectionPhase: accepted \? "none" : "pre_relevance"/);
assert.match(edge, /finalRenderInput: accepted/);
assert.match(edge, /accepted\.length \? "relevant_result" : "confirmed_no_result"/);
assert.match(edge, /routePreviewEligible: true/);
assert.match(edge, /routePreviewEligible: false/);
assert.doesNotMatch(edge.slice(edge.indexOf('function privacySafeRejectionDiagnostic'), edge.indexOf('function canonicalizeRuralMatch')), /providerIdentity|matchedAddress|tigerLine|coordinates|baseUrl|headers/,
  'privacy-safe diagnostics must not contain raw provider identity, payload, URL, or transport data');
assert.doesNotMatch(edge, /houseNumber\s*[:=][^\n]*(?:body\.query|requested\.houseNumber)/, 'provider house number must not be copied from the request');

const identities = ['County Road 677', 'County Rd 677', 'CR 677', 'Co Rd 677', 'CO RD 677'].map((value) => qualityContext.window.GRIDLY_LP101_SEARCH_QUALITY.roadwayIdentity(value));
assert.deepEqual(identities, ['cr 677', 'cr 677', 'cr 677', 'cr 677', 'cr 677']);
assert.equal(qualityContext.window.GRIDLY_LP101_SEARCH_QUALITY.roadwayIdentity('County Road 676'), 'cr 676');
assert.notEqual(qualityContext.window.GRIDLY_LP101_SEARCH_QUALITY.roadwayIdentity('County Road 676'), identities[0], 'genuine roads remain distinct');
assert.doesNotMatch(quality, /webb?/i, 'LP102 must not create a Web/Webb alias in search normalization');
console.log('LP102 rural address investigation contracts passed.');
