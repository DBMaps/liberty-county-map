import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');

function present({ complete, awarenessCount, activeIssues }) {
  const crossingText = complete
    ? `${awarenessCount} crossing${awarenessCount === 1 ? '' : 's'} watched`
    : 'Crossing inventory unavailable';
  return activeIssues > 0
    ? `${activeIssues} active issue${activeIssues === 1 ? '' : 's'} nearby · ${crossingText}`
    : crossingText;
}

function locationContextLines(input) {
  const crossingsLine = present(input);
  return input.activeIssues > 0
    ? { status: 'Active reports posted nearby', crossingsLine }
    : { status: 'Map ready', crossingsLine };
}

function occurrenceCount(lines, text) {
  return Object.values(lines).reduce((count, line) => count + (line.split(text).length - 1), 0);
}

test('quiet Location Context assigns nonzero crossing copy only to its dedicated line', () => {
  for (const awarenessCount of [70, 30]) {
    const input = { complete: true, awarenessCount, activeIssues: 0 };
    const lines = locationContextLines(input);
    const expected = `${awarenessCount} crossings watched`;
    assert.deepEqual(lines, { status: 'Map ready', crossingsLine: expected });
    assert.equal(occurrenceCount(lines, expected), 1);
    assert.deepEqual(input, { complete: true, awarenessCount, activeIssues: 0 });
  }
  assert.match(app, /function getGridlyLocationContextMapMeta\(\) \{\s+return "Map ready";/);
  assert.match(app, /const quietMapContextMeta = getGridlyLocationContextMapMeta\(\);/);
});

test('active Location Context retains its combined issue and crossing presentation', () => {
  const lines = locationContextLines({ complete: true, awarenessCount: 417, activeIssues: 24 });
  assert.equal(lines.crossingsLine, '24 active issues nearby · 417 crossings watched');
  assert.equal(occurrenceCount(lines, '417 crossings watched'), 1);
});

test('fresh hydration invalidates the stale zero Location Context snapshot', () => {
  const beforeHydration = { complete: false, awarenessCount: 0, cachedLine: '21 active issues nearby · 0 crossings watched' };
  const afterCommit = { complete: true, awarenessCount: 135, publishedCount: 176, revision: 1 };
  assert.notEqual(beforeHydration.cachedLine, present({ ...afterCommit, activeIssues: 21 }));
  assert.equal(present({ ...afterCommit, activeIssues: 21 }), '21 active issues nearby · 135 crossings watched');
  assert.match(app, /gridlyCrossingInventoryRevision \+= 1/);
  assert.match(app, /syncGridlyAwarenessAreaSurfacesImmediately\("crossing-inventory-committed"/);
  assert.match(app, /crossingsLine: quietState \? quietCrossingsLine : activeCrossingsLine/);
});

test('valid complete zero remains numeric zero', () => {
  const lines = locationContextLines({ complete: true, awarenessCount: 0, activeIssues: 0 });
  assert.equal(lines.crossingsLine, '0 crossings watched');
  assert.equal(occurrenceCount(lines, '0 crossings watched'), 1);
});

test('failed or incomplete inventory is unavailable rather than zero', () => {
  const lines = locationContextLines({ complete: false, awarenessCount: 0, activeIssues: 0 });
  assert.equal(lines.crossingsLine, 'Crossing inventory unavailable');
  assert.equal(occurrenceCount(lines, 'Crossing inventory unavailable'), 1);
  assert.equal(occurrenceCount(lines, '0 crossings watched'), 0);
});

test('nonzero governed awareness count has exact visible parity', () => {
  assert.equal(present({ complete: true, awarenessCount: 135, activeIssues: 0 }), '135 crossings watched');
});

test('safe owner audit reads actual Location Context DOM and reports revision parity', () => {
  assert.match(app, /function gridlyReadLocationContextCrossingDom\(\)/);
  assert.match(app, /document\.getElementById\("mobileAwarenessPanelCrossings"\)/);
  assert.match(app, /visibleDomCrossingCount: visibleDom\.value/);
  assert.match(app, /countParity: complete && visibleDom\.state === "numeric"/);
  assert.match(app, /canonicalAreaIdentity/);
  assert.match(app, /operationalCountyId/);
});
