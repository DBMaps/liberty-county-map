const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const selectFunction = source.match(/function selectGridlySettingsAwarenessArea\([\s\S]*?\n\}\n\n\nfunction gridlyHierarchicalAwarenessSelectionAudit/)?.[0] || '';

assert(selectFunction.includes('const saveValue = resolveGridlySettingsAwarenessSaveValue(value, root);'), 'settings save starts from the selected community value in the active selector root');
assert(selectFunction.includes('saveGridlyHomeTownPreference(saveValue, { source })'), 'selected community is written through the canonical home-town preference writer');
assert(selectFunction.includes('gridlySetActiveCountyContext(resolvedCountyId)'), 'selected community county updates active county context');
assert(selectFunction.includes('setGridlyAwarenessView(selectedArea, selectedArea.startupZoom || GRIDLY_TOWN_STARTUP_ZOOM, { animate: false });'), 'specific community selection forces map focus to the selected community startup zoom after crossing-bound fitting');
assert(selectFunction.includes('select.value = saved;'), 'community dropdown is resynced to the canonical saved community');
assert(selectFunction.includes('select.dataset.gridlySettingsAwarenessOption = saved;'), 'settings action payload is resynced to the canonical saved community');
assert(selectFunction.includes('select.dataset.gridlyAwarenessArea = saved;'), 'awareness-area action payload is resynced to the canonical saved community');
assert(selectFunction.includes('gridlyRefreshSettingsAwarenessDisplayOnly(saved);'), 'settings summary refreshes from the canonical saved community');

const auditFunction = source.match(/function gridlyHierarchicalAwarenessSelectionAudit\([\s\S]*?\n\}\n\nif \(typeof window !== "undefined"\) window\.gridlyHierarchicalAwarenessSelectionAudit/)?.[0] || '';
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

console.log('v904r8HierarchicalAwarenessCanonicalFlow.test.js passed');
