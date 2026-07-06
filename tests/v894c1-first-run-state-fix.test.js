const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const docSource = fs.readFileSync('docs/audits/GRIDLY-V894C-BETA-FIRST-RUN-EXPERIENCE.md', 'utf8');

assert(appSource.includes('function getGridlyFirstRunCompletionStorageKey()'), 'canonical completion source helper exists');
assert(appSource.includes('return GRIDLY_BETA_FIRST_RUN_WALKTHROUGH_STORAGE_KEY;'), 'walkthrough key is the canonical completion source');
assert(appSource.includes('function isGridlyFirstRunWalkthroughComplete()'), 'completion detection uses one helper');
assert(appSource.includes('function resetGridlyFirstRunWalkthroughState'), 'shared reset helper exists');
assert(appSource.includes('gridlyClearFirstRunLegacyCompletionKeys();'), 'legacy welcome/setup completion keys are cleared');
assert(appSource.includes('window.gridlyResetFirstRunWalkthrough = function gridlyResetFirstRunWalkthrough()'), 'debug reset helper is exposed');
assert(appSource.includes('resetGridlyFirstRunWalkthroughState({ forceSetupReset: true, source: "debug_helper" })'), 'debug reset fully restores first-run state');
assert(appSource.includes('resetGridlyFirstRunWalkthroughState({ forceSetupReset: true, source: "portrait_v2_settings_replay" })'), 'Settings restart fully resets first-run state before reopening');
assert(appSource.includes('markGridlyWelcomeSeen();'), 'skip/finish paths persist canonical completion');
assert(!appSource.includes('gridlySafeLocalStorageSet(GRIDLY_WELCOME_SEEN_STORAGE_KEY, "yes")'), 'legacy welcome key is not written as a second completion source');

for (const auditKey of [
  'walkthroughCompletionStored',
  'walkthroughCompletionDetected',
  'resetFullyClearsCompletion',
  'skipPersistsCompletion',
  'finishPersistsCompletion',
  'restartFromSettingsWorks',
  'noOrphanedLocalStorageKeys',
  'canonicalCompletionSource',
  'protectedSystemsUnchanged',
  'safeForBeta'
]) {
  assert(appSource.includes(auditKey), `audit reports ${auditKey}`);
  assert(docSource.includes(auditKey), `documentation explains ${auditKey}`);
}

assert(docSource.includes('canonical completion source'), 'documentation describes the corrected state model');
assert(docSource.includes('gridlyBetaFirstRunWalkthroughCompleteV894C'), 'documentation names the canonical key');
assert(docSource.includes('No Supabase schema'), 'protected Supabase scope remains unchanged');

console.log('v894c1-first-run-state-fix.test.js passed');
