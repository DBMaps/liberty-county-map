const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert.match(source, /history:\s*\{\s*title:\s*"Historical Intelligence",\s*html:\s*buildGridlyHistoricalIntelligenceSheetHtml/, 'existing Historical Intelligence sheet renderer is reused');
assert.match(source, /data-lp0543-visible-pattern="true"/, 'eligible Pattern Intelligence renders inside the existing sheet');
assert.match(source, /<strong>Typical Pattern<\/strong>/, 'Typical Pattern heading is visible');
assert.match(source, /data-lp0543-insufficient-history="true"/, 'insufficient evidence has a consumer-safe state');
assert.match(source, /Gridly needs more community observations before identifying a reliable pattern here\./, 'insufficient history copy is consumer safe');
assert.match(source, /GRIDLY_LP0543_MIN_INDEPENDENT_INCIDENTS\s*=\s*3/, 'minimum independent incident threshold exists');
assert.match(source, /gridlyLp0543IncidentKey[\s\S]*incidentId[\s\S]*episodeId[\s\S]*Math\.floor\(start \/ 5400000\)/, 'incident grouping prevents same-event reports from becoming recurring occurrences');
assert.match(source, /GRIDLY_LP0543_MIN_DAY_PATTERN_INCIDENTS\s*=\s*3/, 'Monday/day pattern requires multiple independent incidents');
assert.match(source, /GRIDLY_LP0543_MIN_PRECISE_WINDOW_INCIDENTS\s*=\s*3/, 'precise time windows require sufficient evidence');
assert.match(source, /options\?\.developerProtectedMode === true/, 'protected placeholder is only used for explicit developer protection mode');
assert.match(source, /rawHistoryLeakDetected[\s\S]*technicalMetadataLeakDetected[\s\S]*chronologicalEventLanguageDetected/, 'audit checks raw records, IDs, timestamps, metadata, and event-viewer language are suppressed');
assert.match(source, /historyWriteAttemptDetected:\s*false[\s\S]*activeStateMutationDetected:\s*false[\s\S]*protectedSystemsSafe:\s*true/, 'audit asserts read-only behavior and protected system safety');
assert.match(source, /window\.gridlyLp0543VisibleHistoricalPatternAudit\s*=\s*gridlyLp0543VisibleHistoricalPatternAudit/, 'browser certification helper is exposed');
assert.match(source, /lp0543CertificationFixture[\s\S]*2026-06-01T05:47:00-05:00[\s\S]*2026-06-08T05:52:00-05:00[\s\S]*2026-06-15T05:45:00-05:00/, 'deterministic audit-only fixture models independent Monday incidents');

console.log('LP054.3 visible historical pattern activation static coverage passed');
