const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const doc = fs.readFileSync('docs/audits/GRIDLY-V890R-ANDROID-PORTRAIT-MAP-BREATHING-ROOM.md', 'utf8');

assert(app.includes('gridlyAndroidMapBreathingRoomAudit'), 'V890R audit helper exists');
assert(app.includes('V890R-android-portrait-map-breathing-room'), 'V890R audit version is present');
assert(css.includes('V890R — Android Portrait Map Breathing Room'), 'V890R CSS block exists');
assert(css.includes('100dvh') && css.includes('100svh'), 'dynamic viewport unit fallbacks exist');
assert(css.includes('--gridly-v890r-map-min-height'), 'mobile portrait map min-height token exists');
assert(css.includes('V890 — Mobile Map Thumb Navigation Fix'), 'V890 preservation CSS marker exists');
assert(app.includes('v890ThumbNavigationPreserved: true'), 'V890 thumb navigation preservation marker exists');
assert(app.includes('protectedSystemsUnchanged: true'), 'protected systems unchanged marker exists');
assert(app.includes('layerButtonPreserved: true'), 'layer button preservation marker exists');
assert(doc.includes('Protected systems confirmation'), 'documentation confirms protected systems');
assert(doc.includes('Android validation checklist'), 'documentation includes Android validation checklist');

console.log('v890r-android-portrait-map-breathing-room.test.js passed');
