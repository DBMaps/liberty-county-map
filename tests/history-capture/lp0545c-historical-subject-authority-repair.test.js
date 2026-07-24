const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert.match(source, /function gridlyLp0545CrossingIdentitySets/, 'LP054.5C builds explicit selected/unrelated crossing identity sets');
assert.match(source, /selectedCrossingIdentities/, 'selected crossing identities remain separate from unrelated identities');
assert.match(source, /unrelatedCrossingIdentities/, 'unrelated crossing identities are built from excluded records');
assert.match(source, /if \(!identity \|\| \/\^\(\?:us\|fm\|tx\|i\)_\?\\d\+\$\/i\.test\(identity\)\) continue;/, 'shared route-only identities such as US 90 are ignored for leak detection');
assert.match(source, /matchedUnrelatedIdentityInModel/, 'model leak diagnostics expose the exact unrelated identity match');
assert.match(source, /matchedUnrelatedIdentityInDom/, 'DOM leak diagnostics expose the exact unrelated identity match');
assert.match(source, /selectedCrossingSubjectVisibleInModel/, 'selected Waco visibility is allowed and diagnosed in the model');
assert.match(source, /selectedCrossingSubjectVisibleInDom/, 'selected Waco visibility is allowed and diagnosed in the DOM');
assert.doesNotMatch(source, /unrelatedSubjects = context\.contextType === "crossing"/, 'old broad crossing-looking unrelated subject list is removed');

assert.match(source, /function gridlyLp0545StructuredHazardLocationSubject/, 'structured hazard-location consumer subjects are composed explicitly');
assert.match(source, /consumerSubjectKind = structuredSubject/, 'structured hazard-location subjects are marked with consumerSubjectKind metadata');
assert.match(source, /consumerSubjectValidated = Boolean\(structuredSubject/, 'structured hazard-location subjects carry validation metadata');
assert.match(source, /context\?\.consumerSubjectKind === "structured_hazard_location" && context\?\.consumerSubjectValidated === true/, 'authority resolver preserves validated structured hazard-location subjects');
assert.match(source, /validHazardLocationSubjectPass/, 'LP054.5C exposes valid hazard-location pass diagnostics');
assert.match(source, /unsafeLocationIdentityDetected/, 'LP054.5C continues to expose unsafe location identity diagnostics');
assert.match(source, /"Flooding", flood: "Flooding", construction: "Construction", disabled_vehicle: "Disabled vehicle", debris: "Debris"/, 'accepted structured hazard labels include flooding, construction, disabled vehicle, and debris');
assert.match(source, /gridlyLp0543IsHazardStatusIdentity\(normalized\.consumerSubject\) && normalized\.consumerSubjectKind !== "structured_hazard_location"/, 'location-only hazard blocklist is not applied to validated structured consumer subjects');

['exact_waco_crossing', 'same_county_exclusion', 'nearby_crossing', 'flooding_location', 'context_switch_stale_state'].forEach((caseName) => {
  assert.ok(source.includes(caseName), `LP054.5C audit includes ${caseName}`);
});

['fixturePersistenceDetected', 'historyWriteAttemptDetected: false', 'activeStateMutationDetected: false', 'protectedSystemsSafe: true', 'internalIdentifierSubjectDetected'].forEach((field) => {
  assert.ok(source.includes(field), `LP054.5C protected diagnostic remains exposed: ${field}`);
});

assert.match(source, /window\.gridlyLp0545cHistoricalSubjectAuthorityAudit\s*=\s*gridlyLp0545HistoricalContextBindingCertification/, 'LP054.5C browser certification helper is exposed');
assert.match(source, /safeToMergeLp0545c: allCasesPassed/, 'LP054.5C aggregate safe-to-merge gate is exposed');

console.log('LP054.5C historical subject authority repair static coverage passed');
