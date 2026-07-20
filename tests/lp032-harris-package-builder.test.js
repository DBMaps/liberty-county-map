const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join('scripts', 'lp032-harris-package-builder.mjs');
const source = fs.readFileSync(scriptPath, 'utf8');

assert.match(source, /COUNTY_ID = 'harris-tx'/, 'builder must be scoped to Harris only');
assert.match(source, /DEFAULT_OUTPUT = path\.resolve\(REPO, '\.\.', 'gridly-local-generated'/, 'default generated packages must be outside the application repository');
assert.match(source, /HARD_MAX_FEATURES = 45000/, 'builder must enforce the LP032.2 hard feature limit');
assert.match(source, /HARD_MAX_BYTES = 20 \* 1024 \* 1024/, 'builder must enforce the LP032.2 hard byte limit');
assert.match(source, /canonicalPackageId/, 'builder must preserve canonical ownership metadata');
assert.match(source, /stableSegmentId/, 'builder must preserve stable segment IDs');
assert.match(source, /sha256\(text\) === pkg\.sha256/, 'certification must verify package SHA-256 values');
assert.doesNotMatch(source, /fs\.(?:writeFileSync|rmSync|mkdirSync)[\s\S]{0,120}(?:data\/roadway-runtime-manifest\.json|gridlyPackageRegistry|js\/app\.js)/, 'builder must not write runtime manifests, app runtime, or package registry paths');

console.log('LP032 Harris package builder static contract passed');
