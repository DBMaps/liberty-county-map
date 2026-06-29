const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

assert.ok(appSource.includes('const JEFFERSON_COUNTY_AWARENESS_BOUNDS = { south: 29.52, west: -94.55, north: 30.20, east: -93.70 };'), 'Jefferson county bounds are in Jefferson County, Texas instead of old placeholder geography');
assert.ok(appSource.includes('"jefferson-tx": "48245"'), 'Jefferson active county GEOID is 48245');
assert.ok(appSource.includes('{ key: "jefferson-county", label: "Jefferson County", storageValue: "Jefferson County", countyId: "jefferson-tx", lat: 29.86, lng: -94.12'), 'Jefferson County awareness area uses a Jefferson County, Texas anchor');

for (const label of ['Beaumont', 'Port Arthur', 'Nederland', 'Port Neches']) {
  const areaPattern = new RegExp(`label: "${label}"[\\s\\S]*?countyId: "jefferson-tx"[\\s\\S]*?radiusMiles: [58][\\s\\S]*?startupZoom: 13`);
  assert.ok(areaPattern.test(appSource), `${label} is a seeded Jefferson community camera target`);
}

assert.ok(!/key: "jefferson"/.test(appSource), 'plain Jefferson is not registered as a Jefferson County awareness area');
assert.ok(appSource.includes('Unsupported awareness area: ${requested || "(blank)"}'), 'unsupported awareness areas return unsupported instead of falling back');
assert.ok(appSource.includes('activeGeojsonRaw.features.filter'), 'active boundary render filters statewide payload to active county features');
assert.ok(!appSource.includes('sourceType: "statewide_passive"'), 'statewide passive boundary features are not registered as renderable county layer groups');
assert.ok(appSource.includes('activeBoundaryRenderedFeatureCount'), 'V798 audit exposes active rendered boundary feature count');
assert.ok(appSource.includes('activeBoundaryRenderedGeoids'), 'V798 audit exposes active rendered GEOIDs');
assert.ok(appSource.includes('passiveCountyBoundaryRendered'), 'V798 audit preserves passive rendered boundary count');
assert.ok(appSource.includes('mapCenter: currentMapCenter'), 'V798 audit exposes map center');
assert.ok(appSource.includes('expectedCountyCenter'), 'V798 audit exposes expected county center');
assert.ok(appSource.includes('mapCenterDeltaMiles'), 'V798 audit exposes map camera distance from expected county center');
assert.ok(appSource.includes('mapCameraCountyPass'), 'V798 audit exposes map camera county pass/fail');
assert.ok(appSource.includes('gridlyFitMapToActiveCountyContext(normalized'), 'active county context change applies map camera movement');

console.log('v798CountyBoundaryCameraIsolation.test.js passed');
