const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

assert.match(app, /viewport-bucket-v924\.2/, 'viewport bucket signature uses the V924.2 stable quantized bucket version');
assert.match(app, /function buildGridlyPaddedCrossingEvaluationBounds/, 'padded evaluation bounds helper exists for safe candidate reuse');
assert.match(app, /previousCache\.evaluationBounds \|\| previousCache\.bounds/, 'incremental reuse checks cached padded evaluation bounds containment');
assert.match(app, /finalizeFromCandidates\(exactCandidates, "exact-viewport-cache"\)/, 'exact bucket hits still perform final exact viewport membership filtering');
assert.match(app, /candidateCrossings: candidateCrossings\.slice\(\)/, 'cache stores padded candidate crossings separately from final visible crossings');
assert.match(app, /paddedViewportReuse/, 'audit exposes padded viewport reuse counts');
assert.match(app, /incrementalCandidateReuse/, 'audit exposes incremental candidate reuse counts');
assert.match(app, /largePanInvalidations/, 'audit exposes large-pan invalidations');
assert.match(app, /zoomInvalidations/, 'audit exposes zoom invalidations');
assert.match(app, /finalMarkerMembershipCorrectness/, 'audit exposes final marker membership correctness');

console.log('V924.2 crossing viewport bucket reuse repair static audit passed');
