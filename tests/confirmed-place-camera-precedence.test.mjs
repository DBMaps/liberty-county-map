import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const projection = JSON.parse(fs.readFileSync(new URL("../data/generated/gridly-statewide-consumer-community-projection-v1.json", import.meta.url), "utf8"));
const presentation = JSON.parse(fs.readFileSync(new URL("../data/generated/gridly-statewide-place-presentation-v1.json", import.meta.url), "utf8"));

function body(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const brace = source.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

test("confirmed PLACE persistence hydrates county support without taking camera ownership", () => {
  const apply = body("gridlyApplyConfirmedHomePersonalization");
  assert.match(apply, /preserveSemanticCamera: validation\.area\.countyWide !== true/);
  assert.ok(apply.indexOf("saveGridlyHomeTownPreference") < apply.indexOf("gridlyFocusConfirmedHomeSelection"), "support hydration precedes the final PLACE camera");

  const save = body("saveGridlyHomeTownPreference");
  assert.match(save, /gridlySetActiveCountyContext\(resolvedCountyId, \{ preserveSemanticCamera: options\.preserveSemanticCamera === true \}\)/);
  assert.match(save, /fitMap: options\.preserveSemanticCamera !== true/);

  const countyContext = body("gridlySetActiveCountyContext");
  assert.match(countyContext, /if \(options\.preserveSemanticCamera !== true\) gridlyFitMapToActiveCountyContext/);
  const awareness = body("applyGridlyHomeTownAwarenessContext");
  assert.ok(awareness.indexOf("renderGridlyAwarenessMapIdentity") < awareness.indexOf("if (!fitMap) return true"), "identity support initializes without moving the map");
  assert.ok(awareness.indexOf("if (!fitMap) return true") < awareness.indexOf("gridlyDispatchSemanticCamera"), "camera dispatch is suppressed during PLACE support hydration");
});

test("explicit countywide confirmation retains COUNTY_GEOMETRY_FIT ownership", () => {
  const apply = body("gridlyApplyConfirmedHomePersonalization");
  assert.match(apply, /preserveSemanticCamera: validation\.area\.countyWide !== true/);
  const dispatch = body("gridlyDispatchSemanticCamera");
  assert.match(dispatch, /if \(area\.countyWide !== true\) return false/);
  assert.match(dispatch, /map\.fitBounds\(bounds/);
  assert.match(dispatch, /semanticLevel: "COUNTYWIDE"/);
});

test("statewide control PLACE targets remain unchanged and governed at zoom 13", () => {
  const expected = {
    Dayton: [30.0131768, -94.9360035],
    Liberty: [30.0388343, -94.7888034],
    Palestine: [31.7545115, -95.6469527],
    Tyler: [32.3173339, -95.3063994],
    Waco: [31.5579941, -97.1897498]
  };
  for (const [name, coordinates] of Object.entries(expected)) {
    const community = projection.communities.find((entry) => entry.displayName === name);
    assert.ok(community, `${name} identity exists`);
    const target = presentation.places[community.placeGeoid];
    assert.deepEqual([target.lat, target.lon], coordinates, `${name} governed camera source is unchanged`);
  }
  assert.match(source, /\{ key: "dayton", label: "Dayton", storageValue: "Dayton", countyId: "liberty-tx", lat: 30\.0466, lng: -94\.8852, radiusMiles: 8, startupZoom: 14, source: "existing local app anchor" \}/);
  assert.match(source, /const GRIDLY_TOWN_STARTUP_ZOOM = 13;/);
});

test("LP197 and canonical multi-county PLACE dispatch remain ahead of county geometry", () => {
  for (const name of ["Dallas", "Fort Worth", "Austin", "El Paso"]) {
    const community = projection.communities.find((entry) => entry.displayName === name);
    assert.ok(community && presentation.places[community.placeGeoid], `${name} governed PLACE camera remains available`);
  }
  const dispatch = body("gridlyDispatchSemanticCamera");
  assert.ok(dispatch.indexOf("if (placeGeoid)") < dispatch.indexOf("if (area.countyWide !== true) return false"));
  assert.doesNotMatch(dispatch.slice(dispatch.indexOf("if (placeGeoid)"), dispatch.indexOf("if (area.countyWide !== true) return false")), /fitBounds/);
});
