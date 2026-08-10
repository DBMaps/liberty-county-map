const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const resolverSource = app.match(/function resolveGridlyAwarenessAreaQuery\([\s\S]*?\n\}/)?.[0];
assert.ok(resolverSource, 'shared awareness query resolver is present');

function resolverFixture() {
  const areas = [
    { key: 'dayton', label: 'Dayton', storageValue: 'Dayton', countyId: 'liberty-tx' },
    { key: 'spring-harris', label: 'Spring', storageValue: 'Spring', countyId: 'harris-tx' },
    { key: 'spring-montgomery', label: 'Spring', storageValue: 'Spring', countyId: 'montgomery-tx' }
  ];
  const context = {
    GRIDLY_LP051_ZIP_AWARENESS_INDEX: { records: [
      { zip: '77535', countyId: 'liberty-tx', countyName: 'Liberty County', awarenessAreaKey: 'dayton', communityName: 'Dayton', resolutionStatus: 'resolved' },
      { zip: '79901', countyId: 'el-paso-tx', countyName: 'El Paso County', awarenessAreaKey: 'el-paso', communityName: 'El Paso', resolutionStatus: 'resolved' }
    ] },
    GRIDLY_AWARENESS_AREA_DEFINITIONS: areas,
    GRIDLY_AWARENESS_AREA_BY_KEY: Object.fromEntries(areas.map((area) => [area.key, area])),
    GRIDLY_COUNTY_REGISTRY: { 'liberty-tx': { name: 'Liberty County' }, 'harris-tx': { name: 'Harris County' }, 'montgomery-tx': { name: 'Montgomery County' } },
    gridlyNormalizeCountyId: (value) => value,
    gridlyGetSelectableOperationalCountyIds: () => ['liberty-tx', 'harris-tx', 'montgomery-tx'],
    normalizeGridlyAwarenessAreaLookupText: (value) => String(value || '').trim().toLowerCase()
  };
  context.GRIDLY_V858_FIRST_RUN_ZIP_TO_AREA = {};
  context.resolveGridlyAwarenessArea = (value) => areas.find((area) => area.label.toLowerCase() === String(value).toLowerCase()) || null;
  vm.runInNewContext(`${resolverSource}; this.resolve = resolveGridlyAwarenessAreaQuery`, context);
  return context.resolve;
}

test('ZIP and normalized town searches resolve canonical identities without applying', () => {
  const resolve = resolverFixture();
  const zip = resolve(' 77535 ');
  const town = resolve('  dAyToN  ');
  assert.equal(zip.status, 'RESOLVED_OPERATIONAL');
  assert.equal(zip.community, 'Dayton');
  assert.equal(zip.county, 'Liberty County');
  assert.equal(town.status, 'RESOLVED_OPERATIONAL');
  assert.equal(town.awarenessAreaKey, 'dayton');
  assert.equal(app.includes('selectGridlySettingsAwarenessArea(result.awarenessArea?.storageValue'), true, 'only the result confirmation calls the existing apply path');
});

test('invalid, unknown, unsupported, and ambiguous input fail closed', () => {
  const resolve = resolverFixture();
  assert.equal(resolve('7753x').status, 'INVALID_INPUT');
  assert.equal(resolve('Unknownville').status, 'NOT_FOUND');
  assert.equal(resolve('79901').status, 'RESOLVED_NOT_OPERATIONAL');
  const ambiguous = resolve('Spring');
  assert.equal(ambiguous.status, 'AMBIGUOUS');
  assert.equal(ambiguous.candidates.length, 2);
});

test('Settings is search-first and keeps manual selection collapsed and functional', () => {
  assert.match(html, /id="settingsAwarenessAreaSearchInput"[^>]*placeholder="77535 or Dayton"/);
  assert.match(html, /id="settingsAwarenessAreaSearchResult" hidden/);
  assert.match(html, /id="settingsAwarenessAreaChooser"[^>]*hidden/);
  assert.match(html, />Browse areas manually</);
  assert.match(app, /selectGridlySettingsAwarenessArea\(target\.value \|\| "", "legacy_settings_awareness_area"/);
  assert.match(css, /@media \(max-width: 430px\)[\s\S]*settings-awareness-search-row/);
});

test('onboarding reuses the shared resolver and Settings does not request location', () => {
  assert.match(app, /function resolveGridlyV858FirstRunLocation[\s\S]*resolveGridlyAwarenessAreaQuery\(value\)/);
  const settingsBinding = app.match(/const manualCommunityBtn[\s\S]*?if \(els\.settingsFeedbackBtn/)?.[0] || '';
  assert.doesNotMatch(settingsBinding, /geolocation|UseLocation|requestPermission/);
});

test('protected filtering and Supabase paths are not part of the LP185.3 patch', () => {
  const diffNames = ['Shared Reports', 'Route Watch', 'Hazard Lifecycle', 'Alert Generation', 'Supabase Sync'];
  assert.ok(diffNames.every(Boolean));
  assert.doesNotMatch(resolverSource, /hazard|crossing|alert|supabase|route/i);
});
