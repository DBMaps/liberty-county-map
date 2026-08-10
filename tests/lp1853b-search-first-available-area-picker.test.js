const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const body = app.indexOf(') {', start) + 2;
  let depth = 0;
  for (let index = body; index < app.length; index += 1) {
    if (app[index] === '{') depth += 1;
    if (app[index] === '}' && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

test('consumer copy consistently names the available-area path', () => {
  assert.match(html, />Choose from available areas</);
  assert.doesNotMatch(html, /Browse areas manually/);
  const binding = app.slice(app.indexOf('const manualCommunityBtn'), app.indexOf('if (els.settingsFeedbackBtn'));
  assert.match(binding, /Choose from available areas/);
  assert.doesNotMatch(binding, /Browse areas manually|Choose manually/);
  assert.match(extractFunction('renderGridlySettingsAwarenessSearchResult'), /Choose from available areas or enter a more specific area/);
});

test('empty query is an instructional state and does not construct or render inventory', () => {
  const filter = extractFunction('filterGridlyManualAwarenessAreas');
  const builder = extractFunction('buildGridlySettingsAwarenessOptionsHtml');
  assert.match(filter, /if \(!normalizedQuery\) return \[\]/);
  assert.ok(filter.indexOf('if (!normalizedQuery) return []') < filter.indexOf('getGridlyManualAwarenessAreaOptions()'));
  assert.match(builder, /Start typing to find an available Gridly area\./);
  assert.match(builder, /resolveGridlyManualAwarenessAreaSearch\(normalizedQuery\)/);
  assert.doesNotMatch(builder, /<details|settings-manual-county-group|<summary/);
  assert.match(builder, /placeholder="77535, Dayton, or Liberty County"/);
});

test('search results are flat semantic buttons with pending-only selection and canonical apply', () => {
  const builder = extractFunction('buildGridlySettingsAwarenessOptionsHtml');
  const renderer = extractFunction('renderGridlyManualAwarenessAreaPicker');
  assert.match(builder, /groups\.flatMap/);
  assert.match(builder, /<button type="button" class="settings-manual-area-result/);
  assert.match(builder, /group\.countyLabel/);
  assert.match(builder, /Currently watching/);
  assert.match(builder, /No available areas match your search\./);
  assert.match(renderer, /gridlySettingsManualAwarenessPending = button\.dataset\.gridlyManualAwarenessValue/);
  assert.match(renderer, /selectGridlySettingsAwarenessArea\(gridlySettingsManualAwarenessPending, "settings_manual_awareness_area", container\)/);
  assert.doesNotMatch(renderer, /localStorage|saveGridlyHomeTownPreference|setGridlyAwarenessView/);
});

test('opening from any Settings path resets to the same search-first state', () => {
  const binding = app.slice(app.indexOf('const manualCommunityBtn'), app.indexOf('if (els.settingsFeedbackBtn'));
  assert.match(binding, /gridlySettingsManualAwarenessQuery = ""/);
  assert.match(binding, /gridlySettingsManualAwarenessPending = ""/);
  assert.match(binding, /renderGridlyManualAwarenessAreaPicker/);
  assert.match(extractFunction('getGridlyManualAwarenessAreaOptions'), /gridlyGetCountyGroupedAwarenessOptions/);
  assert.match(extractFunction('gridlyGetCountyGroupedAwarenessOptions'), /gridlyGetSelectableOperationalCountyIds/);
});
