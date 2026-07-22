const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const styleSource = fs.readFileSync('css/styles.css', 'utf8');

const pages = [...appSource.matchAll(/data-gridly-onboarding-page="([^"]+)"/g)].map((match) => match[1]);
assert.deepStrictEqual(pages, ['welcome', 'awareness', 'map', 'alerts', 'report', 'settings', 'setup'], 'seven onboarding pages remain present in order');
assert(appSource.includes('data-gridly-onboarding-page-track'), 'swipe page track remains wired');
assert(appSource.includes('scroll-snap-type: x mandatory') || styleSource.includes('scroll-snap-type: x mandatory'), 'horizontal scroll snap remains active');
assert(appSource.includes('setActiveOnboardingPage(activePageIndex - 1)'), 'Back remains wired to page state');
assert(appSource.includes('setActiveOnboardingPage(activePageIndex + 1)'), 'Next remains wired to page state');
assert(appSource.includes('data-gridly-page-dot'), 'page indicator buttons remain synchronized with page state');
assert(appSource.includes('source: "v894c2_skip"'), 'Skip persists completion through existing path');
assert(appSource.includes('source: "v894c2_finish"'), 'Finish persists completion through existing path');
assert(appSource.includes('resetGridlyFirstRunWalkthroughState({ forceSetupReset: true, source: "portrait_v2_settings_replay" })'), 'Settings restart remains supported');
assert(appSource.includes('id="gridlyV858UseLocationBtn"'), 'Use My Location remains present');
assert(appSource.includes('bindGridlyV872FirstRunActivation(useLocationButton, "use-location"'), 'Use My Location remains wired to existing handler');
assert(appSource.includes('id="gridlyV858ManualLocationForm"'), 'manual setup form remains present');
assert(appSource.includes('manualForm?.addEventListener("submit"'), 'manual setup remains wired to existing handler');
for (const key of ['awareness', 'map', 'alerts', 'report', 'settings']) {
  assert(appSource.includes(`assets/onboarding/${key}-hero.png`), `${key} asset remains referenced`);
  assert(styleSource.includes(`data-gridly-visual-tour-card="${key}"`), `${key} has feature-specific focal positioning`);
}
assert(/\.gridly-v950-tour-page[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\)/.test(styleSource), 'feature pages reserve most space for the visual');
assert(/\.gridly-v950-tour-page \.gridly-v896-shot-frame[\s\S]*min-height:\s*min\(6[18]vh/.test(styleSource), 'feature visuals receive substantially more presentation space');
assert(/object-fit:\s*contain/.test(styleSource), 'feature images show the full phone without stretching');
const immersiveCss = styleSource.slice(styleSource.indexOf('/* LP050.2'));
assert(!/\.gridly-v950-feature-page[^{]*\{[^}]*overflow-y:\s*auto/.test(immersiveCss), 'feature pages do not revert to long vertical scrolling');
console.log('lp050-2-immersive-onboarding.test.js passed');
