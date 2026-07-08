import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');

assert.match(app, /function gridlyGetCanonicalMapFocusArea/, 'map focus must resolve through a canonical awareness-area helper');
assert.match(app, /selectedArea && selectedArea\.countyWide !== true && selectedArea\.fallback !== true[\s\S]*return selectedArea/, 'specific selected communities must be the canonical map focus');
assert.match(app, /function gridlyFitMapToActiveCountyContext[\s\S]*gridlyMapFocusAreaIsCommunity\(focusArea\)[\s\S]*setGridlyAwarenessView\(focusArea, zoom/, 'active county fitting must defer to a selected community before county bounds');
assert.match(app, /selectGridlySettingsAwarenessArea[\s\S]*gridlySetActiveCountyContext\(resolvedCountyId\)[\s\S]*applyGridlyHomeTownAwarenessContext\(\{ source, fitMap: true \}\)/, 'settings save path must refresh the viewport at community scale after selecting a community');

const requiredCommunities = [
  ['Jefferson County', 'Beaumont', 'jefferson-tx'],
  ['Liberty County', 'Dayton', 'liberty-tx'],
  ['Montgomery County', 'Conroe', 'montgomery-tx']
];
for (const [county, community, countyId] of requiredCommunities) {
  assert.match(app, new RegExp(`label: "${community}"[\\s\\S]*?storageValue: "${community}"[\\s\\S]*?countyId: "${countyId}"`), `${county} -> ${community} must be a configured community awareness area`);
}

assert.match(app, /mapFocusArea/, 'audit must report mapFocusArea');
assert.match(app, /mapFocusMatchesSelectedCommunity/, 'audit must report mapFocusMatchesSelectedCommunity');
assert.match(app, /mapFocusIncorrectlyCounty/, 'audit must report mapFocusIncorrectlyCounty');
assert.match(app, /mapViewportCommunityScaled/, 'audit must report mapViewportCommunityScaled');
assert.match(app, /safeForBeta:[\s\S]*!mapFocusIncorrectlyCounty[\s\S]*mapFocusMatchesSelectedCommunity[\s\S]*mapViewportCommunityScaled/, 'audit must block beta when saved community resolves to county map focus or county viewport');
assert.match(app, /communitySelectHasUsableBox/, 'audit must avoid false hidden-selector failures when the select has usable options/geometry');

console.log('V904R5 hierarchical awareness map-focus regression checks passed.');
