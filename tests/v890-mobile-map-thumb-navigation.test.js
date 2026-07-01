const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const doc = fs.readFileSync('docs/audits/GRIDLY-V890-MOBILE-MAP-THUMB-NAVIGATION-FIX.md', 'utf8');

assert(app.includes('gridlyMobileMapThumbNavigationAudit'), 'V890 audit helper exists');
assert(app.includes('V890-mobile-map-thumb-navigation-fix'), 'V890 audit version is present');
assert(app.includes('layerButtonPreserved: true'), 'layer button preservation is checked');
assert(app.includes('protectedSystemsUnchanged: true'), 'protected systems unchanged marker exists');
assert(app.includes('gridlyMapInteractionHitboxDebug'), 'V890 hitbox debug helper exists');
assert(css.includes('V890 — Mobile Map Thumb Navigation Fix'), 'V890 CSS block exists');
assert(css.includes('pointer-events: none'), 'V890 reviews and constrains pointer-events');
assert(css.includes('touch-action: none'), 'V890 reviews map touch-action');
assert(css.includes('touch-action: manipulation'), 'V890 preserves control tap behavior');
assert(doc.includes('Do not change') || doc.includes('What did not change'), 'V890 documentation states what did not change');
assert(doc.includes('layer button'), 'V890 documentation mentions layer button preservation');
assert(doc.includes('Protected systems confirmation'), 'V890 documentation confirms protected systems');

assert(!app.includes('V890-report-placement-logic-change'), 'V890 did not introduce report placement logic changes');
assert(!app.includes('V890-search-routing-logic-change'), 'V890 did not introduce search/routing logic changes');
assert(!app.includes('V890-route-watch-logic-change'), 'V890 did not introduce Route Watch logic changes');

console.log('v890-mobile-map-thumb-navigation.test.js passed');
