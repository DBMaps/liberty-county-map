const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const timers = [];
const context = {
  console,
  performance: { now: () => Date.now() },
  setTimeout(callback) { timers.push(callback); return timers.length; },
  requestAnimationFrame(callback) { timers.push(callback); return timers.length; },
  gridlyRenderTravelBrief() { context.travelBriefRenders = (context.travelBriefRenders || 0) + 1; },
  gridlyBriefInteractionRender() { context.currentConditionsRenders = (context.currentConditionsRenders || 0) + 1; },
  gridlyUnifiedIntelligencePrototype: { runtime() { context.unifiedRuns = (context.unifiedRuns || 0) + 1; } },
  refreshGridlyCommunityPulseSharedModel() { context.communityPulseRefreshes = (context.communityPulseRefreshes || 0) + 1; },
  refreshPortraitV2LocalizedIntelligence() { context.broadPortraitRefreshes = (context.broadPortraitRefreshes || 0) + 1; }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/gridlyOfficialProviderActivation.js', 'utf8'), context, { filename: 'js/gridlyOfficialProviderActivation.js' });

function drainTimers() {
  while (timers.length) timers.shift()();
}

drainTimers();

context.gridlyOfficialProviderConsumerRefresh({ providerId: 'weather', signature: 'weather:0:[]', evidenceChanged: true, reason: 'initial-zero-weather' });
drainTimers();
const afterInitial = context.currentConditionsRenders;

context.gridlyOfficialProviderConsumerRefresh({ providerId: 'weather', signature: 'weather:0:[]', evidenceChanged: false, reason: 'unchanged-zero-weather' });
drainTimers();
assert.strictEqual(context.currentConditionsRenders, afterInitial, 'unchanged zero Weather signature skips Current Conditions rerender');
assert.strictEqual(context.gridlyOfficialProviderActivationAudit().consumerRefreshSkippedUnchanged, true, 'unchanged provider evidence is recorded as skipped');
assert.strictEqual(context.broadPortraitRefreshes || 0, 0, 'official-provider coordinator does not invoke broad portrait refresh');

context.gridlyOfficialProviderConsumerRefresh({ providerId: 'drivetexas', signature: 'drivetexas:1:[{"id":"us90"}]', evidenceChanged: true, reason: 'drivetexas-changed' });
context.gridlyOfficialProviderConsumerRefresh({ providerId: 'weather', signature: 'weather:1:[{"id":"storm"}]', evidenceChanged: true, reason: 'weather-changed' });
assert.strictEqual(context.gridlyOfficialProviderActivationAudit().duplicateConsumerRefreshPrevented, true, 'near-simultaneous provider changes are coalesced');
drainTimers();

const audit = context.gridlyOfficialProviderActivationAudit();
assert.strictEqual(audit.lastDriveTexasSignature, undefined, 'audit does not expose raw DriveTexas provider signatures');
assert.strictEqual(audit.lastWeatherSignature, undefined, 'audit does not expose raw Weather provider signatures');
assert.match(audit.lastDriveTexasSignatureHash, /^fnv1a32:[0-9a-f]{8}$/, 'audit exposes only a compact DriveTexas signature hash');
assert.match(audit.lastWeatherSignatureHash, /^fnv1a32:[0-9a-f]{8}$/, 'audit exposes only a compact Weather signature hash');
assert.strictEqual(audit.driveTexasRecordCount, 1, 'audit exposes safe DriveTexas record count');
assert.strictEqual(audit.weatherRecordCount, 1, 'audit exposes safe Weather record count');
assert.strictEqual(JSON.stringify(audit).includes('us90'), false, 'audit omits DriveTexas record IDs');
assert.strictEqual(JSON.stringify(audit).includes('storm'), false, 'audit omits Weather record IDs');
assert.strictEqual(audit.broadPortraitRefreshInvoked, false, 'diagnostics record no broad portrait invocation');
assert.strictEqual(audit.consumerRefreshCoalesced, true, 'coalesced narrow refresh is recorded');
assert.strictEqual(typeof audit.lastConsumerRefreshDurationMs, 'number', 'narrow consumer refresh duration is measured');
assert.strictEqual(context.broadPortraitRefreshes || 0, 0, 'broad portrait refresh remains unused after changed evidence');

console.log(JSON.stringify({ ok: true, audit }, null, 2));
