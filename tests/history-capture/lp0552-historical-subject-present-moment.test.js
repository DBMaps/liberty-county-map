const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert.match(source, /function gridlyLp0552ResolveConsumerSubjectLabel/, 'LP055.2 uses a focused consumer subject label selector');
assert.match(source, /historical_context_consumer_subject/, 'historical context consumer subject participates in canonical label selection');
assert.match(source, /canonical_subject_authority/, 'canonical subject authority participates in label selection');
assert.match(source, /governed_awareness_label/, 'governed awareness-area label is the fallback before selected area');
assert.match(source, /Selected area/, 'final consumer-safe fallback is Selected area');
assert.doesNotMatch(source, /\|\| "This location"/, 'consumer rendering no longer silently falls back to This location');
assert.match(source, /data-gridly-history-consumer-subject="true">\$\{sanitizeText\(subjectLabel\)\}/, 'visible sheet renders the resolved subject label prominently');
assert.match(source, /Right now falls within a time when \$\{subject\} has been reported before\./, 'within-window copy is anchored to the subject without prediction');
assert.match(source, /Right now is outside the most commonly reported time for \$\{subject\}\./, 'outside-window copy avoids live-condition claims');
assert.match(source, /Not enough cleared reports are available to compare the current time with a reliable local pattern for \$\{subject/, 'insufficient-history copy avoids unsupported comparison');
assert.match(source, /within_common_window/, 'within relationship is explicit for audit fixtures');
assert.match(source, /near_common_window/, 'near relationship is explicit for audit fixtures');
assert.match(source, /different_common_day/, 'outside relationship is explicit for audit fixtures');
assert.match(source, /missing_window/, 'missing-window relationship is explicit for audit fixtures');
assert.match(source, /gridlyLp0552HistoricalSubjectPresentMomentAudit/, 'LP055.2 browser audit helper is exposed');
assert.match(source, /currentLocalDateTime/, 'audit reports fixed or production current local time');
assert.match(source, /presentMomentConsumerLine/, 'audit reports the exact consumer present-moment line');
assert.match(source, /predictiveLanguageDetected/, 'audit scans for predictive language');
assert.match(source, /liveStatusClaimDetected/, 'audit scans for live-condition claims');
assert.match(source, /historicalModelUntouched:\s*true/, 'audit documents the historical model was not changed');

console.log('LP055.2 historical subject and present-moment static coverage passed');
