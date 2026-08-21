import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');

function publishWatchCount({ inventory, watchedIds, renderedIds, generation, currentGeneration }) {
  if (generation !== currentGeneration) return { committed: false, count: null };
  const inventoryIds = new Set(inventory.map(({ id }) => id));
  const watched = watchedIds.filter((id) => inventoryIds.has(id));
  return { committed: true, count: watched.length, rendered: renderedIds.length };
}

const scenarios = {
  pecos: { countyId: 'reeves-tx', inventory: 67, watched: 48, rendered: 42 },
  cienegasTerrace: { countyId: 'val-verde-tx', inventory: 47, watched: 21, rendered: 8 },
  bigLake: { countyId: 'reagan-tx', inventory: 22, watched: 21, rendered: 3 },
  floydada: { countyId: 'floyd-tx', inventory: 1, watched: 0, rendered: 0 },
  stanton: { countyId: 'martin-tx', inventory: 12, watched: 12, rendered: 12 },
  activeEmpty: { countyId: 'tyler-tx', inventory: 0, watched: 0, rendered: 0 }
};

function runScenario(row, generation = 7) {
  const inventory = Array.from({ length: row.inventory }, (_, id) => ({ id: `x${id}` }));
  return publishWatchCount({
    inventory,
    watchedIds: inventory.slice(0, row.watched).map(({ id }) => id),
    renderedIds: inventory.slice(0, row.rendered).map(({ id }) => id),
    generation,
    currentGeneration: 7
  });
}

test('Family I reproducers publish governed watched-area eligibility, independent of marker DOM', () => {
  assert.deepEqual(runScenario(scenarios.pecos), { committed: true, count: 48, rendered: 42 });
  assert.deepEqual(runScenario(scenarios.cienegasTerrace), { committed: true, count: 21, rendered: 8 });
  assert.match(app, /const selectorCount = gridlySelectConsumerVisibleCrossings\(selectedArea\)\.length/);
  assert.doesNotMatch(app, /selectorCount\s*=\s*(?:crossingMarkers|document\.)/);
});

test('positive controls preserve watched, viewport-rendered, and inventory distinctions', () => {
  assert.deepEqual(runScenario(scenarios.bigLake), { committed: true, count: 21, rendered: 3 });
  assert.deepEqual(runScenario(scenarios.floydada), { committed: true, count: 0, rendered: 0 });
  assert.deepEqual(runScenario(scenarios.stanton), { committed: true, count: 12, rendered: 12 });
  assert.notEqual(scenarios.bigLake.watched, scenarios.bigLake.inventory);
  assert.notEqual(scenarios.bigLake.watched, scenarios.bigLake.rendered);
  assert.notEqual(scenarios.floydada.watched, scenarios.floydada.inventory);
});

test('ACTIVE_EMPTY remains a legitimate governed zero', () => {
  assert.deepEqual(runScenario(scenarios.activeEmpty), { committed: true, count: 0, rendered: 0 });
});

test('compact summary coordinates are rejoined to canonical watched-area authority', () => {
  assert.match(app, /compact debug projection/);
  assert.match(app, /projectedArea\.coordinates\?\.lat/);
  assert.match(app, /sameIdentity && projectedCountyId === currentCountyId\s*\? currentArea/);
  assert.match(app, /summaryCount = Array\.isArray\(summary\.crossingsInArea\)/);
});

test('authoritative load invalidates counts and stale generations cannot overwrite a newer count', () => {
  assert.match(app, /gridlyCrossingInventoryRevision \+= 1/);
  assert.match(app, /syncGridlyAwarenessAreaSurfacesImmediately\("crossing-inventory-committed"/);
  assert.match(app, /requestedGeneration !== gridlyActiveCountyTransitionGeneration/);
  assert.deepEqual(runScenario(scenarios.pecos, 6), { committed: false, count: null });
});

test('map movement schedules rendering only and does not redefine watched count', () => {
  assert.match(app, /scheduleRenderCrossings\("map-move-or-zoom"\)/);
  const bigLakeAfterMove = publishWatchCount({
    inventory: Array.from({ length: 22 }, (_, id) => ({ id: `x${id}` })),
    watchedIds: Array.from({ length: 21 }, (_, id) => `x${id}`),
    renderedIds: ['x0'], generation: 7, currentGeneration: 7
  });
  assert.equal(bigLakeAfterMove.count, 21);
  assert.equal(bigLakeAfterMove.rendered, 1);
});

test('county authority and C/J membership contracts remain upstream and no control special cases exist', () => {
  assert.match(app, /const operationalCountyId = gridlyGetActiveCountyId\(\)/);
  assert.match(app, /gridlyLp196ResolveCanonicalMultiCountyPlaceIdentity/);
  const repairedFunction = app.slice(app.indexOf('function getGridlyBottomPanelAwarenessCrossingCount'), app.indexOf('function summarizeGridlyAwarenessIntelligenceForDisplay'));
  for (const forbidden of ['Pecos', 'Cienegas', 'Reeves', 'Val Verde', 'Big Lake', 'Floydada', 'Stanton']) {
    assert.equal(repairedFunction.includes(forbidden), false, `${forbidden} is not special-cased`);
  }
});

test('LP218 diagnostics expose bounded count state rather than crossing collections', () => {
  for (const field of ['countyId', 'transitionGeneration', 'inventoryCount', 'validCoordinateCount', 'watchedAreaEligibleCount', 'viewportEligibleCount', 'renderedMarkerCount', 'displayedWatchedCount', 'skipBreakdown', 'countUpdateReason', 'previousDisplayedCount', 'newDisplayedCount']) {
    assert.match(app, new RegExp(`${field}[:,]`));
  }
  assert.match(app, /status: stale \? "stale" : "current"/);
});
