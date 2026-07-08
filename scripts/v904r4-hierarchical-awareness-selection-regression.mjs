import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');

assert.match(app, /function resolveGridlySettingsAwarenessSaveValue/, 'settings saves must canonicalize select payloads');
assert.match(app, /selectedCommunityArea\.countyWide !== true && selectedCommunityArea\.fallback !== true/, 'selected communities must override stale county payloads');
assert.doesNotMatch(app, /welcome_county_change" \}\);\s*renderGridlyWelcomeHomeTownSelection/, 'first-run county selector must not save countywide on county change');
assert.match(app, /const preferred = group\.communities\.find\(\(community\) => community\.countyWide !== true && community\.fallback !== true\) \|\| group\.communities\[0\]/, 'settings county changes should prefer a configured community and only fall back to countywide when no community exists');

const requiredCommunities = [
  ['Jefferson County', 'Beaumont', 'jefferson-tx'],
  ['Liberty County', 'Dayton', 'liberty-tx'],
  ['Montgomery County', 'Conroe', 'montgomery-tx']
];
for (const [county, community, countyId] of requiredCommunities) {
  assert.match(app, new RegExp(`label: "${community}"[\\s\\S]*?storageValue: "${community}"[\\s\\S]*?countyId: "${countyId}"`), `${county} -> ${community} must be a configured community awareness area`);
}

assert.match(app, /savedAreaMatchesSelectedCommunity/, 'audit must report whether saved area matches the selected community');
assert.match(app, /savedAreaIncorrectlyCounty/, 'audit must detect selected-community/saved-county mismatch');
assert.match(app, /homeLocationContextMatchesCommunity/, 'audit must report home Location Context community match');
assert.match(app, /settingsSummaryMatchesCommunity/, 'audit must report Settings summary community match');
assert.match(app, /safeForBeta:[\s\S]*?!savedAreaIncorrectlyCounty/, 'audit must block beta when community selection saves a county');

console.log('V904R4 hierarchical awareness selection regression checks passed.');
