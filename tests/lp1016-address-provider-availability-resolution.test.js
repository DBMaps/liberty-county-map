const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const client = fs.readFileSync('js/gridly-geocoding-client.js', 'utf8');
const quality = fs.readFileSync('js/lp101-search-quality.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/gridly-geocode/index.ts', 'utf8');
const aggregateSource = app.slice(
  app.indexOf('function aggregateGridlyAddressVariantOutcomes'),
  app.indexOf('\nfunction finalizeGridlyDestinationProviderDiagnostics')
);
const context = { Object, Array };
vm.runInNewContext(`${aggregateSource};this.aggregate = aggregateGridlyAddressVariantOutcomes;`, context);
const aggregate = (variants) => JSON.parse(JSON.stringify(context.aggregate(variants)));
const noResult = { requestAttempted: true, canonicalSuccess: true, canonicalResultCount: 0, finalDisposition: 'canonical_no_result', failureCode: 'none' };
const unavailable = { requestAttempted: true, canonicalFailure: true, finalDisposition: 'temporary_failure', failureCode: 'provider_unavailable' };

assert.equal(aggregate([noResult]).finalConsumerClassification, 'confirmed_no_result', 'HTTP 200 canonical empty is a successful no-result');
assert.equal(aggregate([noResult, unavailable]).finalConsumerClassification, 'confirmed_no_result', 'temporary failure cannot override a canonical no-result');
assert.equal(aggregate([unavailable, unavailable]).finalConsumerClassification, 'temporarily_unavailable');
assert.equal(aggregate([{ ...unavailable, finalDisposition: 'provider_cooldown', providerCooldownObserved: true, failureCode: 'rate_limited' }]).finalConsumerClassification, 'temporarily_paused');
assert.equal(aggregate([{ ...unavailable, failureCode: 'provider_timeout', timeoutObserved: true }]).finalConsumerClassification, 'temporarily_unavailable');
assert.equal(aggregate([{ ...unavailable, failureCode: 'malformed_response', malformedResponseObserved: true }]).finalConsumerClassification, 'temporarily_unavailable');
assert.equal(aggregate([{ ...unavailable, finalDisposition: 'provider_reservation_denied', providerReservationDenied: true }]).finalConsumerClassification, 'temporarily_unavailable');
assert.equal(aggregate([noResult, { requestAttempted: true, canonicalSuccess: true, canonicalResultCount: 1, finalDisposition: 'relevant_results' }]).finalConsumerClassification, 'relevant_result');

assert.match(app, /response\.status === "no_results"[\s\S]+finalDisposition: "canonical_no_result"/);
assert.match(app, /diagnostics\.aggregate = aggregateGridlyAddressVariantOutcomes/);
assert.match(app, /"Search is temporarily paused\. Please try again shortly\."/);
assert.match(app, /"Address search is temporarily unavailable\. Try again in a moment\."/);
assert.match(app, /"We couldn’t confirm that exact address\. Try adding the city or ZIP code\."/);
assert.match(app, /window\.gridlyLp101AddressProviderRca/);
assert.match(quality, /milestone: "LP101\.6"/);
assert.match(quality, /businessResultRelevant/);
assert.match(quality, /governedDestinationPreserved/);
assert.match(quality, /routePreviewVerified/);
assert.match(edge, /gridly_reserve_geocode_provider_slot/);
assert.match(edge, /gridly_cooldown_geocode_provider/);
assert.match(edge, /upstream\.status === 429/);
assert.match(edge, /Retry-After/);
assert.match(edge, /provider_timeout/);
assert.match(edge, /status: 200, headers: cors\(origin\)/);
assert.doesNotMatch(app, /fetch\(`https:\/\/nominatim\.openstreetmap\.org\/search/);
assert.doesNotMatch(client, /fetch\([^)]*nominatim\.openstreetmap\.org/);

const helper = app.slice(app.indexOf('window.gridlyLp101AddressProviderRca'), app.indexOf('\nwindow.gridlyLp101CandidatePipelineDebug'));
assert.doesNotMatch(helper, /originalQuery|rawQuery|coordinates|providerPayload|authorization|apikey/i, 'RCA output stays privacy-safe');
assert.match(helper, /classificationAgreement/);
assert.match(quality, /failedChecks\.length === 0[\s\S]+cases\.every\(\(entry\) => entry\.passed\)[\s\S]+routePreviewVerified/);

console.log('LP101.6 address provider availability resolution contracts passed.');
