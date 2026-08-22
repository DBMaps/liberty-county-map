import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
const app = fs.readFileSync("js/app.js", "utf8");
const pkg = readJson("Crossing-Packages/val-verde/package-manifest.json");
const crossings = readJson(pkg.packageFile).features;
const presentations = readJson("data/generated/gridly-statewide-place-presentation-v1.json").places;
const communities = [
  ["Amistad", "4803096"], ["Box Canyon", "4809656"], ["Cienegas Terrace", "4814927"],
  ["Del Rio", "4819792"], ["Laughlin AFB", "4841704"]
];

test("authoritative Gridly inventory resolves all five Val Verde identities", () => {
  for (const [name, geoid] of communities) {
    assert.match(app, new RegExp(`"placeGeoid":"${geoid}","displayName":"${name}"`));
    assert.match(app, new RegExp(`"countyMemberships":\\["48465"\\]`));
  }
});
test("Box Canyon has its governed identity and LP201 presentation", () => {
  assert.deepEqual(presentations["4809656"], { lat: 29.5335121, lon: -101.15861 });
  assert.match(app, /GRIDLY_CANONICAL_PLACE_FOCUS_AUTHORITY = "LP201_CERTIFIED_STATEWIDE_PLACE_PRESENTATION_V1"/);
});
test("Val Verde crossing package remains authoritative and county isolated", () => {
  assert.equal(pkg.county, "Val Verde"); assert.equal(pkg.crossingCount, 47); assert.equal(crossings.length, 47);
});
test("LP221 helper composes current county authorities and reports convergence", () => {
  assert.match(app, /expectedCounty = "val-verde-tx"/);
  assert.match(app, /countyAuthorities\.every\(\(county\) => county === expectedCounty\)/);
});
test("transition isolation exposes generation and stale request suppression", () => {
  assert.match(app, /transitionGeneration: Number\(gridlyActiveCountyTransitionGeneration/);
  assert.match(app, /staleCountyRequestSuppressions: Number\(gridlyActiveCountyStaleRequestSuppressions/);
});
test("crossing source and viewport retain independent production authorities", () => {
  assert.match(app, /crossingSourceCounty: sources\?\.countyId/);
  assert.match(app, /viewportAuthority: "live_leaflet_map_getBounds"/);
});
test("watched count is explicitly independent from visible markers", () => {
  assert.match(app, /watchedCountIndependentFromVisibleMarkers: true/);
  assert.match(app, /crossingsWatched: crossingWatch\?\.displayedWatchedCount/);
});
test("LP219.4 active-hazard propagation stages are aggregated, not duplicated", () => {
  assert.match(app, /governed\.lp2194AuthorityAudit\?\.alerts/);
  assert.match(app, /governed\.lp2194AuthorityAudit\?\.kbyg/);
  assert.doesNotMatch(app.slice(app.indexOf("function gridlyValVerdeCommunityRuntimeAudit")), /buildConsumerProjection\(/);
});
test("quiet state is observable without being classified as a defect", () => {
  assert.match(app, /locationContextCount: governed\.locationContextProductionCount/);
});
test("stale, cleared history, and duplicate rejection evidence is exposed", () => {
  for (const field of ["staleIds", "duplicateIds", "inactiveHistoryIds"]) assert.match(app, new RegExp(`${field}: governed`));
});
test("first losing stage covers identity, county, map, crossings, Alerts and KBYG", () => {
  for (const stage of ["identity.selected_area", "county.convergence", "presentation.canonical_coordinate", "crossings.render_lifecycle", "alerts.final_projection_or_dom", "kbyg.final_authority_or_dom"]) assert.ok(app.includes(stage));
});
test("owner browser acceptance remains explicitly required", () => assert.match(app, /ownerBrowserAcceptanceRequired: true/));
