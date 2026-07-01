const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/audits/GRIDLY-V890R1-ROUTE-PANEL-ENCODING-ARTIFACT-GUARD.md', 'utf8');

assert(app.includes('gridlyRoutePanelEncodingArtifactAudit'), 'V890R.1 audit helper exists');
assert(app.includes('V890R.1-route-panel-encoding-artifact-guard'), 'V890R.1 audit version is present');
assert(app.includes('cleanupGridlyDisplayEncodingArtifacts'), 'display artifact cleanup helper exists');
assert(app.includes('gridlyTextContainsKnownEncodingArtifact'), 'known artifact static scanner helper exists');
assert(app.includes('routePanelReviewed: true'), 'route panel review marker exists');
assert(app.includes('displayTextSanitizerAvailable'), 'display sanitizer availability marker exists');
assert(app.includes('knownArtifactsSuppressed'), 'known artifact suppression marker exists');
assert(app.includes('routeLogicUnchanged: true'), 'route logic unchanged marker exists');
assert(app.includes('routeWatchLogicUnchanged: true'), 'Route Watch logic unchanged marker exists');
assert(app.includes('protectedSystemsUnchanged: true'), 'protected systems unchanged marker exists');
assert(app.includes('let text = cleanupGridlyDisplayEncodingArtifacts(value);'), 'user-facing road text normalization uses artifact cleanup');
assert(app.includes('return cleanupGridlyDisplayEncodingArtifacts(value)'), 'HTML text sanitization uses artifact cleanup before escaping');

assert(doc.includes('Problem'), 'documentation includes problem section');
assert(doc.includes('Suspected cause'), 'documentation includes suspected cause section');
assert(doc.includes('What changed'), 'documentation includes what changed section');
assert(doc.includes('What did not change'), 'documentation includes what did not change section');
assert(doc.includes('Protected systems confirmation'), 'documentation includes protected systems confirmation');
assert(doc.includes('Route panel validation checklist'), 'documentation includes route panel validation checklist');
assert(doc.includes('Known artifact patterns'), 'documentation includes known artifact patterns');
assert(doc.includes('Remaining risks'), 'documentation includes remaining risks');

assert(!app.includes('V890R.1-route-logic-change'), 'V890R.1 did not introduce route logic changes');
assert(!app.includes('V890R.1-route-watch-logic-change'), 'V890R.1 did not introduce Route Watch logic changes');
assert(!app.includes('V890R.1-map-rendering-change'), 'V890R.1 did not introduce map rendering changes');

console.log('v890r1-route-panel-encoding-artifact-guard.test.js passed');
