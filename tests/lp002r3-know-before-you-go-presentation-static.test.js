const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');

assert(app.includes('function gridlyKnowBeforeYouGoBuildVisibleConditions'), 'presentation builds a visible evidence condition list');
assert(app.includes('sourceLabel: "Community report"'), 'community source is consumer-friendly');
assert(app.includes('National Weather Service'), 'weather source is consumer-friendly');
assert(app.includes('Official roadway information'), 'transportation source is consumer-friendly');
assert(app.includes('title: visibleConditions.length === 1 ? "Current condition"'), 'single condition uses singular current condition section');
assert(app.includes('title: "Before you leave"'), 'Story Engine recommendation is shown in Before you leave');
assert(app.includes('headlineSupportedByVisibleEvidence'), 'presentation audit exposes headline evidence support');
assert(app.includes('headlineEvidenceMismatch'), 'presentation audit exposes headline evidence mismatch');
assert(!/list\.appendChild\(confidence\)/.test(app), 'Confidence is not rendered as its own evidence section');

console.log('LP002R.3 Know Before You Go presentation static checks passed');
