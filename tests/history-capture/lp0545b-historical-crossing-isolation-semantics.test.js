const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../../js/app.js'), 'utf8');

assert.match(source, /function gridlyLp0545InternalIdentifierSubjectDetected/, 'LP054.5B internal identifier detector exists');
assert.match(source, /FRA-\[A-Z0-9_-/, 'FRA-style provider identifiers are rejected without blocking route labels such as US 90');
assert.match(source, /function gridlyLp0545ResolveAuthoritativePatternSubject/, 'authoritative pattern subject resolver exists');
assert.match(source, /context\?\.consumerSubject[\s\S]*return \{ subject: contextSubject, source: "historical_context" \}/, 'bound context consumerSubject has first priority');
assert.match(source, /function gridlyLp0545ApplyAuthoritativePatternSubject/, 'pattern statements are rewritten through the authoritative subject boundary');
assert.match(source, /calculatedRecordSubject[\s\S]*authoritativePatternSubject[\s\S]*patternSubjectAuthoritySource/, 'model preserves calculated subject diagnostics while exposing the authoritative subject path');
assert.match(source, /selectedPattern[\s\S]*gridlyLp0545ResolveAuthoritativePatternSubject\(lp0545Context, selectedPattern\)[\s\S]*gridlyLp0545ApplyAuthoritativePatternSubject/, 'pattern calculations happen before the canonical bound subject is applied');
assert.match(source, /unrelatedSourceRecords = allFixtureRecords\.filter\(\(record\) => !gridlyLp0545RecordMatchesContext\(record, context\)\.match\)/, 'source unrelated records are counted separately from leaks');
assert.match(source, /survivedUnrelatedRecords = matchedRecords\.filter\(\(record\) => !gridlyLp0545RecordMatchesContext\(record, context\)\.match\)/, 'leak detection is based on post-filter survivors');
assert.match(source, /unrelatedCrossingLeakDetected = Boolean\(unrelatedCrossingRecordCountMatched > 0 \|\| unrelatedCrossingIncidentGroupCount > 0 \|\| unrelatedCrossingPatternEvidenceCount > 0 \|\| unrelatedCrossingSubjectVisibleInModel \|\| unrelatedCrossingSubjectVisibleInDom\)/, 'unrelated crossing leak only trips on survived model/DOM evidence');
assert.match(source, /unrelatedCrossingIsolationPass = Boolean\(unrelatedCrossingRecordCountMatched === 0[\s\S]*!unrelatedCrossingSubjectVisibleInDom\)/, 'correctly excluded unrelated records are isolation evidence, not failure evidence');
[
  'unrelatedCrossingRecordCountInSource',
  'unrelatedCrossingRecordCountExcluded',
  'unrelatedCrossingRecordCountMatched',
  'unrelatedCrossingIncidentGroupCount',
  'unrelatedCrossingPatternEvidenceCount',
  'unrelatedCrossingSubjectVisibleInModel',
  'unrelatedCrossingSubjectVisibleInDom',
  'contextConsumerSubject',
  'calculatedRecordSubject',
  'authoritativePatternSubject',
  'modelPatternSubject',
  'domPatternSubject',
  'patternSubjectAuthoritySource',
  'internalIdentifierSubjectDetected',
  'internalIdentifierSubjectPass',
  'patternSubjectAgreement',
  'fixturePersistenceDetected',
  'historyWriteAttemptDetected: false',
  'activeStateMutationDetected: false'
].forEach((field) => assert.ok(source.includes(field), `LP054.5B audit exposes ${field}`));
assert.match(source, /internalIdentifierSubjectPass, patternSubjectAgreement/, 'subject safety gates are included in failedChecks and safe-to-merge');
assert.match(source, /window\.gridlyLp0545bHistoricalCrossingIsolationAudit\s*=\s*gridlyLp0545HistoricalContextBindingCertification/, 'LP054.5B browser certification helper is exposed');
assert.match(source, /safeToMergeLp0545b: allCasesPassed/, 'aggregate LP054.5B safe-to-merge gate is exposed');
assert.match(source, /exact_waco_crossing:[\s\S]*expectedMatchedRecordCount: 4/, 'exact Waco still expects four matched records');
assert.match(source, /same_county_exclusion:[\s\S]*expectedMatchedRecordCount: 4/, 'same-county exclusion still expects four matched Waco records');
assert.match(source, /nearby_crossing:[\s\S]*expectedMatchedRecordCount: 0[\s\S]*expectedPatternAvailability: false/, 'nearby crossing no-data behavior remains valid');
assert.match(source, /flooding_location:[\s\S]*expectedConsumerSubject: "Flooding near FM 1960"/, 'flooding context subject remains preserved');
assert.match(source, /Waco Street crossing at US 90/, 'authoritative Waco consumer subject remains visible in certification fixture');
assert.match(source, /FRA-WACO-US 90/, 'audit explicitly guards the observed spaced FRA identity');
assert.doesNotMatch(source, /unrelatedCrossingLeakDetected = context\.contextType === "crossing" && context\.crossingId !== "FRA-WACO-US90" && \/Waco Street\//, 'old source-fixture presence false-positive leak check is removed');

console.log('LP054.5B historical crossing isolation semantics static coverage passed');
