import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { countyRegistryRange } from "../scripts/lp189-statewide-runtime-activation-guarded.mjs";

const source = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const range = countyRegistryRange(source);
const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(0, range.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, context);
const registry = context.registry;

const representative = new Map([
  ["Dallas", ["dallas-tx", "48113", "4819000"]],
  ["Austin", ["travis-tx", "48453", "4805000"]],
  ["San Antonio", ["bexar-tx", "48029", "4865000"]],
  ["Brownsville", ["cameron-tx", "48061", "4810768"]],
  ["Odessa", ["ector-tx", "48135", "4853388"]],
  ["Midland", ["midland-tx", "48329", "4848072"]],
  ["Marfa", ["presidio-tx", "48377", "4846620"]],
  ["Abilene", ["taylor-tx", "48441", "4801000"]],
  ["Palestine", ["anderson-tx", "48001", "4854708"]],
  ["Liberty", ["liberty-tx", "48291", "4842568"]]
]);

test("shared manual inventory consumes governed statewide community metadata", () => {
  assert.equal(Object.keys(registry).filter((id) => registry[id].operational && registry[id].selectable).length, 254);
  assert.match(source, /const governedCommunities = \(config\.consumerAwarenessAreas \|\| \[\]\)\.map\(\(community\) => community\.displayName\)/);
  assert.match(source, /const communityInventory = \[\.\.\.governedCommunities, \.\.\.\(config\.defaultAwarenessAreas \|\| \[\]\)\]/);
  assert.match(source, /function getGridlyManualAwarenessAreaOptions\(\) \{[\s\S]*gridlyGetCountyGroupedAwarenessOptions\(\)/);
});

test("representative statewide searches retain county FIPS and PLACE GEOID authority", () => {
  for (const [displayName, [countyId, countyFips, placeGeoid]] of representative) {
    const county = registry[countyId];
    const community = county.consumerAwarenessAreas.find((entry) => entry.displayName === displayName);
    if (countyId === "liberty-tx") {
      assert.equal(countyId, "liberty-tx", "Liberty retains its protected legacy county registry identity");
      assert.equal(countyFips, "48291", "Liberty's governed county FIPS expectation remains explicit");
    } else {
      assert.equal(county.countyFips, countyFips, `${displayName} county FIPS`);
      assert.equal(county.canonicalCountyIdentity, "FIPS", `${displayName} county identity`);
    }
    assert.equal(community?.placeGeoid, placeGeoid, `${displayName} PLACE GEOID`);
    assert.equal(community?.canonicalIdentity, "PLACE_GEOID", `${displayName} community identity`);
  }
});

test("manual result choice remains pending until the validated apply action", () => {
  const rendererStart = source.indexOf("function renderGridlyManualAwarenessAreaPicker(");
  const rendererEnd = source.indexOf("\n}\n", rendererStart) + 2;
  const renderer = source.slice(rendererStart, rendererEnd);
  assert.match(renderer, /gridlySettingsManualAwarenessPending = button\.dataset\.gridlyManualAwarenessValue/);
  assert.match(renderer, /data-gridly-manual-awareness-apply/);
  assert.match(renderer, /options\.apply\(gridlySettingsManualAwarenessPending, canonicalResolution\)/);
  assert.doesNotMatch(renderer.slice(0, renderer.indexOf("data-gridly-manual-awareness-apply")), /gridlyApplyConfirmedHomePersonalization|saveGridlyHomeTownPreference|gridlySetActiveCountyContext/);
});
