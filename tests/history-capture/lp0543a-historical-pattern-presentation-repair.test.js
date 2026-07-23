const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert.match(source, /GRIDLY_LP0543_CONSUMER_TIME_ZONE\s*=\s*"America\/Chicago"/, 'consumer-local timezone uses named Gridly launch-region timezone');
assert.match(source, /Intl\.DateTimeFormat\("en-US",\s*\{[\s\S]*timeZone:\s*GRIDLY_LP0543_CONSUMER_TIME_ZONE/, 'local classification uses Intl.DateTimeFormat with the configured timezone');
assert.doesNotMatch(source, /\b(?:5\s*\*\s*60|300)\s*\*\s*60\s*\*\s*1000\b|hardcoded.*five-hour|five-hour.*offset/i, 'no hardcoded five-hour offset is used');
assert.match(source, /createdAt:\s*"2026-06-01T05:47:00-05:00"[\s\S]*createdAt:\s*"2026-06-08T05:52:00-05:00"[\s\S]*createdAt:\s*"2026-06-15T05:45:00-05:00"/, 'fixture explicitly encodes local-offset Monday morning timestamps');
assert.match(source, /clearedAt:\s*"2026-06-08T06:20:00-05:00"/, 'fixture encodes the expected local clear-window endpoint');
assert.match(source, /localDayClassification:\s*topDay/, 'audit exposes local day classification from the visible model');
assert.match(source, /gridlyLp0543ResolveConsumerSubject[\s\S]*crossing_display_name[\s\S]*primary_intersecting_roads[\s\S]*canonical_location_label[\s\S]*nearest_consumer_safe_road[\s\S]*This crossing/, 'subject resolution follows crossing/location fallback order');
assert.match(source, /countyUsedAsCrossingSubject[\s\S]*identityPresentationPass/, 'audit checks county names are not crossing subjects');
assert.match(source, /gridlyLp0543FormatAuthoritativeDuration[\s\S]*rounded === 1[\s\S]*1 minute[\s\S]*about \$\{rounded\} minutes[\s\S]*about \$\{hourText\}/, 'authoritative duration formatter handles singular, minutes, and hours');
assert.match(source, /It usually clears within \$\{gridlyLp0543FormatAuthoritativeDuration\(avg\)\}\./, 'visible renderer uses the model duration formatter instead of recalculating in HTML');
assert.match(source, /renderedDurationMinutes[\s\S]*modelDurationMinutes[\s\S]*durationAgreement[\s\S]*durationGrammarPass/, 'audit compares rendered and model duration');
assert.match(source, /rawHistoryLeakDetected[\s\S]*historyWriteAttemptDetected:\s*false[\s\S]*activeStateMutationDetected:\s*false[\s\S]*protectedSystemsSafe:\s*true/, 'raw history and protected-system checks remain clean');
assert.match(source, /window\.gridlyLp0543aHistoricalPatternPresentationAudit\s*=\s*gridlyLp0543VisibleHistoricalPatternAudit/, 'LP054.3A presentation audit alias is exposed');

console.log('LP054.3A historical pattern presentation repair static coverage passed');
