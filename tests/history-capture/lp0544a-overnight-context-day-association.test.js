const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
const contextSection = source.slice(source.indexOf('const GRIDLY_LP0544_CONTEXT_WINDOW_THRESHOLD_MINUTES'), source.indexOf('function gridlyLp0543ResolveConsumerSubject'));
const auditSection = source.slice(source.indexOf('function gridlyLp0544ContextAwareHistoricalIntelligenceAudit'), source.indexOf('window.gridlyLp0543VisibleHistoricalPatternAudit'));

assert.match(contextSection, /const GRIDLY_LP0544_WEEKDAYS = Object\.freeze\(\["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"\]\)/, 'weekday order is explicit and deterministic');
assert.match(contextSection, /function gridlyLp0544NextWeekday[\s\S]*\(index \+ 1\) % GRIDLY_LP0544_WEEKDAYS\.length/, 'next weekday helper supports rollover');
assert.match(contextSection, /function gridlyLp0544PreviousWeekday[\s\S]*GRIDLY_LP0544_WEEKDAYS\.length - 1/, 'previous weekday helper remains deterministic');
assert.match(contextSection, /const overnight = end < start[\s\S]*const nextSupportedCalendarDay = gridlyLp0544NextWeekday\(supportedDay\)[\s\S]*afterMidnightContinuationDay[\s\S]*afterMidnightContinuation[\s\S]*classification = "active_window"/, 'overnight after-midnight continuation is resolved before different_day');
assert.match(contextSection, /afterMidnightContinuationDay && now\.consumerLocalMinutes > end && now\.consumerLocalMinutes - end <= GRIDLY_LP0544_CONTEXT_WINDOW_THRESHOLD_MINUTES[\s\S]*classification = "recently_ended_window"/, 'after-midnight recently-ended threshold is preserved');
assert.match(contextSection, /else \{\n\s+classification = "different_day";\n\s+\}/, 'overnight continuation falls through to different_day after threshold');
assert.match(contextSection, /!overnight[\s\S]*!currentDayMatches[\s\S]*different_day[\s\S]*same_day_outside_window/, 'normal non-overnight ordering remains same-day first');
assert.doesNotMatch(contextSection, /getTimezoneOffset\(|-05:00|-06:00|UTC offset/i, 'no hardcoded UTC offset is introduced in classifier');

['monday_1120_pm_approaching', 'monday_1150_pm_active', 'tuesday_1210_am_monday_continuation', 'tuesday_1235_am_recently_ended', 'tuesday_100_am_different_day', 'sunday_1150_pm_active', 'monday_1210_am_sunday_continuation', 'saturday_1150_pm_active', 'sunday_1210_am_saturday_continuation'].forEach((caseName) => {
  assert.ok(auditSection.includes(caseName), `LP054.4A audit includes ${caseName}`);
});
['expectedContextClassification', 'expectedHeading', 'classificationExpectationPass', 'headingExpectationPass', 'safeToMergeLp0544a', 'window.gridlyLp0544aOvernightContextAudit'].forEach((token) => {
  assert.ok(auditSection.includes(token), `audit integrity exposes ${token}`);
});
assert.match(auditSection, /classificationExpectationPass && headingExpectationPass[\s\S]*browserCertificationStatus: allCasesPassed \? "PASS" : "REVIEW"/, 'deterministic expectation mismatches fail LP054.4A certification');
assert.match(auditSection, /historyWriteAttemptDetected: false[\s\S]*activeStateMutationDetected: false/, 'fixture remains read-only with no active-state mutation');

console.log('LP054.4A overnight context day-association static coverage passed');
