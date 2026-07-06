const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const indexSource = fs.readFileSync('index.html', 'utf8');
const docSource = fs.readFileSync('docs/audits/GRIDLY-V894C-BETA-FIRST-RUN-EXPERIENCE.md', 'utf8');

assert(appSource.includes('GRIDLY_BETA_FIRST_RUN_WALKTHROUGH_STORAGE_KEY'), 'V894C localStorage key constant exists');
assert(appSource.includes('gridlyBetaFirstRunWalkthroughCompleteV894C'), 'V894C completion is stored locally');
assert(appSource.includes('requestAnimationFrame(() => openGridlyWelcomeOnboarding({ source: "first_run" }))'), 'V894C does not block core app rendering before opening');
assert(appSource.includes('data-gridly-beta-first-run-walkthrough'), 'V894C walkthrough content is configured');
assert(appSource.includes('Skip walkthrough'), 'V894C walkthrough is skippable');
assert(appSource.includes('window.gridlyResetFirstRunWalkthrough'), 'V894C safe reset/debug helper exists');
assert(appSource.includes('window.gridlyFirstRunExperienceAudit = gridlyFirstRunExperienceAudit;'), 'V894C audit helper is exposed');
assert(appSource.includes('Show walkthrough again') || indexSource.includes('Show walkthrough again'), 'V894C is restartable from Settings');

for (const phrase of [
  'Know Before You Go / Awareness Brief',
  'Map',
  'Alerts',
  'Report',
  'Search',
  'Awareness area / Home area'
]) {
  assert(appSource.includes(phrase) || docSource.includes(phrase), `V894C covers ${phrase}`);
}

for (const key of [
  'available',
  'walkthroughConfigured',
  'localStorageKey',
  'completedStateDetected',
  'appearsOnlyWhenIncomplete',
  'skippable',
  'restartableFromSettings',
  'consumerLanguage',
  'protectedSystemsUnchanged',
  'safeForBeta'
]) {
  assert(appSource.includes(key), `V894C audit reports ${key}`);
  assert(docSource.includes(key), `V894C doc reports ${key}`);
}

assert(docSource.includes('No Supabase schema'), 'V894C doc confirms protected schema scope');
assert(!/Supabase schema[\s\S]*modified/i.test(docSource), 'V894C does not claim protected schema changes');

console.log('v894c-beta-first-run-experience.test.js passed');
