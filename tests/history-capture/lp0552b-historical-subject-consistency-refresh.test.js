const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert.match(source, /function gridlyLp0552PatternWithFinalConsumerSubject/, 'renderer normalizes the pattern model to one final consumer subject before sheet HTML is built');
assert.match(source, /finalConsumerSubjectLabel/, 'current-time context receives the final consumer subject instead of re-resolving section-local fallbacks');
assert.match(source, /data-gridly-history-pattern-subject="\$\{sanitizeText\(subjectLabel\)\}"/, 'DOM audit attributes use the same final subject as the visible heading');
assert.match(source, /data-gridly-history-pattern-statement="\$\{role\}"/, 'recurring-pattern statements are rendered from the governed final-subject pattern');
assert.match(source, /gridlyLp0552WhyItMattersLine\(subjectLabel\)/, 'why-it-matters copy uses the same final subject as the heading');
assert.match(source, /data-gridly-history-render-awareness-identity/, 'history sheet records the awareness identity used for this render');
assert.match(source, /function gridlyLp0552RefreshOpenHistoricalSheetForAwarenessChange/, 'open Historical Intelligence sheet refreshes through a focused lifecycle helper');
assert.match(source, /const historicalSheetRefreshResult = gridlyLp0552RefreshOpenHistoricalSheetForAwarenessChange\(reason\)/, 'canonical awareness surface sync rerenders the open History sheet without polling');
assert.match(source, /stalePriorSubjectRemoved/, 'refresh result verifies prior subject text is not retained after rerender');
[
  'resolvedConsumerSubjectLabel',
  'visibleSheetSubjectLabel',
  'recurringPatternSubjectLabel',
  'whyItMattersSubjectLabel',
  'allConsumerSubjectReferences',
  'allSubjectReferencesAgree',
  'genericSubjectPlaceholderCount',
  'staleSubjectDetected',
  'currentAwarenessSubjectLabel',
  'visibleSubjectMatchesCurrentAwareness',
  'sheetRenderAwarenessIdentity',
  'currentAwarenessIdentity',
  'sheetAwarenessIdentityMatchesCurrent',
  'certificationBlockers',
  'certificationBlockerCount'
].forEach((field) => assert.match(source, new RegExp(field), `${field} audit field is present`));
[
  'mixed_subject_references',
  'generic_subject_placeholder_visible',
  'stale_sheet_awareness_subject',
  'sheet_awareness_identity_mismatch',
  'current_awareness_subject_mismatch',
  'unsupported_crossing_entry_point_expectation'
].forEach((blocker) => assert.match(source, new RegExp(blocker), `${blocker} blocker is enforced`));
assert.doesNotMatch(source, /data-v2-action="(?:open-)?histor/i, 'no new crossing or popup History action is introduced');

console.log('LP055.2B historical subject consistency and awareness refresh static coverage passed');
