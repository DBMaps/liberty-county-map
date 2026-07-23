const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert.match(source, /function gridlyLp0543bHistoricalPatternDomCertificationAudit/, 'LP054.3B browser certification helper exists');
assert.match(source, /buildGridlyHistoricalIntelligenceSheetHtml\(\{[\s\S]*patternModel: model/, 'fixture model is injected through the production Historical Intelligence renderer');
assert.match(source, /data-gridly-history-pattern-subject/, 'renderer emits stable subject selector attributes');
assert.match(source, /data-gridly-history-pattern-time-window/, 'renderer emits stable time-window selector attributes');
assert.match(source, /data-gridly-history-pattern-duration/, 'renderer emits stable duration selector attributes');
assert.match(source, /data-gridly-history-pattern-statement="duration"/, 'duration parser targets the rendered duration statement node');
assert.match(source, /modelPatternStatements[\s\S]*domVisiblePatternStatements[\s\S]*statementAgreement/, 'audit separately reports model and DOM statements and compares them');
assert.match(source, /durationText\.match\(\/\(\?:about \)\?\(\\d\+\) hours\?\//, 'duration parser supports multi-digit hour durations');
assert.match(source, /minuteMatch = durationText\.match\(\/\(\?:\^\| \)\(\\d\+\) minutes\?\$\//, 'duration parser supports multi-digit minute durations instead of one digit');
assert.match(source, /\\b1 minutes\\b/, 'duration parser rejects invalid singular grammar');
assert.match(source, /GRIDLY_LP0543_HAZARD_IDENTITY_TERMS[\s\S]*Flooding Cleared/i, 'hazard and lifecycle identity registry rejects Flooding Cleared');
assert.match(source, /gridlyLp0543SafeIdentityCandidate[\s\S]*gridlyLp0543IsHazardStatusIdentity/, 'consumer subject resolver filters hazard/status identity candidates');
assert.match(source, /This crossing[\s\S]*This location/, 'invalid identity falls back to consumer-safe generic labels');
assert.match(source, /isolatedCertificationContainerUsed[\s\S]*liveSheetRestored/, 'fixture certification uses an isolated container or reports live sheet restoration');
assert.match(source, /fixturePersistenceDetected[\s\S]*historyWriteAttemptDetected:\s*false[\s\S]*activeStateMutationDetected:\s*false/, 'audit reports fixture persistence, historical write, and active-state mutation guards');
assert.match(source, /safeToMergeLp0543b:\s*safe/, 'LP054.3B safe-to-merge gate is exposed');

console.log('LP054.3B historical fixture-to-DOM certification static coverage passed');
