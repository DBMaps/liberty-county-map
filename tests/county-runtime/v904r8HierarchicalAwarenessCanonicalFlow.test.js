const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `${name} is present`);
  const signatureEnd = source.indexOf(') {', start);
  assert.notStrictEqual(signatureEnd, -1, `${name} has a function body`);
  const bodyStart = signatureEnd + 2;
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${name} has a complete function body`);
}

const selectFunction = extractFunction('selectGridlySettingsAwarenessArea');

assert(selectFunction.includes('const saveValue = resolveGridlySettingsAwarenessSaveValue(value, root);'), 'settings save starts from the selected community value in the active selector root');
assert(selectFunction.includes('saveGridlyHomeTownPreference(saveValue, { source })'), 'selected community is written through the canonical home-town preference writer');
assert(selectFunction.includes('gridlySetActiveCountyContext(resolvedCountyId)'), 'selected community county updates active county context');
assert(selectFunction.includes('setGridlyAwarenessView(selectedArea, selectedArea.startupZoom || GRIDLY_TOWN_STARTUP_ZOOM, { animate: false });'), 'specific community selection forces map focus to the selected community startup zoom after crossing-bound fitting');
assert(selectFunction.includes('select.value = saved;'), 'community dropdown is resynced to the canonical saved community');
assert(selectFunction.includes('select.dataset.gridlySettingsAwarenessOption = saved;'), 'settings action payload is resynced to the canonical saved community');
assert(selectFunction.includes('select.dataset.gridlyAwarenessArea = saved;'), 'awareness-area action payload is resynced to the canonical saved community');
assert(selectFunction.includes('gridlyRefreshSettingsAwarenessDisplayOnly(saved);'), 'settings summary refreshes from the canonical saved community');

const auditFunction = extractFunction('gridlyHierarchicalAwarenessSelectionAudit');
[
  'storedAwarenessArea',
  'savedAwarenessArea',
  'settingsSummaryMatchesCommunity',
  'homeLocationContextMatchesCommunity',
  'mapFocusArea',
  'mapViewportCommunityScaled',
  'selectedPairConsistent',
  'staleSavedAreaDetected'
].forEach((field) => assert(auditFunction.includes(field), `audit traces ${field}`));

assert(
  selectFunction.indexOf('saveGridlyHomeTownPreference(saveValue, { source })') < selectFunction.indexOf('setGridlyAwarenessView(selectedArea, selectedArea.startupZoom || GRIDLY_TOWN_STARTUP_ZOOM, { animate: false });'),
  'Dayton -> Liberty regression: storage is updated before map focus is forced to Liberty'
);
assert(
  selectFunction.indexOf('setGridlyAwarenessView(selectedArea, selectedArea.startupZoom || GRIDLY_TOWN_STARTUP_ZOOM, { animate: false });') < selectFunction.indexOf('gridlyRefreshSettingsAwarenessDisplayOnly(saved);'),
  'Dayton -> Liberty regression: map focus is corrected before settings summary completes'
);

const resolverFunction = extractFunction('resolveGridlyAwarenessAreaQuery');
const searchFunction = extractFunction('searchGridlySettingsAwarenessArea');
const resultFunction = extractFunction('renderGridlySettingsAwarenessSearchResult');
const onboardingFunction = extractFunction('resolveGridlyV858FirstRunLocation');
const settingsBindings = source.slice(source.indexOf('const manualCommunityBtn'), source.indexOf('if (els.settingsFeedbackBtn'));

assert(resolverFunction.includes('GRIDLY_AWARENESS_AREA_BY_KEY'), 'ZIP search resolves through registered canonical awareness identities');
assert(resolverFunction.includes('GRIDLY_AWARENESS_AREA_DEFINITIONS'), 'town search resolves through canonical county/community definitions');
assert(resolverFunction.includes('gridlyGetSelectableOperationalCountyIds()'), 'canonical result is checked against operational county authority');
assert(!searchFunction.includes('selectGridlySettingsAwarenessArea('), 'search alone does not apply or persist awareness state');
assert(!searchFunction.includes('saveGridlyHomeTownPreference('), 'search does not introduce a parallel persistence path');
assert(resultFunction.includes('result.status === "RESOLVED_NOT_OPERATIONAL"'), 'unsupported canonical identities fail closed');
assert(resultFunction.indexOf('result.status === "RESOLVED_NOT_OPERATIONAL"') < resultFunction.indexOf('selectGridlySettingsAwarenessArea('), 'unsupported result exits the apply-button branch');
assert(resultFunction.includes('selectGridlySettingsAwarenessArea(result.awarenessArea?.storageValue || result.awarenessAreaKey'), 'explicit Watch confirmation uses the canonical Settings update path');
assert(settingsBindings.includes('selectGridlySettingsAwarenessArea(target.value || "", "legacy_settings_awareness_area"'), 'manual community selection keeps the canonical Settings update path');
assert(onboardingFunction.includes('resolveGridlyAwarenessAreaQuery(value)'), 'onboarding reuses the canonical ZIP/town resolver');
assert(onboardingFunction.includes('result.status === "RESOLVED_OPERATIONAL"'), 'onboarding cannot apply an unsupported area');
assert(!resolverFunction.match(/hazard|crossing|alert|supabase|route/i), 'resolver does not introduce a filtering, route, or Supabase path');

console.log('v904r8HierarchicalAwarenessCanonicalFlow.test.js passed');
