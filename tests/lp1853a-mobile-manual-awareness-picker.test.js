const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');

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

test('available-area search stays secondary, collapsed, and replaces native county/community selects', () => {
  assert.match(html, /id="settingsAwarenessAreaChooser"[^>]*hidden/);
  assert.match(html, />Choose from available areas</);
  assert.match(html, /id="settingsAwarenessAreaSearchInput"[^>]*placeholder="77535 or Dayton"/);
  const builder = extractFunction('buildGridlySettingsAwarenessOptionsHtml');
  assert.doesNotMatch(builder, /<select|data-gridly-awareness-county-select|data-gridly-awareness-community-select/);
  assert.match(builder, /Choose from available areas/);
  assert.match(builder, /Search county or community/);
  assert.match(css, /settings-awareness-manual-picker input\[type="search"\][\s\S]*font-size: 16px/);
  assert.match(css, /settings-manual-county-list[\s\S]*overflow-y: auto/);
});

test('manual inventory filter searches operational county and community identities only', () => {
  const getOptions = extractFunction('getGridlyManualAwarenessAreaOptions');
  const filterOptions = extractFunction('filterGridlyManualAwarenessAreas');
  const groups = [
    { countyLabel: 'Liberty County', countyId: 'liberty-tx', communities: [
      { label: 'Liberty County', value: 'Liberty County', fallback: false },
      { label: 'Dayton', value: 'Dayton', fallback: false }
    ] },
    { countyLabel: 'Polk County', countyId: 'polk-tx', communities: [{ label: 'Livingston', value: 'Livingston', fallback: false }] },
    { countyLabel: 'Unsupported County', countyId: 'unsupported-tx', communities: [{ label: 'Nowhere', value: 'Nowhere', fallback: true }] }
  ];
  const context = {
    gridlyGetCountyGroupedAwarenessOptions: () => groups,
    normalizeGridlyAwarenessAreaLookupText: (value) => String(value || '').trim().toLowerCase(),
    Object
  };
  vm.runInNewContext(`${getOptions}\n${filterOptions}\nthis.filter = filterGridlyManualAwarenessAreas;`, context);
  const liberty = context.filter('  LiBeRtY  ');
  assert.deepEqual(Array.from(liberty, (group) => group.countyId), ['liberty-tx']);
  assert.deepEqual(Array.from(liberty[0].communities, (community) => community.label), ['Liberty County', 'Dayton']);
  assert.deepEqual(Array.from(context.filter('DAYTON')[0].communities, (community) => community.label), ['Dayton']);
  assert.deepEqual(Array.from(context.filter('livingston'), (group) => group.countyId), ['polk-tx']);
  assert.deepEqual(Array.from(context.filter('  liv  ')[0].communities, (community) => community.label), ['Livingston']);
  assert.equal(context.filter('nonsense').length, 0);
  assert.equal(context.filter('Nowhere').length, 0, 'non-canonical fallback rows cannot become selectable');
  assert.equal(context.filter('').length, 0, 'empty search never returns the operational inventory');
});

test('manual choice requires confirmation and applies only through the canonical Settings updater', () => {
  const render = extractFunction('renderGridlyManualAwarenessAreaPicker');
  assert.match(render, /gridlySettingsManualAwarenessPending = button\.dataset\.gridlyManualAwarenessValue/);
  assert.match(render, /data-gridly-manual-awareness-apply/);
  assert.match(render, /selectGridlySettingsAwarenessArea\(gridlySettingsManualAwarenessPending, "settings_manual_awareness_area", container\)/);
  assert.doesNotMatch(render, /localStorage|saveGridlyHomeTownPreference|setGridlyAwarenessView/);
  assert.match(extractFunction('getGridlyManualAwarenessAreaOptions'), /gridlyGetCountyGroupedAwarenessOptions/);
  assert.match(extractFunction('gridlyGetCountyGroupedAwarenessOptions'), /gridlyGetSelectableOperationalCountyIds/);
  assert.match(extractFunction('buildGridlySettingsAwarenessOptionsHtml'), /Current watched area/);
  assert.match(extractFunction('buildGridlySettingsAwarenessOptionsHtml'), /No available areas match your search\./);
});

test('protected ZIP guard and onboarding behavior remain in their existing canonical flows', () => {
  const result = extractFunction('renderGridlySettingsAwarenessSearchResult');
  const resolver = extractFunction('resolveGridlyAwarenessAreaQuery');
  const onboarding = extractFunction('resolveGridlyV858FirstRunLocation');
  assert.ok(result.indexOf('result.status === "RESOLVED_NOT_OPERATIONAL"') < result.indexOf('selectGridlySettingsAwarenessArea('));
  assert.match(resolver, /gridlyGetSelectableOperationalCountyIds/);
  assert.match(onboarding, /result\.status === "RESOLVED_OPERATIONAL"/);
  assert.doesNotMatch(renderGridlySettingsBinding(), /geolocation|requestPermission/);
});

function renderGridlySettingsBinding() {
  return app.slice(app.indexOf('const manualCommunityBtn'), app.indexOf('if (els.settingsFeedbackBtn'));
}
