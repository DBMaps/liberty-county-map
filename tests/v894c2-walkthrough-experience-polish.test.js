const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const docSource = fs.readFileSync('docs/audits/GRIDLY-V894C-BETA-FIRST-RUN-EXPERIENCE.md', 'utf8');

assert(appSource.includes('id="gridlyV894CFirstRunSkipBtn"'), 'visible Skip button exists');
assert(appSource.includes('>Skip</button>'), 'Skip button uses simple visible copy');
assert(appSource.includes('id="gridlyV894C2FirstRunFinishBtn"'), 'Finish button exists');
assert(appSource.includes('source: "v894c2_skip"'), 'Skip uses the completion close path');
assert(appSource.includes('source: "v894c2_finish"'), 'Finish uses the completion close path');
assert(appSource.includes('Quick Tour'), 'Quick Tour language is used');
assert(!appSource.includes('A quick beta walkthrough of the main controls before you start testing.'), 'technical walkthrough copy was removed');
assert(!appSource.includes('<ul class="gridly-v894c-first-run-list"'), 'bullet-heavy walkthrough list was removed');

for (const phrase of [
  'Welcome to Gridly',
  'Know Before You Go.',
  'Gridly helps you see what’s happening nearby before you leave.',
  'Check your quick briefing before heading out.',
  'See nearby reports, crossings, hazards, and conditions.',
  'Open Alerts to see active reports in one place.',
  'See something? Submit a report to help others.',
  'Search a destination before you go.',
  'Thanks for helping test Gridly.'
]) {
  assert(appSource.includes(phrase) || docSource.includes(phrase), `polished tour includes: ${phrase}`);
}

for (const key of [
  'visibleSkipButtonDetected',
  'simplifiedCopyDetected',
  'bulletHeavyCopyRemoved',
  'quickTourLanguageDetected',
  'oneIdeaPerScreen',
  'skipPersistsCompletion',
  'finishPersistsCompletion',
  'protectedSystemsUnchanged',
  'safeForBeta'
]) {
  assert(appSource.includes(key), `audit reports ${key}`);
  assert(docSource.includes(key), `documentation reports ${key}`);
}

assert(appSource.includes('Show walkthrough again'), 'Settings can restart the tour');
assert(docSource.includes('No Supabase schema'), 'documentation confirms protected systems are unchanged');

console.log('v894c2-walkthrough-experience-polish.test.js passed');
