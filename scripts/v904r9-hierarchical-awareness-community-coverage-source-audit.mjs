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
function defaultAreas(countyId) {
  return [...(countyBody(countyId).match(/defaultAwarenessAreas: \[([^\]]*)\]/)?.[1] || '').matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}
function hasArea(countyId, community) {
  const escaped = community.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`label: "${escaped}"[\\s\\S]*?storageValue: "${escaped}"[\\s\\S]*?countyId: "${countyId}"`).test(awarenessBlock)
    || (app.includes('gridlyBuildRegistryCommunityAwarenessArea') && defaultAreas(countyId).includes(community));
}

for (const field of [
  'communitySourceOfTruth',
  'harrisMissingLikelyCommunities',
  'harrisSupportedCommunities',
  'harrisUnsupportedCommunities',
  'missingCommunityReasons',
  'unselectableCommunityPairsDetailed',
  'communityCoverageSourceMismatch'
]) {
  assert.match(app, new RegExp(field), `V904R9 audit must expose ${field}`);
}

for (const [countyId, community] of [
  ['liberty-tx', 'Dayton'],
  ['montgomery-tx', 'Conroe'],
  ['jefferson-tx', 'Beaumont'],
  ['chambers-tx', 'Mont Belvieu'],
  ['harris-tx', 'Houston'],
  ['harris-tx', 'Deer Park'],
  ['harris-tx', 'Crosby']
]) {
  assert.ok(defaultAreas(countyId).includes(community), `${countyId} -> ${community} must be configured in defaultAwarenessAreas`);
  assert.ok(hasArea(countyId, community), `${countyId} -> ${community} must have selectable awareness/map-focus support`);
}

for (const community of ['Houston', 'Pasadena', 'Baytown', 'Humble', 'Katy', 'Cypress', 'Spring', 'Tomball', 'Channelview', 'Deer Park', 'La Porte', 'Crosby', 'Atascocita', 'Kingwood', 'Sheldon', 'Aldine', 'North Houston', 'Jersey Village', 'Bellaire', 'South Houston', 'Jacinto City', 'Galena Park', 'Webster', 'Seabrook', 'Clear Lake', 'West University Place']) {
  assert.ok(defaultAreas('harris-tx').includes(community), `Harris County should include supported reviewed community ${community}`);
  assert.ok(hasArea('harris-tx', community), `Harris County -> ${community} must have map-focus support`);
}

assert.match(app, /normalized !== "other"/, 'placeholder Other must not create unselectable configured-community blockers');
assert.match(app, /unselectableCommunityPairsDetailed\.map/, 'detailed unselectable diagnostics must be derived from blockers');
assert.match(app, /safeForBeta:[\s\S]*allConfiguredCommunitiesSelectable[\s\S]*failedMapFocusCommunityPairs\.length === 0/, 'safeForBeta must require selectable and map-focusable beta communities');
assert.match(app, /Crosby[\s\S]*Missing because V904R8 built Harris communities only from defaultAwarenessAreas/, 'Crosby missing reason must be documented');

console.log('V904R9 hierarchical awareness community coverage source audit passed.');
