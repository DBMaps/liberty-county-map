const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function extractNamedFunction(source, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declaration = new RegExp(`(?:async\\s+)?function\\s+${escapedName}\\s*\\(`);
  const declarationMatch = declaration.exec(source);
  assert(declarationMatch, `${name} declaration is present`);

  const functionStart = declarationMatch.index;
  let parameterDepth = 0;
  let parameterEnd = -1;
  for (let index = declarationMatch.index + declarationMatch[0].length - 1; index < source.length; index += 1) {
    if (source[index] === '(') parameterDepth += 1;
    if (source[index] === ')') {
      parameterDepth -= 1;
      if (parameterDepth === 0) {
        parameterEnd = index;
        break;
      }
    }
  }
  assert.notStrictEqual(parameterEnd, -1, `${name} parameter list closes`);
  const bodyStart = source.indexOf('{', parameterEnd);
  assert.notStrictEqual(bodyStart, -1, `${name} body starts with an opening brace`);

  let depth = 0;
  let state = 'code';
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === 'line-comment') {
      if (char === '\n' || char === '\r') state = 'code';
      continue;
    }
    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        state = 'code';
        index += 1;
      }
      continue;
    }
    if (state === 'single-quote' || state === 'double-quote' || state === 'template') {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if ((state === 'single-quote' && char === "'")
        || (state === 'double-quote' && char === '"')
        || (state === 'template' && char === '`')) {
        state = 'code';
      }
      continue;
    }

    if (char === '/' && next === '/') {
      state = 'line-comment';
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      state = 'block-comment';
      index += 1;
      continue;
    }
    if (char === "'") {
      state = 'single-quote';
      continue;
    }
    if (char === '"') {
      state = 'double-quote';
      continue;
    }
    if (char === '`') {
      state = 'template';
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(functionStart, index + 1);
    }
  }

  assert.fail(`${name} body has a balanced closing brace`);
}

const buildModel = extractNamedFunction(app, 'gridlyBriefInteractionBuildModel');
const storyBuilder = extractNamedFunction(app, 'buildGridlyAwarenessStory');
const initBrief = extractNamedFunction(app, 'gridlyInitBriefInteraction');

assert(buildModel, 'Awareness Brief model builder is present');
assert(storyBuilder, 'Story Engine builder is present');
assert(initBrief, 'Awareness Brief interaction initializer is present');

assert.strictEqual(
  (buildModel.match(/getGridlyCanonicalAwarenessPresentationContext\(/g) || []).length,
  1,
  'one Awareness Brief model build resolves canonical presentation context once'
);
assert.strictEqual(
  (buildModel.match(/buildGridlyAwarenessStory\(/g) || []).length,
  1,
  'one Awareness Brief model build invokes Story Engine once'
);
assert(
  buildModel.includes('buildGridlyAwarenessStory({ primary, secondary, trust, awarenessContext: presentationContext })'),
  'Awareness Brief passes its per-build presentation context into Story Engine'
);
assert(
  storyBuilder.includes('input.awarenessContext || (typeof getGridlyCanonicalAwarenessPresentationContext === "function" ? getGridlyCanonicalAwarenessPresentationContext() : {})'),
  'Story Engine accepts supplied awareness context while preserving fallback resolution for unrelated callers'
);
assert.strictEqual(
  (storyBuilder.match(/getGridlyCanonicalAwarenessPresentationContext\(/g) || []).length,
  1,
  'Story Engine has one fallback canonical context resolver path'
);
assert(
  !app.includes('gridlyAwarenessResolutionTurnCache') && !app.includes('js/gridlyAwarenessResolutionTurnCache.js'),
  'no awareness turn cache is wired'
);
assert.strictEqual(
  (initBrief.match(/handle\.addEventListener\("click"/g) || []).length,
  1,
  'Awareness Brief handle binds one click listener in the initializer'
);
assert.strictEqual(
  (initBrief.match(/gridlyBriefInteractionRender\(\);/g) || []).length,
  2,
  'initializer renders once during init and once in the click handler body'
);

console.log('LP015 Awareness Brief per-operation context reuse audit passed');
