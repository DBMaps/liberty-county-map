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

const countSyncBody = bodyOf('gridlyAwarenessAlertsCountSyncAudit');
assert(countSyncBody.includes('const selectedAwarenessAreaForCountSync = typeof getGridlySelectedAwarenessArea === "function" ? getGridlySelectedAwarenessArea() : null;'), 'count sync audit resolves selected awareness area once before reading fields');
assert(!countSyncBody.includes('getGridlySelectedAwarenessArea()?.label || getGridlySelectedAwarenessArea()?.storageValue'), 'count sync audit does not call the selected-area getter twice in one logical lookup');

const callerAuditBody = bodyOf('gridlyLp016SelectedAreaCallerAudit');
assert(callerAuditBody.includes('totalGetterCalls'), 'caller census exposes total getter calls');
assert(callerAuditBody.includes('callsByActualCaller'), 'caller census exposes sampled actual direct callers');
assert(callerAuditBody.includes('sampledStackCount'), 'caller census exposes the bounded stack sample count');
assert(callerAuditBody.includes('topActualCallerPercentage'), 'caller census reports the dominant caller percentage from sampled stacks');
assert(callerAuditBody.includes('doubleCountingDetected'), 'caller census reconciles double counting');
assert(callerAuditBody.includes('instrumentationDistortionRemoved'), 'caller census reports whether resolver wrapper distortion has been removed');
assert(callerAuditBody.includes('safeForPatch'), 'caller census only marks the result safe for patch after a dominant direct caller is proven');
assert(source.includes('window.gridlyLp016SelectedAreaCallerAudit = gridlyLp016SelectedAreaCallerAudit'), 'caller census is exposed for browser validation');

const resolverBody = bodyOf('resolveGridlyAwarenessArea');
assert(!resolverBody.includes('gridlyLp016AlertsPostPaintDelayMeasure("resolveGridlyAwarenessArea"'), 'canonical resolver is no longer wrapped by the post-paint timing audit');

const selectedBody = bodyOf('getGridlySelectedAwarenessArea');
assert(selectedBody.includes('gridlyRecordSelectedAwarenessAreaGetterCaller();'), 'selected-area getter records a bounded actual caller census directly');

console.log('LP016 selected-area caller hoist static checks passed');
