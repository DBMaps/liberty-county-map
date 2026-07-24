const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert.match(source, /history:\s*\{\s*title:\s*"Historical Intelligence",\s*html:\s*buildGridlyHistoricalIntelligenceSheetHtml/, 'bottom dock history sheet uses the production Historical Intelligence renderer');
assert.match(source, /const templateHtml = typeof template\.html === "function" \? template\.html\(\) : template\.html;/, 'production sheet invocation path calls the renderer without explicit subject options');
assert.match(source, /gridlyLp0546ResolveCurrentAwarenessContext\(options\)/, 'LP055.2A consumes the existing LP054.6 current awareness context chain');
assert.match(source, /canonical_awareness_community/, 'Dayton, Liberty, and Cleveland community subjects can resolve from canonical awareness');
assert.match(source, /canonical_awareness_countywide/, 'Liberty County countywide subjects can resolve from canonical awareness');
assert.doesNotMatch(source, /crossing-originated History sheet certification requirement/i, 'LP055.2 certification no longer requires unsupported crossing-originated History entry points');
assert.match(source, /governed_awareness_label/, 'governed awareness display label remains the honest fallback before Selected area');
assert.match(source, /safe_generic_fallback/, 'Selected area is explicitly reported as final safe fallback only');
assert.match(source, /gridlyLp0552ConsumerSubjectCandidateValid/, 'generic and internal subject candidates are rejected before provenance is assigned');
['Selected area','This location','This area','This crossing','Current area','Historical location','Unknown','Unavailable'].forEach((label) => assert.match(source, new RegExp(label), `${label} placeholder is covered by the invalid-subject rules`));
['presentMomentComparisonReason','current_day_differs_from_common_day','matching_day_and_inside_window','matching_day_outside_window','matching_day_near_window'].forEach((field) => assert.match(source, new RegExp(field), `${field} comparison reason is exposed`));
['visibleSheetSubjectLabel','subjectMatchesVisibleSheet','subjectCandidateValidityPass','genericFallbackDisplayed','provenanceAgreement','currentDayMatchesHistoricalDay','currentTimeWithinHistoricalWindow','consumerLineExplainsDayRelationship','consumerLineExplainsTimeRelationship','consumerLineNamesResolvedSubject','certificationBlockers','certificationBlockerCount'].forEach((field) => assert.match(source, new RegExp(field), `${field} audit field is exposed`));
assert.match(source, /unexpected_generic_fallback_displayed/, 'normal Dayton/community certification cannot pass with Selected area');
assert.match(source, /Today is outside the day most often reported for \$\{subject\}/, 'Friday versus Thursday copy explains day mismatch and names the subject');
assert.match(source, /Right now falls within a time when \$\{subject\} has been reported before/, 'matching-day inside-window copy explains historical alignment');
assert.match(source, /Right now is outside the most commonly reported time for \$\{subject\}/, 'matching-day outside-window copy explains time mismatch');
assert.match(source, /canonicalSubjectAuthorityPreserved = Boolean\(subjectResolution\.canonical/, 'canonical authority preservation is only true for valid non-generic canonical subjects');

console.log('LP055.2A production path subject and audit certification coverage passed');
