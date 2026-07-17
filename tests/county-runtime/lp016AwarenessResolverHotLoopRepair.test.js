const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'app.js'), 'utf8');

function includes(needle, message) {
  assert(source.includes(needle), message);
}

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

includes('const gridlySelectedAwarenessAreaResolutionCache = {', 'selected awareness resolution cache exists');
includes('function invalidateGridlySelectedAwarenessAreaResolutionCache(reason = "unknown")', 'selected awareness cache invalidator exists');

const selectedBody = bodyOf('getGridlySelectedAwarenessArea');
assert(selectedBody.includes('gridlySelectedAwarenessAreaResolutionCache.signature'), 'selected-area getter uses the cache signature');
assert(selectedBody.includes('gridlySelectedAwarenessAreaResolutionCache.cacheHits += 1'), 'selected-area getter records cache hits');
assert(selectedBody.includes('const area = resolveGridlyAwarenessArea(requestedTown);'), 'selected-area getter still resolves the requested town through canonical resolver on miss');
assert(!selectedBody.includes('getGridlyHomeTownPreference()'), 'selected-area getter avoids the prior normalize-then-resolve duplicate resolver path');

const saveBody = bodyOf('saveGridlyHomeTownPreference');
assert(saveBody.includes('invalidateGridlySelectedAwarenessAreaResolutionCache?.("saveGridlyHomeTownPreference:start")'), 'save path invalidates selected-area cache before resolving changed input');
assert(saveBody.includes('invalidateGridlySelectedAwarenessAreaResolutionCache?.("saveGridlyHomeTownPreference:complete")'), 'save path invalidates selected-area cache after persisted awareness inputs change');

const repairAuditBody = bodyOf('gridlyLp016AwarenessResolverHotLoopRepairAudit');
assert(repairAuditBody.includes('startupResolverCallCount'), 'repair audit reports startup resolver call count');
assert(repairAuditBody.includes('hotLoopEliminated'), 'repair audit reports hot-loop elimination');
assert(repairAuditBody.includes('awarenessSelectionPreserved'), 'repair audit verifies awareness selection preservation');
assert(repairAuditBody.includes('auditInstrumentationInflationDetected'), 'repair audit reports instrumentation recursion/inflation status');
assert(repairAuditBody.includes('protectedSystemsPreserved'), 'repair audit reports protected systems preservation');
includes('window.gridlyLp016AwarenessResolverHotLoopRepairAudit = gridlyLp016AwarenessResolverHotLoopRepairAudit', 'repair audit is exposed for browser validation');

console.log('LP016 awareness resolver hot-loop repair static checks passed');
