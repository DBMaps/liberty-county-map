const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');

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

test('Portrait V2 exposes one Home Area action and the shared picker', () => {
  const surface = extractFunction('buildSettingsSurfaceHtml');
  const actionStart = app.indexOf('"settings-change-home-area": () =>');
  assert.notEqual(actionStart, -1, 'Portrait V2 Home Area action exists');
  const actions = app.slice(actionStart, actionStart + 500);
  assert.match(surface, /Home area[\s\S]*settings-change-home-area/);
  assert.doesNotMatch(surface, /Current view|Home ZIP|settings-choose-available-areas|Choose from available areas/);
  assert.doesNotMatch(surface, /Choose community manually|data-gridly-awareness-(?:county|community)-select|<select[^>]*awareness/i);
  assert.match(surface, /data-gridly-home-area-primary-chooser="settings"/);
  assert.match(actions, /"settings-change-home-area"[\s\S]*openGridlyPrimaryHomeAreaChooser/);
  assert.doesNotMatch(actions, /settings-choose-community-manually|updateGridlySettingsAwarenessCommunityOptions/);
});

test('Portrait V2 opener resets and renders the canonical LP185.3B search-first state', () => {
  const opener = extractFunction('openGridlySettingsAvailableAreaPicker');
  const builder = extractFunction('buildGridlySettingsAwarenessOptionsHtml');
  assert.match(opener, /gridlySettingsManualAwarenessQuery = ""/);
  assert.match(opener, /gridlySettingsManualAwarenessPending = ""/);
  assert.match(opener, /renderGridlyManualAwarenessAreaPicker/);
  assert.match(builder, /resolveGridlyManualAwarenessAreaSearch\(normalizedQuery\)/);
  assert.match(builder, /Start typing to find an available Gridly area\./);
  assert.match(builder, /groups\.flatMap/);
  assert.doesNotMatch(builder, /<select|<details|<summary/);
});

test('shared result selection stays pending until canonical Watch this area apply', () => {
  const renderer = extractFunction('renderGridlyManualAwarenessAreaPicker');
  assert.match(renderer, /gridlySettingsManualAwarenessPending = button\.dataset\.gridlyManualAwarenessValue/);
  assert.match(renderer, /selectGridlySettingsAwarenessArea\(gridlySettingsManualAwarenessPending, "settings_manual_awareness_area", container\)/);
  assert.doesNotMatch(renderer, /localStorage|saveGridlyHomeTownPreference|setGridlyAwarenessView/);
  assert.match(extractFunction('getGridlyManualAwarenessAreaOptions'), /gridlyGetCountyGroupedAwarenessOptions/);
  assert.match(extractFunction('gridlyGetCountyGroupedAwarenessOptions'), /gridlyGetSelectableOperationalCountyIds/);
});

test('ZIP-first, unsupported ZIP, onboarding, filtering, and location boundaries remain canonical', () => {
  assert.match(extractFunction('renderGridlySettingsAwarenessSearchResult'), /RESOLVED_NOT_OPERATIONAL/);
  assert.match(extractFunction('resolveGridlyAwarenessAreaQuery'), /gridlyGetSelectableOperationalCountyIds/);
  assert.match(extractFunction('resolveGridlyV858FirstRunLocation'), /result\.status === "RESOLVED_OPERATIONAL"/);
  assert.doesNotMatch(extractFunction('buildSettingsSurfaceHtml'), /geolocation|getCurrentPosition|requestPermission/);
});
