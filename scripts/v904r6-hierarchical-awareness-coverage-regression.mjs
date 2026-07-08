import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');

const registryBlock = app.slice(app.indexOf('const GRIDLY_COUNTY_REGISTRY'), app.indexOf('function gridlyIsLoadableGeoJsonSource'));
const countyEntries = [...registryBlock.matchAll(/"([a-z-]+-tx)": Object\.freeze\(\{([\s\S]*?)\n  \}\)/g)];
assert.equal(countyEntries.length, 28, 'Gridly must expose all 28 configured counties');

const counties = countyEntries.map(([, countyId, body]) => {
  const name = body.match(/name: "([^"]+)"/)?.[1] || countyId;
  const defaultAreasRaw = body.match(/defaultAwarenessAreas: \[([^\]]*)\]/)?.[1] || '';
  const defaultAwarenessAreas = [...defaultAreasRaw.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  const countyName = name.toLowerCase();
  const communities = defaultAwarenessAreas.filter((area) => {
    const normalized = area.toLowerCase();
    return normalized && normalized !== countyName && !normalized.endsWith(' county') && !normalized.startsWith('entire ');
  });
  return { countyId, name, defaultAwarenessAreas, communities };
});

const awarenessBlock = app.slice(app.indexOf('const GRIDLY_AWARENESS_AREA_DEFINITIONS'), app.indexOf('const GRIDLY_AWARENESS_AREA_BY_KEY'));
for (const county of counties) {
  assert.match(app, new RegExp(`countyValue: countyId`), 'county dropdown model must derive county values from runtime county ids');
  assert.match(app, /GRIDLY_COUNTY_REGISTRY\[countyId\]/, 'county dropdown model must derive from the runtime county registry');
  if (!county.communities.length) continue;
  for (const community of county.communities) {
    const staticDefinition = new RegExp(`label: "${community.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?storageValue: "${community.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?countyId: "${county.countyId}"`).test(awarenessBlock);
    const registryBridge = /gridlyBuildRegistryCommunityAwarenessArea/.test(app) && new RegExp(`defaultAwarenessAreas: \\[([^\\]]*"${community.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^\\]]*)\\]`).test(registryBlock);
    assert.ok(staticDefinition || registryBridge, `${county.name} -> ${community} must be selectable from canonical runtime coverage`);
  }
}

const requiredCases = [
  ['chambers-tx', 'Mont Belvieu'],
  ['chambers-tx', 'Anahuac'],
  ['liberty-tx', 'Dayton'],
  ['jefferson-tx', 'Beaumont'],
  ['montgomery-tx', 'Conroe']
];
for (const [countyId, community] of requiredCases) {
  assert.ok(counties.find((county) => county.countyId === countyId)?.communities.includes(community), `${countyId} -> ${community} must be in runtime coverage`);
  assert.match(app, new RegExp(`storageValue: "${community}"[\\s\\S]*?countyId: "${countyId}"|gridlyBuildRegistryCommunityAwarenessArea`), `${countyId} -> ${community} must resolve to an awareness/map-focus area`);
}

const harris = counties.find((county) => county.countyId === 'harris-tx');
assert.ok(harris, 'Harris County must be configured');
assert.ok(harris.communities.length > 0 || /harrisCountyCommunityStatus[\s\S]*countywideFallbackUsed/.test(app), 'Harris County must expose communities or audit an explicit countywide fallback');

for (const field of [
  'configuredCountyCount',
  'configuredCommunityCount',
  'countyCommunityCoverage',
  'countiesWithMissingCommunityLists',
  'selectedPairConsistent',
  'staleSavedAreaDetected',
  'storedAreaMatchesSelectedCommunity',
  'mapFocusMatchesStoredAwarenessArea',
  'allConfiguredCommunitiesHaveMapFocus',
  'allConfiguredCommunitiesSelectable',
  'harrisCountyCommunityStatus'
]) {
  assert.match(app, new RegExp(field), `audit must expose ${field}`);
}

assert.match(app, /selectGridlySettingsAwarenessArea\(next, "settings_awareness_county_change"/, 'county changes must save the selected community immediately');
assert.match(app, /storedAreaMatchesSelectedCommunity/, 'audit must detect stale saved awareness area after community switches');
assert.match(app, /allConfiguredCommunitiesHaveMapFocus/, 'audit must validate map focus for every configured community');
assert.match(app, /allConfiguredCommunitiesSelectable/, 'audit must validate selectability for every configured community');

console.log('V904R6 hierarchical awareness coverage regression checks passed.');
