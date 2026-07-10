const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const required = [
  ['rendered sample path', 'if (rendered) gridlyV926PushSample("communityPulse", duration'],
  ['reuse-only valid path', 'reuseOutcomeCount ? "reused_unchanged"'],
  ['production path not triggered classification', 'production_path_not_triggered'],
  ['rendered work with missing timing can regress', 'community pulse measurement outcome missing'],
  ['stale run rejection guard', 'if (!gridlyV926CaptureState.runId) return false'],
  ['asynchronous completion timeout remains bounded', 'completion_signal_timeout'],
  ['reset clears Community Pulse state', 'gridlyV927ResetCommunityPulseState()'],
  ['null P50/P95 allowed through percentile empty result', 'if (!samples.length) return null'],
  ['production function traced', 'productionFunctionName: event.productionFunctionName || "refreshPortraitV2LocalizedIntelligence"'],
  ['no fake reuse timing', 'durationMs: rendered ? gridlyV925Round(duration) : null']
];
for (const [name, snippet] of required) assert(app.includes(snippet), name);
assert(!/gridlyV926PushSample\("communityPulse",\s*0/.test(app), 'Community Pulse samples are never forced to zero');
console.log('V927 focused Community Pulse measurement static test passed');
