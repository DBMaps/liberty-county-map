import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const registryBlock = app.slice(app.indexOf('const GRIDLY_COUNTY_REGISTRY'), app.indexOf('function gridlyIsLoadableGeoJsonSource'));
const awarenessBlock = app.slice(app.indexOf('const GRIDLY_AWARENESS_AREA_DEFINITIONS'), app.indexOf('const GRIDLY_AWARENESS_AREA_BY_KEY'));

function countyBody(countyId) {
  const match = registryBlock.match(new RegExp(`"${countyId}": Object\\.freeze\\(\\{([\\s\\S]*?)\\n  \\}\\)`));
  assert.ok(match, `${countyId} must exist in county registry`);
  return match[1];
}

function defaultAreas(body) {
  return [...(body.match(/defaultAwarenessAreas: \[([^\]]*)\]/)?.[1] || '').matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function assertCommunityRuntime(countyId, community) {
  const escaped = community.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasStaticArea = new RegExp(`label: "${escaped}"[\\s\\S]*?storageValue: "${escaped}"[\\s\\S]*?countyId: "${countyId}"`).test(awarenessBlock);
  const hasRegistryBridge = /gridlyBuildRegistryCommunityAwarenessArea/.test(app) && new RegExp(`defaultAwarenessAreas: \\[([^\\]]*"${escaped}"[^\\]]*)\\]`).test(countyBody(countyId));
  assert.ok(hasStaticArea || hasRegistryBridge, `${countyId} -> ${community} must have selectable awareness and map-focus support`);
}

const harrisBody = countyBody('harris-tx');
const harrisAreas = defaultAreas(harrisBody);
const harrisCommunities = harrisAreas.filter((area) => !/^harris county$/i.test(area));
const harrisSelectable = /selectable: true/.test(harrisBody) && /productionEnabled: true/.test(harrisBody);
if (harrisSelectable) {
  assert.ok(harrisCommunities.length > 0, 'Harris County cannot be beta-selectable without configured communities');
  for (const community of ['Houston', 'Baytown', 'Pasadena']) {
    assert.ok(harrisCommunities.includes(community), `Harris County must include ${community} while beta-selectable`);
    assertCommunityRuntime('harris-tx', community);
  }
} else {
  assert.match(app, /hiddenOrDisabledCounties/, 'disabled Harris path must be visible in hidden/disabled audit output');
  assert.match(app, /gridlyGetSelectableOperationalCountyIds\(\)/, 'selectors must derive from beta-selectable counties');
}

for (const [countyId, community] of [
  ['chambers-tx', 'Mont Belvieu'],
  ['chambers-tx', 'Anahuac'],
  ['liberty-tx', 'Dayton'],
  ['jefferson-tx', 'Beaumont'],
  ['montgomery-tx', 'Conroe']
]) {
  assert.ok(defaultAreas(countyBody(countyId)).includes(community), `${countyId} -> ${community} must remain configured`);
  assertCommunityRuntime(countyId, community);
}

for (const field of [
  'betaSelectableCountyCount',
  'hiddenOrDisabledCountyCount',
  'hiddenOrDisabledCounties',
  'largeCountyWithoutCommunityBlockers',
  'unselectableCommunityPairs',
  'failedMapFocusCommunityPairs',
  'selectedCommunityViewportReason'
]) {
  assert.match(app, new RegExp(field), `audit must expose ${field}`);
}

assert.match(app, /largeCountyWithoutCommunityBlockers\.length === 0/, 'safeForBeta must block large selectable counties without communities');
assert.match(app, /failedMapFocusCommunityPairs\.length === 0/, 'safeForBeta must block configured communities without map focus');
assert.match(app, /selectGridlySettingsAwarenessArea\(next, "settings_awareness_county_change"/, 'county changes must immediately save the preferred community');
assert.match(app, /applyGridlyHomeTownAwarenessContext\(\{ source, fitMap: true \}\)/, 'specific community saves must refresh map focus');
assert.match(app, /mapViewportCommunityScaled/, 'audit must verify selected community viewport scale');

console.log('V904R7 hierarchical awareness beta gating regression checks passed.');
