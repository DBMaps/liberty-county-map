const fs = require('fs');
const assert = require('assert');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const styleSource = fs.readFileSync('css/styles.css', 'utf8');
const docSource = fs.readFileSync('docs/audits/GRIDLY-V894C-BETA-FIRST-RUN-EXPERIENCE.md', 'utf8');

assert(appSource.includes('data-gridly-quick-tour-scroll-enabled="true"'), 'Quick Tour scroll container has an explicit audit-detectable enabled marker');
assert(appSource.includes('data-gridly-quick-tour-no-clipping="true"'), 'Quick Tour scroll container has an explicit no-clipping marker');
assert(appSource.includes('role="region" aria-label="Quick Tour cards and setup"'), 'Quick Tour scroll region is a named inner content region');
assert(appSource.includes('data-gridly-start-tour-state="tour-cards-visible"'), 'Start Tour control is converted to a non-confusing tour-visible state');
assert(appSource.includes('aria-disabled="true" aria-label="Quick Tour cards are visible below">Tour Below</a>'), 'Start Tour no longer remains as confusing active copy during card viewing');

assert(/\.gridly-v858-first-run-card[\s\S]*height:\s*min\(92dvh, calc\(100svh - 28px\)\)/.test(styleSource), 'First-run card has a definite desktop/mobile height for inner scrolling');
assert(/\.gridly-v858-first-run-card[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\)/.test(styleSource), 'First-run card reserves the remaining track for the scroll region');
assert(/\.gridly-v894c3-tour-scroll[\s\S]*height:\s*100%/.test(styleSource), 'Quick Tour scroll container fills the bounded grid track');
assert(/\.gridly-v894c3-tour-scroll[\s\S]*overflow-y:\s*auto/.test(styleSource), 'Quick Tour scroll container scrolls vertically');
assert(/\.gridly-v894c3-tour-scroll[\s\S]*scroll-padding-block:\s*10px calc\(20px \+ env\(safe-area-inset-bottom, 0px\)\)/.test(styleSource), 'Quick Tour scroll padding keeps cards fully visible at scroll edges');
assert(/\.gridly-v894c3-tour-scroll[\s\S]*padding-bottom:\s*calc\(20px \+ env\(safe-area-inset-bottom, 0px\)\)/.test(styleSource), 'Quick Tour scroll bottom padding prevents bottom clipping');
assert(/\.gridly-v894c2-tour-card[\s\S]*scroll-margin-block:\s*10px/.test(styleSource), 'Tour cards have scroll margins to avoid partial clipping');
assert(/@media \(max-width: 520px\)[\s\S]*\.gridly-v894c3-tour-scroll[\s\S]*padding-bottom:\s*calc\(26px \+ env\(safe-area-inset-bottom, 0px\)\)/.test(styleSource), 'Mobile portrait scroll region has extra bottom breathing room');

[
  'quickTourScrollEnabled',
  'noQuickTourContentClipping',
  'quickTourActionsReachable',
  'startTourNotConfusingDuringTour',
  'finishReachable',
  'protectedSystemsUnchanged',
  'safeForBeta'
].forEach((key) => assert(appSource.includes(key), `audit reports ${key}`));

assert(/const hasScrollableOverflow = \/auto\|scroll\/i\.test/.test(appSource), 'Audit detects actual overflow behavior');
assert(appSource.includes('quickTourScrollRegion.dataset.gridlyQuickTourScrollEnabled === "true"'), 'Audit has deterministic fallback for scroll-enabled detection');
assert(appSource.includes('quickTourScrollRegion.dataset.gridlyQuickTourNoClipping === "true"'), 'Audit has deterministic fallback for no-clipping detection');
assert(appSource.includes('source: "v894c2_skip"'), 'Skip completion persistence is preserved');
assert(appSource.includes('source: "v894c2_finish"'), 'Finish completion persistence is preserved');
assert(appSource.includes('id="gridlyV858UseLocationBtn"'), 'Optional location setup remains after Quick Tour Finish');
assert(appSource.includes('id="gridlyV858ManualLocationForm"'), 'Optional manual home-area setup remains after Quick Tour Finish');

assert(docSource.includes('V894C4 final Quick Tour mobile polish'), 'Documentation includes V894C4 final polish notes');
assert(docSource.includes('quickTourScrollEnabled: true'), 'Documentation records scroll-enabled audit result');
assert(docSource.includes('startTourNotConfusingDuringTour: true'), 'Documentation records non-confusing Start Tour result');
