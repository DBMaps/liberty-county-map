const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');

assert.match(source, /function gridlyLp0544ResolveConsumerNow\(options = \{\}\)[\s\S]*options\?\.consumerNow \|\| options\?\.now[\s\S]*gridlyLp0543ConsumerLocalParts\(ms\)/, 'LP054.4 has one injected current-time boundary using consumer-local parts');
assert.match(source, /const GRIDLY_LP0543_CONSUMER_TIME_ZONE = "America\/Chicago"/, 'LP054.4 preserves named America/Chicago timezone strategy');
const contextSection = source.slice(source.indexOf('function gridlyLp0544ResolveConsumerNow'), source.indexOf('function gridlyLp0543ResolveConsumerSubject'));
assert.doesNotMatch(contextSection, /getTimezoneOffset\(|-05:00|-06:00|UTC offset/i, 'LP054.4 does not implement context with hardcoded UTC offsets');
['active_window', 'approaching_window', 'recently_ended_window', 'same_day_outside_window', 'different_day', 'no_context_match'].forEach((classification) => assert.ok(contextSection.includes(classification), `required context classification ${classification} is present`));
assert.match(source, /GRIDLY_LP0544_CONTEXT_WINDOW_THRESHOLD_MINUTES = 30/, 'approaching and recently-ended thresholds remain conservative at 30 minutes');
assert.match(source, /const overnight = end < start[\s\S]*gridlyLp0544NextWeekday\(supportedDay\)[\s\S]*active_window/, 'overnight windows are handled without assuming start precedes end');
assert.match(source, /contextPrecisionSupported[\s\S]*GRIDLY_LP0543_MIN_PRECISE_WINDOW_INCIDENTS/, 'context precision remains gated by existing precise-window evidence threshold');
assert.match(source, /incidentCount < GRIDLY_LP0543_MIN_INDEPENDENT_INCIDENTS/, 'existing minimum independent incident threshold remains unchanged');
assert.match(source, /function gridlyLp0543IncidentKey[\s\S]*incidentId[\s\S]*Math\.floor\(start \/ 5400000\)/, 'multiple confirmations in one incident remain grouped before context is applied');
assert.match(source, /const pattern = gridlyLp0544ApplyContextToPattern\(candidates\.find\(\(candidate\) => candidate\.available\)/, 'current context is applied only after pattern qualification');
assert.match(source, /data-gridly-history-context-heading|data-gridly-history-context-statement|data-gridly-history-context-classification/, 'stable DOM context certification markers are rendered');
assert.match(source, /buildGridlyHistoricalIntelligenceSheetHtml\([\s\S]*pattern\.contextHeading[\s\S]*pattern\.contextStatement/, 'renderer consumes authoritative model context heading and statement');
assert.match(source, /unsupportedPredictionLanguageDetected[\s\S]*will be blocked\|is probably blocked\|expect it to be blocked\|guaranteed\|likely active\|currently blocked/, 'audit rejects unsupported prediction language');
assert.match(source, /liveTruthLanguageDetected[\s\S]*currently blocked/, 'audit rejects live-truth language for historical context');
assert.match(source, /fixturePersistenceDetected[\s\S]*historyWriteAttemptDetected: false[\s\S]*activeStateMutationDetected: false[\s\S]*protectedSystemsSafe/, 'audit checks fixture persistence and read-only protected systems');
assert.match(source, /expectedContextClassification[\s\S]*classificationExpectationPass[\s\S]*expectedHeading[\s\S]*headingExpectationPass/, 'audit can validate optional deterministic classification and heading expectations');
assert.match(source, /window\.gridlyLp0544ContextAwareHistoricalIntelligenceAudit = gridlyLp0544ContextAwareHistoricalIntelligenceAudit/, 'LP054.4 browser audit is exposed');

console.log('LP054.4 context-aware historical intelligence static coverage passed');
