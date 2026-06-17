const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

assert.match(appSource, /const gridlyHistoricalCanaryRuntime = \{[\s\S]*?active: false,/, 'historical canary runtime remains dormant by default');
assert.match(appSource, /window\.gridlyStartHistoricalCanary = gridlyStartHistoricalCanary;/, 'manual canary start control remains exposed');
assert.doesNotMatch(appSource, /gridlyStartHistoricalCanary\(\);/, 'historical canary is not auto-started');
assert.match(appSource, /writerEnabled: canaryActive/, 'writer is enabled only while the manually started canary is active');

console.log('historyCaptureCanaryControlsStatic.test.js passed');
