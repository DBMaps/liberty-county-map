const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'app.js'), 'utf8');

function bodyOf(functionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  assert.notStrictEqual(start, -1, `${functionName} exists`);
  const signatureEnd = source.indexOf(') {', start);
  const bodyStart = source.indexOf('{', signatureEnd);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  throw new Error(`Unable to parse ${functionName}`);
}

const contextBody = bodyOf('buildGridlyRoadEvaluationContext');
assert(contextBody.includes('selectedAwarenessArea'), 'road evaluation context carries selected awareness area');
assert(contextBody.includes('activeCountyId'), 'road evaluation context carries active county id');
assert(contextBody.includes('normalizedAwarenessAreaLookup'), 'road evaluation context carries normalized awareness lookup');
assert(contextBody.includes('invalidCountyAwareRoadLabelPattern'), 'road evaluation context carries invalid-label pattern');

const collectBody = bodyOf('collectNearbyRoadCandidates');
assert(collectBody.includes('const evaluationContext = roadEvaluationContext || buildGridlyRoadEvaluationContext();'), 'collectNearbyRoadCandidates resolves road evaluation context once before looping');
assert(collectBody.includes('evaluateRoadNameCandidate(value, evaluationContext)'), 'collectNearbyRoadCandidates reuses the same context for candidate evaluation');
assert(!collectBody.includes('gridlyGetActiveCountyId('), 'collectNearbyRoadCandidates does not resolve active county per candidate');
assert(!collectBody.includes('getGridlySelectedAwarenessArea('), 'collectNearbyRoadCandidates does not resolve selected awareness area per candidate');
assert(!collectBody.includes('normalizeGridlyAwarenessAreaLookupText('), 'collectNearbyRoadCandidates reuses normalized awareness lookup rather than normalizing in the loop');

const evaluateSignature = source.slice(source.indexOf('function evaluateRoadNameCandidate'), source.indexOf('{', source.indexOf('function evaluateRoadNameCandidate')));
const evaluateBody = bodyOf('evaluateRoadNameCandidate');
assert(evaluateSignature.includes('roadEvaluationContext = null'), 'evaluateRoadNameCandidate accepts an optional context for backward compatibility');
assert(evaluateBody.includes('gridlyIsInvalidCountyAwareRoadLabel(normalized, roadEvaluationContext)'), 'evaluateRoadNameCandidate passes context into county-aware invalid-label guard');

const invalidSignature = source.slice(source.indexOf('function gridlyIsInvalidCountyAwareRoadLabel'), source.indexOf('{', source.indexOf('function gridlyIsInvalidCountyAwareRoadLabel')));
const invalidBody = bodyOf('gridlyIsInvalidCountyAwareRoadLabel');
assert(invalidSignature.includes('roadEvaluationContext = null'), 'county-aware invalid-label guard accepts optional context');
assert(invalidBody.includes('roadEvaluationContext || buildGridlyRoadEvaluationContext()'), 'county-aware invalid-label guard preserves fallback behavior for older call sites');
assert(invalidBody.includes('activeCountyName && text === activeCountyName'), 'county-aware invalid-label guard still blocks active county names as road labels');

const pairBody = bodyOf('resolveNearbyRoadPair');
assert(pairBody.includes('const evaluationContext = roadEvaluationContext || buildGridlyRoadEvaluationContext();'), 'resolveNearbyRoadPair resolves context once for the lookup');
assert(pairBody.includes('collectNearbyRoadCandidates(coords.lat, coords.lng, 0.45, 8, evaluationContext)'), 'hot nearby-pair lookup passes the hoisted context into the candidate loop');

const nearestBody = bodyOf('resolveNearestRoadName');
assert(nearestBody.includes('const roadEvaluationContext = buildGridlyRoadEvaluationOperationContext();'), 'resolveNearestRoadName builds one road evaluation context per road lookup');
assert(nearestBody.includes('resolveNearbyRoadPair(coords.lat, coords.lng, selectedSegment.normalized, roadEvaluationContext)'), 'nearest-road segment path reuses the lookup context for pair resolution');
assert(nearestBody.includes('resolveNearbyRoadPair(coords.lat, coords.lng, selected.normalized, roadEvaluationContext)'), 'nearest-road crossing path reuses the lookup context for pair resolution');

const awarenessBody = bodyOf('resolveGridlyAwarenessArea');
assert(awarenessBody.includes('const normalizedCandidateLookup = new Map();'), 'awareness-area resolution caches candidate normalization within one resolution call');
assert(awarenessBody.includes('getCandidateLookup(candidate, "label")'), 'awareness-area resolution reuses normalized candidate labels');
assert(awarenessBody.includes('getCandidateLookup(candidate, "storageValue")'), 'awareness-area resolution reuses normalized candidate storage values');

console.log('V947 road candidate awareness hoist static checks passed');
