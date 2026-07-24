const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../../js/app.js'), 'utf8');

assert.match(source, /function gridlyLp0545aHistoricalContextCertificationAudit/, 'LP054.5A certification audit helper exists');
assert.match(source, /window\.gridlyLp0545aHistoricalContextCertificationAudit\s*=\s*gridlyLp0545aHistoricalContextCertificationAudit/, 'LP054.5A audit is exposed on window');
[
  'contextResolvedPass', 'contextTypePass', 'contextSpecificityPass', 'subjectAgreement',
  'headingAgreement', 'statementAgreement', 'matchedRecordExpectationPass',
  'unrelatedCrossingIsolationPass', 'unrelatedLocationIsolationPass', 'awarenessAreaIsolationPass',
  'noDataStateAgreement', 'staleContextPass', 'fixturePersistencePass',
  'historyWriteSafetyPass', 'activeStateSafetyPass', 'protectedSystemsSafe',
  'failedChecks', 'failedCheckCount'
].forEach((field) => assert.ok(source.includes(field), `safe guard field is exposed: ${field}`));
assert.match(source, /failedChecks\.length === 0/, 'safe merge is computed from explicit failedChecks');
assert.match(source, /data-gridly-history-context-subject/, 'stable DOM marker exposes authoritative context subject');
assert.match(source, /data-gridly-history-no-data-heading/, 'stable DOM marker exposes no-data heading');
assert.match(source, /data-gridly-history-no-data-statement/, 'stable DOM marker exposes no-data statement');
assert.match(source, /modelNoDataHeading[\s\S]*domNoDataHeading[\s\S]*noDataHeadingAgreement/, 'no-data heading agreement is audited');
assert.match(source, /modelNoDataStatement[\s\S]*domNoDataStatement[\s\S]*noDataStatementAgreement/, 'no-data statement agreement is audited');
assert.match(source, /patternResultAvailable \? JSON\.stringify\(statements\) === JSON\.stringify\(domStatements\) : true/, 'intentional no-data cases do not require pattern statement agreement');
assert.match(source, /expectedMatchedRecordCount: 4/, 'exact Waco and same-county expectation preserves four matched records');
assert.match(source, /excludedUnrelatedRecordCount/, 'excluded unrelated records are reported without being treated as failures');
assert.match(source, /nearby_crossing:[\s\S]*expectedMatchedRecordCount: 0[\s\S]*expectedPatternAvailability: false[\s\S]*expectedInsufficientHistoryState: true/, 'nearby crossing zero-record no-data state is expected');
assert.match(source, /flooding_location:[\s\S]*expectedConsumerSubject: "Flooding near FM 1960"[\s\S]*expectedMatchedRecordCount: 3/, 'flooding subject and count expectations are internal');
assert.match(source, /subjectAuthoritySource: "historical_context"/, 'historical context remains subject authority source');
assert.match(source, /subjectTransformationDetected/, 'subject transformation diagnostics are exposed');
assert.match(source, /contextConsumerSubject[\s\S]*modelConsumerSubject[\s\S]*domConsumerSubject/, 'context/model/DOM subject chain is audited');
assert.match(source, /if \(primary\) return `\$\{\/flood\/i\.test\(context\.hazardType \|\| context\.category \|\| ""\) \? "Flooding" : "Hazard"\} near \$\{primary\}`;/, 'generic Hazard fallback remains only when flooding identity is not present in the LP054.5 subject helper');
assert.match(source, /hazardType: safeDisplayText\(context\.hazardType/, 'normalized context preserves hazard type for subject fallback');
assert.match(source, /priorSubjectVisibleAfterSwitch[\s\S]*priorStatementsVisibleAfterSwitch[\s\S]*secondNoDataStateVisible[\s\S]*contextSwitchPass/, 'context-switch audit validates stale subject, stale statements, and second no-data state');
assert.match(source, /fixturePersistenceDetected[\s\S]*historyWriteAttemptDetected: false[\s\S]*activeStateMutationDetected: false/, 'LP054.5A audit remains read-only for persistence, history writes, and active state');
assert.match(source, /safeToMergeLp0545a: allCasesPassed/, 'aggregate LP054.5A safe-to-merge gate is exposed');

console.log('LP054.5A historical context certification repair static coverage passed');
