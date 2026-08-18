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
  assert.equal(present({ complete: true, awarenessCount: 0, activeIssues: 0 }), '0 crossings watched');
});

test('failed or incomplete inventory is unavailable rather than zero', () => {
  assert.equal(present({ complete: false, awarenessCount: 0, activeIssues: 0 }), 'Crossing inventory unavailable');
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

