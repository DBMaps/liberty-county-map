const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');
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

const searchSource = extractFunction('resolveGridlyManualAwarenessAreaSearch');
const builder = extractFunction('buildGridlySettingsAwarenessOptionsHtml');
const renderer = extractFunction('renderGridlyManualAwarenessAreaPicker');

function makeSearchHarness() {
  const inventory = [
    { countyLabel: 'Liberty County', communities: [{ key: 'dayton', value: 'Dayton', label: 'Dayton' }] },
    { countyLabel: 'Polk County', communities: [{ key: 'polk-tx-livingston', value: 'Livingston', label: 'Livingston' }] }
  ];
  const context = {
    Object,
    getGridlyManualAwarenessAreaOptions: () => inventory,
    filterGridlyManualAwarenessAreas: (query) => inventory.map((group) => ({ ...group, communities: group.communities.filter((area) => `${area.label} ${group.countyLabel}`.toLowerCase().includes(query.toLowerCase())) })).filter((group) => group.communities.length),
    resolveGridlyAwarenessAreaQuery: (query) => ({
      status: query === '78701' ? 'RESOLVED_NOT_OPERATIONAL' : query === '77535' ? 'RESOLVED_OPERATIONAL' : 'NOT_FOUND',
      awarenessAreaKey: query === '77535' ? 'dayton' : null
    })
  };
  vm.runInNewContext(`${searchSource}; this.search = resolveGridlyManualAwarenessAreaSearch`, context);
  return context.search;
}

test('picker copy and empty search retain the LP185.3B contract', () => {
  assert.match(builder, /Search ZIP, town, or county/);
  assert.match(builder, /77535, Dayton, or Liberty County/);
  assert.match(builder, /Search an available Gridly area by ZIP, town, or county\./);
  assert.match(searchSource, /if \(!normalizedQuery\).*status: "EMPTY"/);
});

test('governed ZIP dispatch is resolver-backed and inventory-authoritative', () => {
  const search = makeSearchHarness();
  const dayton = search('77535');
  assert.equal(dayton.status, 'RESULTS');
  assert.equal(dayton.groups[0].countyLabel, 'Liberty County');
  assert.equal(dayton.groups[0].communities[0].label, 'Dayton');
  assert.match(searchSource, /resolveGridlyAwarenessAreaQuery\(normalizedQuery\)/);
  assert.match(searchSource, /getGridlyManualAwarenessAreaOptions/);
  assert.doesNotMatch(searchSource, /ZIP_AWARENESS_(?:INDEX|RECORDS)|fetch|geocode/);
});

test('text inventory search remains trimmed, partial, and case-insensitive', () => {
  const search = makeSearchHarness();
  assert.equal(search('  DAY  ').groups[0].communities[0].label, 'Dayton');
  assert.equal(search('livingston').groups[0].communities[0].label, 'Livingston');
  assert.equal(search('liberty').groups[0].countyLabel, 'Liberty County');
});

test('malformed and unavailable ZIPs fail closed without pending or apply controls', () => {
  const search = makeSearchHarness();
  assert.equal(search('7753').status, 'INVALID_ZIP');
  assert.equal(search('78701').status, 'RESOLVED_NOT_OPERATIONAL');
  assert.equal(search('78701').groups.length, 0);
  assert.match(builder, /Enter a valid 5-digit ZIP code\./);
  assert.match(builder, /Gridly isn't available for this ZIP yet\./);
  assert.match(renderer, /gridlySettingsManualAwarenessPending = ""/);
});

test('current, pending, and canonical apply states are explicit and polished', () => {
  assert.match(builder, /Currently watching/);
  assert.match(builder, /Selected area/);
  assert.match(builder, /Watch this area/);
  assert.match(renderer, /gridlySettingsManualAwarenessPending = button\.dataset\.gridlyManualAwarenessValue/);
  assert.match(renderer, /selectGridlySettingsAwarenessArea\(gridlySettingsManualAwarenessPending, "settings_manual_awareness_area", container\)/);
  assert.match(css, /settings-manual-area-state/);
  assert.match(css, /input\[type="search"\]:focus-visible/);
  assert.match(css, /font-size: 16px/);
});
