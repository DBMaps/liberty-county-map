const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'app.js'), 'utf8');

function bodyOf(functionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  assert.notStrictEqual(start, -1, `${functionName} exists`);
  const bodyStart = source.indexOf('{', source.indexOf(')', start));
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  throw new Error(`Unable to parse ${functionName}`);
}

const cacheLiteral = source.slice(source.indexOf('const gridlySelectedAwarenessAreaResolutionCache = {'), source.indexOf('};\nif (typeof window !== "undefined") window.gridlySelectedAwarenessAreaResolutionCache'));
const getterBody = bodyOf('getGridlySelectedAwarenessArea');
const resolverBody = bodyOf('resolveGridlyAwarenessArea');
const statusBody = bodyOf('gridlyLp016BuildSelectedAreaLoopStatus');
const callerAuditBody = bodyOf('gridlyLp016SelectedAreaCallerAudit');
const samplerBody = bodyOf('gridlyRecordSelectedAwarenessAreaGetterCaller');
const activeCountyBody = bodyOf('gridlyGetActiveCountyId');
const driveTexasSource = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'gridlyDriveTexasLiveConnector.js'), 'utf8');

assert(resolverBody.includes('actualResolverMisses = Number(gridlySelectedAwarenessAreaResolutionCache.actualResolverMisses || 0) + 1'), 'canonical uncached resolver increments actual resolver misses');
assert(resolverBody.includes('underlyingResolverCalls = Number(gridlySelectedAwarenessAreaResolutionCache.actualResolverMisses || 0)'), 'underlyingResolverCalls mirrors actual resolver misses');
assert(!getterBody.includes('underlyingResolverCalls = Number(gridlySelectedAwarenessAreaResolutionCache.underlyingResolverCalls || 0) + 1'), 'selected-area getter does not increment underlyingResolverCalls on entry, hit, or return');
assert(getterBody.includes('gridlySelectedAwarenessAreaResolutionCache.resolverCalls = Number(gridlySelectedAwarenessAreaResolutionCache.underlyingResolverCalls || 0);'), 'getter preserves resolverCalls as canonical resolver count after a miss');
assert(statusBody.includes('const actualResolverMisses = Math.max(0, totalGetterCalls - cacheHits);'), 'status derives actual misses from total getter calls minus cache hits');
assert(statusBody.includes('underlyingResolverCalls === actualResolverMisses'), 'counter consistency requires underlying resolver calls to equal actual cache misses');
assert(statusBody.includes('resolverCalls === underlyingResolverCalls'), 'counter consistency rejects alias/canonical double counting');
assert(statusBody.includes('roadContextBuildCountMatchesOperations'), 'getter volume bounded is derived from operation-scoped road-context evidence instead of cumulative getter volume');
assert(statusBody.includes('const safeForMerge = Boolean(hotLoopEliminated && awarenessSwitchSafe);'), 'safeForMerge requires hot-loop elimination and awareness-switch safety');
assert(statusBody.includes('remainingCallsExplainedReason'), 'hot-loop success includes a reason explaining runtime counter reconciliation');
assert(statusBody.includes('driveTexasAwarenessLookupHoisted &&'), 'hot-loop success still requires DriveTexas operation-scoped hoist');
assert(callerAuditBody.includes('safeForBrowserValidation: awarenessSelectionPreserved && status.instrumentationDistortionRemoved'), 'browser validation safety is separate from merge safety');
assert(callerAuditBody.includes('const underlyingResolverCalls = Math.max(0, totalGetterCalls - cacheHits);'), 'caller audit exposes the authoritative cache-miss resolver count');
assert(callerAuditBody.includes('roadContextBuildCounterConsistencyValid: status.roadContextBuildCounterConsistencyValid'), 'caller audit exposes build-caller counter consistency');
assert(callerAuditBody.includes('invalidRoadLabelContextAudit: status.invalidRoadLabelContextAudit'), 'caller audit exposes invalid road label context counters');
assert(callerAuditBody.includes('resolverCalls: status.resolverCalls'), 'caller audit exposes canonical resolverCalls alias');
assert(samplerBody.includes('callNumber % GRIDLY_LP016_SELECTED_AREA_CALLER_PERIODIC_INTERVAL === 0'), 'periodic sampling captures calls beyond the initial sample');
assert(samplerBody.includes('cache.sampledStackCount >= GRIDLY_LP016_SELECTED_AREA_CALLER_SAMPLE_LIMIT'), 'stack sampling remains bounded');
assert(cacheLiteral.includes('callsByInstrumentedCallSite'), 'deterministic call-site attribution counters are stored');
assert(activeCountyBody.includes('gridlyRecordSelectedAwarenessInstrumentedCallSite("gridlyGetActiveCountyId", "js/app.js:gridlyGetActiveCountyId")'), 'gridlyGetActiveCountyId has a lightweight full-run call-site counter');
assert(driveTexasSource.includes('function matchesAwarenessArea(record, awareness)'), 'DriveTexas matcher accepts operation-scoped awareness');
assert(!bodyOfFromSource(driveTexasSource, 'matchesAwarenessArea').includes('getGridlySelectedAwarenessArea('), 'DriveTexas matcher does not restore per-record selected-area lookups');
assert(bodyOfFromSource(driveTexasSource, 'filterAwarenessRecords').includes('const awareness = activeAwarenessArea();'), 'DriveTexas filter resolves awareness once per operation');
assert(![statusBody, callerAuditBody, samplerBody, activeCountyBody].some((body) => /Dayton|Liberty County|liberty-tx|dayton/i.test(body)), 'new LP016 audit/caller instrumentation does not hardcode a county or community');

function bodyOfFromSource(text, functionName) {
  const marker = `function ${functionName}`;
  const start = text.indexOf(marker);
  assert.notStrictEqual(start, -1, `${functionName} exists`);
  const bodyStart = text.indexOf('{', text.indexOf(')', start));
  let depth = 0;
  for (let index = bodyStart; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return text.slice(bodyStart + 1, index);
  }
  throw new Error(`Unable to parse ${functionName}`);
}

console.log('LP016 selected-area audit truthfulness checks passed');
