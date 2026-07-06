const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const styleSource = fs.readFileSync('css/styles.css', 'utf8');
const docSource = fs.readFileSync('docs/audits/GRIDLY-V894C-BETA-FIRST-RUN-EXPERIENCE.md', 'utf8');

assert(appSource.includes('data-gridly-quick-tour-scroll'), 'Quick Tour has an inner scroll region');
assert(styleSource.includes('.gridly-v894c3-tour-scroll'), 'V894C3 scroll container CSS exists');
assert(/\.gridly-v894c3-tour-scroll[\s\S]*overflow-y:\s*auto/.test(styleSource), 'inner Quick Tour content scrolls vertically');
assert(/\.gridly-v894c3-tour-scroll[\s\S]*-webkit-overflow-scrolling:\s*touch/.test(styleSource), 'mobile momentum scrolling is enabled');
assert(/\.gridly-v858-first-run-sheet[\s\S]*max-height:\s*min\(92dvh,\s*calc\(100svh - 28px\)\)/.test(styleSource), 'desktop/tablet modal uses viewport-safe max height');
assert(/@media \(max-width: 520px\)[\s\S]*max-height:\s*min\(94dvh,\s*calc\(100svh - 16px\)\)/.test(styleSource), 'mobile modal uses tighter viewport-safe max height');
assert(/@media \(max-width: 520px\) and \(orientation: portrait\)[\s\S]*max-height:\s*min\(94dvh,\s*calc\(100svh - 12px\)\)/.test(styleSource), 'mobile portrait has viewport-safe max height');
assert(/\.gridly-v858-first-run-card[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\)/.test(styleSource), 'card reserves remaining height for scrollable content');
assert(/\.gridly-v858-first-run-card[\s\S]*overflow:\s*hidden/.test(styleSource), 'card clips only the shell while inner content scrolls');
assert(/\.gridly-v894c3-tour-scroll[\s\S]*padding-bottom:\s*calc\(20px \+ env\(safe-area-inset-bottom, 0px\)\)/.test(styleSource), 'scroll region accounts for bottom safe area');

for (const selector of [
  'id="gridlyV894CFirstRunSkipBtn"',
  'class="primary-btn gridly-v894c2-start-link"',
  'id="gridlyV894C2FirstRunFinishBtn"'
]) {
  assert(appSource.includes(selector), `Quick Tour action remains present: ${selector}`);
}

for (const key of [
  'quickTourScrollEnabled',
  'quickTourViewportSafe',
  'quickTourActionsReachable',
  'noQuickTourContentClipping',
  'protectedSystemsUnchanged',
  'safeForBeta'
]) {
  assert(appSource.includes(key), `audit reports ${key}`);
  assert(docSource.includes(key), `documentation reports ${key}`);
}

assert(appSource.includes('source: "v894c2_skip"'), 'Skip keeps V894C2 completion path');
assert(appSource.includes('source: "v894c2_finish"'), 'Finish keeps V894C2 completion path');
assert(docSource.includes('No Supabase schema'), 'protected systems remain documented unchanged');

console.log('v894c3-walkthrough-mobile-scroll-fix.test.js passed');
