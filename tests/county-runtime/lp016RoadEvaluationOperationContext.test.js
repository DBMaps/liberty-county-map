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

const operationBody = bodyOf('buildGridlyRoadEvaluationOperationContext');
const contextBody = bodyOf('buildGridlyRoadEvaluationContext');
const activeCountyBody = bodyOf('gridlyGetActiveCountyId');
const displayBody = bodyOf('gridlyGetCountyDisplayContext');
const nearestBody = bodyOf('resolveNearestRoadName');
const collectBody = bodyOf('collectNearbyRoadCandidates');
const statusBody = bodyOf('gridlyLp016BuildSelectedAreaLoopStatus');
const callerAuditBody = bodyOf('gridlyLp016SelectedAreaCallerAudit');

assert(operationBody.includes('roadEvaluationOperationCount'), 'road-evaluation operations are counted once per logical lookup');
assert(operationBody.includes('const selectedAwarenessArea = typeof getGridlySelectedAwarenessArea === "function" ? getGridlySelectedAwarenessArea() : null;'), 'operation context resolves selected awareness once');
assert(operationBody.includes('gridlyGetActiveCountyId(selectedAwarenessArea)'), 'operation context resolves active county with pre-resolved awareness');
assert(operationBody.includes('gridlyGetCountyDisplayContext({}, { selectedAwarenessArea, activeCountyId, countyId: activeCountyId })'), 'operation context resolves county display context with pre-resolved awareness/county');
assert(operationBody.includes('return buildGridlyRoadEvaluationContext({ selectedAwarenessArea, activeCountyId, countyDisplayContext });'), 'operation context builds one immutable road evaluation context');

assert(source.includes('function gridlyGetActiveCountyId(preResolvedAwarenessArea)'), 'active county helper accepts optional pre-resolved awareness');
assert(activeCountyBody.includes('if (preResolvedAwarenessArea?.countyId) return gridlyNormalizeCountyId(preResolvedAwarenessArea.countyId);'), 'active county helper avoids selected-awareness getter when supplied');
assert(displayBody.includes('options.selectedAwarenessArea'), 'county display helper accepts pre-resolved selected awareness');
assert(displayBody.includes('options.activeCountyId'), 'county display helper accepts pre-resolved active county');

assert(nearestBody.includes('const roadEvaluationContext = buildGridlyRoadEvaluationOperationContext();'), 'nearest-road operation builds operation-scoped context once after cache miss');
assert(collectBody.includes('const evaluationContext = roadEvaluationContext || buildGridlyRoadEvaluationContext();'), 'candidate loop reuses a supplied context and only falls back for older callers');
assert(!collectBody.includes('getGridlySelectedAwarenessArea('), 'candidate loop does not resolve selected awareness per candidate');
assert(!collectBody.includes('gridlyGetActiveCountyId('), 'candidate loop does not resolve active county per candidate');

assert(statusBody.includes('roadEvaluationContextHoisted'), 'audit computes road evaluation context hoist status');
assert(statusBody.includes('roadContextBuildsPerCandidate'), 'audit reports context builds per candidate');
assert(statusBody.includes('roadEvaluationContextHoisted &&'), 'hot-loop eliminated remains false when context builds stay per candidate');
assert(callerAuditBody.includes('roadEvaluationOperationCount: status.roadEvaluationOperationCount'), 'caller audit reports operation count');
assert(callerAuditBody.includes('roadEvaluationContextHoisted: status.roadEvaluationContextHoisted'), 'caller audit reports hoist status');

assert(![operationBody, contextBody, activeCountyBody, displayBody].some((body) => /Dayton|Liberty County|dayton/i.test(body)), 'road operation context repair has no hardcoded locality labels');
assert(operationBody.includes('selectedAwarenessArea') && operationBody.includes('activeCountyId') && operationBody.includes('countyDisplayContext'), 'community, county-wide, and future selections flow from dynamic registry-aware objects');

console.log('LP016 road evaluation operation-context static checks passed');
