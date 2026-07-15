const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('js/app.js', 'utf8');
const modelStart = source.indexOf('function getGridlyAlertsPresentationCountModel(alerts = [])');
const modelEnd = source.indexOf('\n  function getAlertsSurfaceSnapshot()', modelStart);
assert(modelStart > -1 && modelEnd > modelStart, 'presentation count model source is present');
const modelSource = source.slice(modelStart, modelEnd);

[
  'input normalization',
  'alert filtering',
  'event-grouping pass: source iteration',
  'getAlertClusterKey loop',
  'cluster-map construction',
  'cluster member normalization',
  'representative alert selection',
  'priority calculation',
  'ranking/sorting',
  'community-row extraction',
  'presentation-record construction',
  'trust model attachment',
  'location model attachment',
  'awareness-area resolution',
  'canonical presentation helper',
  'final model assembly'
].forEach((phase) => {
  assert(modelSource.includes(`"${phase}"`), `direct model instrumentation includes ${phase}`);
});

[
  'ownerClassification',
  'sourceLocation',
  'readsDesktopDom',
  'writesDesktopDom',
  'readsLegacyState',
  'mobileRequired',
  'inputCount',
  'outputCount'
].forEach((field) => {
  assert(source.includes(field), `nested call records include ${field}`);
});

assert(source.includes('nestedInstrumentationCapturePass'), 'audit exposes nestedInstrumentationCapturePass');
assert(source.includes('nestedDurationCoveragePercent'), 'audit exposes nestedDurationCoveragePercent');
assert(source.includes('Alerts presentation call graph was not captured.'), 'empty call graph blocks authoritative result');
assert(source.includes('safeToBeginLegacyRemoval: blockingFindings.length === 0 && nestedInstrumentationCapturePass'), 'legacy removal is gated on capture pass');
assert(source.includes('latestColdRun'), 'audit preserves latest cold run');
assert(source.includes('latestWarmRun'), 'audit preserves latest warm run');
