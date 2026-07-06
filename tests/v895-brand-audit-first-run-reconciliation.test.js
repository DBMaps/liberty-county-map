const fs = require('fs');
const assert = require('assert');

const appSource = fs.readFileSync('js/app.js', 'utf8');

assert(appSource.includes('currentFirstRunPrimaryConsistent'), 'V895 audit checks current First Run primary action selectors');
assert(appSource.includes('currentFirstRunSecondaryConsistent'), 'V895 audit checks current First Run secondary action selectors');
assert(appSource.includes('.gridly-v894c2-start-link.primary-btn[data-gridly-start-tour-state]'), 'Tour Below is evaluated as a primary First Run action');
assert(appSource.includes('#gridlyV894C2FirstRunFinishBtn.primary-btn[data-gridly-first-run-finish]'), 'Finish is evaluated as a primary First Run action');
assert(appSource.includes('#gridlyV858UseLocationBtn.primary-btn'), 'Use My Location is evaluated as a primary First Run action');
assert(appSource.includes('#gridlyV858ManualLocationForm .secondary-btn[type="submit"]'), 'Continue is evaluated as a secondary First Run action');
assert(appSource.includes('#gridlyV894CFirstRunSkipBtn.secondary-btn[data-gridly-first-run-skip]'), 'Skip remains evaluated as a secondary First Run action');
assert(appSource.includes('legacyFirstRunConsistent'), 'Legacy welcome selectors are retained as fallback only');

console.log('v895-brand-audit-first-run-reconciliation.test.js passed');
