const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

const buildModel = app.match(/function gridlyBriefInteractionBuildModel\(\) \{[\s\S]*?\n\}/)?.[0] || '';
const storyBuilder = app.match(/function buildGridlyAwarenessStory\(input = \{\}\) \{[\s\S]*?\n\}\n\nwindow\.buildGridlyAwarenessStory/)?.[0] || '';
const initBrief = app.match(/function gridlyInitBriefInteraction\(\) \{[\s\S]*?\n\}\n\nif \(typeof document !== "undefined"\)/)?.[0] || '';

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
