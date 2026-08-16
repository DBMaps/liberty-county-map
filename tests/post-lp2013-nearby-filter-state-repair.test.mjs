import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync('js/app.js', 'utf8');
const awarenessContextSource = source.match(/function applyGridlyHomeTownAwarenessContext\([\s\S]*?\n\}/)?.[0];

test('home-area context application preserves authoritative Nearby state', () => {
  const context = {
    activeGeoFilter: 'nearby',
    crossingRenderFilterVersion: 7,
    map: {},
    getGridlyHomeTownAwarenessAnchor: () => ({ countyWide: false, lat: 1, lng: 2 }),
    renderGridlyAwarenessMapIdentity: () => {},
    gridlyDispatchSemanticCamera: () => true,
    gridlyCommittedSemanticCamera: null,
    gridlyResolveCanonicalPlaceGeoid: () => null
  };
  vm.runInNewContext(`${awarenessContextSource};this.apply=applyGridlyHomeTownAwarenessContext`, context);
  assert.equal(context.apply({ source: 'filter-change:nearby' }), true);
  assert.equal(context.activeGeoFilter, 'nearby');
  assert.equal(context.crossingRenderFilterVersion, 7);
});

test('common filter owner and crossing selector retain all five canonical filter values', () => {
  assert.match(source, /activeGeoFilter = selectedFilter;/);
  assert.match(source, /if \(activeGeoFilter === "nearby"\) \{\s*const center = getGridlyAwarenessAnchor\(\);\s*const nearest = findNearestCrossings/);
  for (const value of ['nearby', 'town', 'county', 'active-delays', 'all']) {
    assert.match(source, new RegExp(`data-geo-filter="${value}"`));
  }
  assert.match(source, /pill\.classList\.toggle\("selected", pill\.dataset\.geoFilter === activeGeoFilter\)/);
  assert.match(source, /button\.classList\.toggle\("is-active", button\.dataset\.geoFilter === activeGeoFilter\)/);
});
