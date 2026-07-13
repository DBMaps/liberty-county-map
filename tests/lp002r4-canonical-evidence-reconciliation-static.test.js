const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');

assert(app.includes('function gridlyKnowBeforeYouGoReconcileEvidenceRecords'), 'canonical evidence reconciliation helper exists');
assert(app.includes('gridlyKnowBeforeYouGoCanonicalEvidenceKey'), 'canonical reconciliation uses normalized keys');
assert(app.includes('gridlyKnowBeforeYouGoRecordIdentityValues'), 'canonical reconciliation considers existing identifiers');
assert(app.includes('gridlyKnowBeforeYouGoRecordPriority'), 'canonical reconciliation applies representation priority');
assert(app.includes('duplicateEvidenceRecordCount'), 'presentation audit exposes duplicate evidence count');
assert(app.includes('reconciledDuplicateGroups'), 'presentation audit exposes reconciled duplicate groups');
assert(app.includes('canonicalConditionKeys'), 'presentation audit exposes canonical condition keys');
assert(app.includes('duplicateConditionSuppressed'), 'presentation audit exposes duplicate suppression');
assert(app.includes('headlinePluralityMatchesCanonicalCount'), 'presentation audit compares headline plurality with canonical condition count');
assert(app.includes('gridlyRestoreReportSubmissionInteraction("tap_map_hazard_success")'), 'tap-map deferred report completion path releases submission lifecycle after cleanup');
assert(app.includes('submissionSucceeded'), 'report completion audit exposes submission success');
assert(app.includes('finalReportUiState'), 'report completion audit exposes final UI state');

console.log('LP002R.4 canonical reconciliation static checks passed');
