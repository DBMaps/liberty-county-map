const fs = require('fs');
const assert = require('assert');

const indexSource = fs.readFileSync('index.html', 'utf8');
const styleSource = fs.readFileSync('css/styles.css', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');
const auditSource = fs.readFileSync('docs/audits/GRIDLY-V898-BETA-PRESENTATION-REFINEMENT.md', 'utf8');

for (const phrase of [
  'Local awareness',
  'Crossings: getting local status…',
  'Live updates: connecting…',
  'Help nearby drivers',
  'What drivers are seeing nearby',
  'Quick Report',
  'Alert Details'
]) {
  assert(indexSource.includes(phrase) || appSource.includes(phrase), `V898 presentation includes ${phrase}`);
}

assert(styleSource.includes('V898 — Beta presentation refinement'), 'V898 CSS presentation refinement block exists');
assert(styleSource.includes('body[data-layout-mode="portrait"] .future-map-hero'), 'V898 portrait route-first suppression exists');
assert(auditSource.includes('Protected-system verification'), 'V898 audit documents protected-system verification');
assert(auditSource.includes('Recommendation: Merge for controlled beta'), 'V898 audit includes beta readiness recommendation');

console.log('v898-beta-presentation-refinement.test.js passed');
