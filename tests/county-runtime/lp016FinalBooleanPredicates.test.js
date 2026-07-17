const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'app.js'), 'utf8');

function functionText(functionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  assert.notStrictEqual(start, -1, `${functionName} exists`);
  const bodyStart = source.indexOf('{', source.indexOf(')', start));
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to parse ${functionName}`);
}

const gridlyLp016AuditCounterMap = (sourceMap = {}) => Object.freeze(Object.entries(sourceMap || {}).reduce((memo, [key, value]) => {
  memo[key] = Number(value || 0);
  return memo;
}, {}));

const gridlyLp016TopCounterEntry = (counterMap = {}) => {
  const entry = Object.entries(counterMap || {}).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0] || null;
  return entry ? { name: entry[0], count: Number(entry[1] || 0) } : { name: null, count: 0 };
};

function buildStatus(cache, options = {}) {
  const fn = new Function(
    'gridlyLp016AuditCounterMap',
    'gridlyLp016TopCounterEntry',
    'gridlyLp016AwarenessSwitchRefreshAudit',
    `return (${functionText('gridlyLp016BuildSelectedAreaLoopStatus')});`
  )(
    gridlyLp016AuditCounterMap,
    gridlyLp016TopCounterEntry,
    () => ({ safeAwarenessSwitch: true })
  );
  return fn(cache, { instrumentationDistortionRemoved: true, protectedSystemsPreserved: true, ...options });
}

function cacheFor(overrides = {}) {
  const contextBuilds = Number(overrides.roadEvaluationContextBuildCount ?? 5);
  return {
    totalGetterCalls: 1061,
    cacheHits: 1060,
    driveTexasFilterOperationCount: 1,
    driveTexasPerRecordAwarenessLookupCount: 0,
    roadEvaluationOperationCount: 4,
    roadCandidateCount: 0,
    roadEvaluationContextBuildCount: contextBuilds,
    roadContextBuildsByCallSite: {
      buildGridlyRoadEvaluationOperationContext: Math.min(4, contextBuilds),
      legacyFallback: Math.max(0, contextBuilds - Math.min(4, contextBuilds))
    },
    roadEvaluationUnexpectedFallbackCount: 0,
    roadEvaluationFallbackContextBuildCount: 1,
    invalidRoadLabelUnexpectedRebuildCount: 0,
    invalidRoadLabelIgnoredContextCount: 0,
    ...overrides
  };
}

const boundedWithFallback = buildStatus(cacheFor({
  roadEvaluationOperationCount: 4,
  roadEvaluationContextBuildCount: 5,
  roadEvaluationFallbackContextBuildCount: 1
}));
assert.strictEqual(boundedWithFallback.getterVolumeBounded, true, '4 operations plus 1 allowed fallback bounds 5 context builds');
assert.strictEqual(boundedWithFallback.roadContextBuildsPerCandidate, 0, 'zero-candidate run reports zero context builds per candidate');
assert.strictEqual(boundedWithFallback.remainingHotLoopDetected, false, 'zero direct failure counters produce no remaining hot loop');
assert.strictEqual(boundedWithFallback.hotLoopEliminated, true, 'passing LP016 invariants eliminate the hot loop');
assert.strictEqual(boundedWithFallback.safeForMerge, true, 'passing LP016 invariants and safe awareness switch are merge-safe');
assert.match(boundedWithFallback.getterVolumeBoundedReason, /^Road-context builds are bounded:/, 'bounded getter-volume reason agrees with true boolean');
assert.match(boundedWithFallback.remainingHotLoopReason, /^No remaining hot-loop evidence:/, 'remaining hot-loop reason agrees with false boolean');
assert.strictEqual(boundedWithFallback.hotLoopEliminatedReason, 'LP016 hot-loop invariants pass.', 'hot-loop eliminated reason agrees with true boolean');
assert.strictEqual(boundedWithFallback.safeForMergeReason, 'LP016 runtime invariants pass and the awareness switch completed safely.', 'safe-for-merge reason agrees with true boolean');

const overBounded = buildStatus(cacheFor({
  roadEvaluationOperationCount: 4,
  roadEvaluationContextBuildCount: 6,
  roadEvaluationFallbackContextBuildCount: 1,
  roadContextBuildsByCallSite: {
    buildGridlyRoadEvaluationOperationContext: 4,
    legacyFallback: 2
  }
}));
assert.strictEqual(overBounded.getterVolumeBounded, false, '4 operations plus 1 allowed fallback does not bound 6 context builds');
assert.strictEqual(overBounded.remainingHotLoopDetected, true, 'over-budget context builds are direct hot-loop evidence');
assert.match(overBounded.getterVolumeBoundedReason, /^Road-context evidence is not bounded:/, 'unbounded getter-volume reason agrees with false boolean');

const zeroCandidate = buildStatus(cacheFor({ roadCandidateCount: 0, roadEvaluationContextBuildCount: 5 }));
assert.strictEqual(zeroCandidate.roadContextBuildsPerCandidate, 0, 'candidateCount=0 keeps buildsPerCandidate at 0');
assert.strictEqual(zeroCandidate.getterVolumeBounded, true, 'candidateCount=0 and buildsPerCandidate=0 do not fail boundedness');
assert.strictEqual(zeroCandidate.remainingHotLoopDetected, false, 'candidateCount=0 and buildsPerCandidate=0 do not create hot-loop evidence');

const unexpectedFallback = buildStatus(cacheFor({
  roadEvaluationUnexpectedFallbackCount: 1,
  invalidRoadLabelUnexpectedRebuildCount: 1
}));
assert.strictEqual(unexpectedFallback.remainingHotLoopDetected, true, 'one unexpected fallback is direct hot-loop evidence');
assert.match(unexpectedFallback.remainingHotLoopReason, /^Hot-loop evidence remains:/, 'unexpected fallback reason agrees with true boolean');

console.log('LP016 final boolean predicate checks passed');
