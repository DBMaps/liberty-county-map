const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const safeDisplayTextSource = 'function safeDisplayText(value, fallback = "") { const raw = value == null ? fallback : value; return String(raw == null ? "" : raw).replace(/\\s+/g, " " ).trim(); }';
const leakSource = source.slice(source.indexOf('function gridlyLp0545InternalIdentifierLeakEvidence'), source.indexOf('function gridlyLp0545ResolveAuthoritativePatternSubject'));
const visibleSource = source.slice(source.indexOf('function gridlyLp0552VisibleConsumerTextForLeakAudit'), source.indexOf('function gridlyLp0552HistoricalSubjectPresentMomentAudit'));
const context = { normalizeGridlyUserFacingRoadText: (value) => String(value || '') };
vm.createContext(context);
vm.runInContext(`${safeDisplayTextSource}\n${leakSource}\n${visibleSource}`, context);

const visibleText = context.gridlyLp0552VisibleConsumerTextForLeakAudit(null, '<div data-gridly-history-render-awareness-identity="liberty-tx|dayton|community|Dayton"><p>Dayton</p></div>');
assert.strictEqual(visibleText, 'Dayton', 'audit-only data-gridly attributes are outside the visible leak boundary');
assert.strictEqual(context.gridlyLp0545InternalIdentifierLeakEvidence(visibleText).length, 0, 'audit-only liberty-tx/dayton identity metadata does not trigger visible leakage');
assert.ok(context.gridlyLp0545InternalIdentifierLeakEvidence('Visible liberty-tx key').some((e) => e.matchedText === 'liberty-tx'), 'visible liberty-tx triggers leakage');
assert.ok(context.gridlyLp0545InternalIdentifierLeakEvidence('Visible FRA-WACO-US90 id').some((e) => e.type === 'fra_identifier'), 'visible FRA IDs trigger leakage');
assert.ok(context.gridlyLp0545InternalIdentifierLeakEvidence('Visible dayton-community storage_id').length >= 2, 'visible raw storage and community keys trigger leakage');

let evidence = context.gridlyLp0552DayRelationshipEvidence('Today is outside the day most often reported for Dayton.', 'Dayton', 'Friday', 'Thursday', 'current_day_differs_from_common_day');
assert.strictEqual(evidence.currentRelationshipPhraseDetected, true, 'approved day-mismatch sentence detects current-day relationship');
assert.strictEqual(evidence.resolvedSubjectDetected, true, 'approved day-mismatch sentence names the subject');
assert.strictEqual(evidence.historicalDayDetected, false, 'first sentence alone does not claim historical day evidence');

evidence = context.gridlyLp0552DayRelationshipEvidence('Today is outside the day most often reported for Dayton. Most cleared reports occurred on Thursdays between 7:02 AM to 3:37 PM.', 'Dayton', 'Friday', 'Thursday', 'current_day_differs_from_common_day');
assert.strictEqual(evidence.currentRelationshipPhraseDetected && evidence.resolvedSubjectDetected && evidence.historicalDayDetected, true, 'combined Dayton consumer line explains the day relationship');
assert.strictEqual(context.gridlyLp0552DayRelationshipEvidence('Most cleared reports occurred on Thursdays between 7:02 AM to 3:37 PM.', 'Dayton', 'Friday', 'Thursday', 'current_day_differs_from_common_day').historicalDayDetected, true, 'historical-day sentence is recognized');
assert.strictEqual(context.gridlyLp0552DayRelationshipEvidence('Historical patterns vary by weekday.', 'Dayton', 'Friday', 'Thursday', 'current_day_differs_from_common_day').currentRelationshipPhraseDetected, false, 'vague day line fails the mismatch relationship');

assert.match(source, /predictiveLanguageDetected = \/\\b\(\?:likely\|expected\|predicted\|will happen\|should\|high risk\|low risk\|safe\|no issue/, 'predictive wording protections remain active');
assert.match(source, /liveStatusClaimDetected = \/\\b\(\?:currently active\|currently clear\|currently blocked/, 'live-condition claim protections remain active');
assert.match(source, /awarenessRefreshPending\) certificationBlockers\.push\("awareness_refresh_pending"\)/, 'audit reports REVIEW while awareness refresh is pending');
assert.match(source, /lastAwarenessRefreshCompletedAt/, 'audit exposes canonical awareness refresh completion state');
assert.match(source, /internalIdLeakEvidence/, 'audit exposes exact visible internal ID evidence');
assert.match(source, /dayRelationshipEvidence/, 'audit exposes semantic day relationship evidence');
assert.match(source, /mixed_subject_references/, 'LP055.2B mixed-subject protection remains active');
assert.match(source, /stale_sheet_awareness_subject/, 'LP055.2B stale-subject protection remains active');
assert.match(source, /resolvedConsumerSubjectLabel: subjectResolution\.label/, 'production-path fixtures retain Dayton and Liberty County resolved subject reporting');
assert.match(source, /certificationStatus: safe \? "PASS" : "REVIEW"/, 'audit passes only with no blockers after refresh completion');

console.log('LP055.2C historical browser audit false-positive repair coverage passed');
