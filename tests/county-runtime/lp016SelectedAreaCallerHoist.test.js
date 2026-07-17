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
assert(callerAuditBody.includes('callsByCaller'), 'caller census exposes calls by caller');
assert(callerAuditBody.includes('doubleCountingDetected'), 'caller census reconciles double counting');
assert(source.includes('window.gridlyLp016SelectedAreaCallerAudit = gridlyLp016SelectedAreaCallerAudit'), 'caller census is exposed for browser validation');

console.log('LP016 selected-area caller hoist static checks passed');
