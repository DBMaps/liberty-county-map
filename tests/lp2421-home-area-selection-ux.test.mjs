import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { areas } from "../tools/lp240x/supported-area-identity-audit.mjs";

const source = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const multiCounty = JSON.parse(fs.readFileSync(new URL("../data/generated/lp213-statewide-multi-county-place-audit.json", import.meta.url), "utf8"));

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const body = source.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = body; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`cannot extract ${name}`);
}

test("the shared manual picker attaches its only confirmation to the selected result", () => {
  const builder = functionSource("buildGridlySettingsAwarenessOptionsHtml");
  assert.match(builder, /settings-manual-result-presentation/);
  assert.match(builder, /aria-pressed=/);
  assert.match(builder, /settings-manual-result-confirm/);
  assert.equal((builder.match(/Use this Home Area/g) || []).length, 1);
  assert.doesNotMatch(builder, /Selected area/);
  assert.doesNotMatch(builder, /settings-manual-pending/);
  assert.match(styles, /settings-manual-result-confirm \{ width: 100%; min-height: 48px; white-space: normal; \}/);
});

test("visible Settings search selects first and persists only from its attached confirmation", () => {
  const renderer = functionSource("renderGridlySettingsAwarenessSearchResult");
  const search = functionSource("searchGridlySettingsAwarenessArea");
  const selectionStart = renderer.indexOf('button.addEventListener("click"');
  const confirmationStart = renderer.indexOf('apply.addEventListener("click"');
  const selection = renderer.slice(selectionStart, confirmationStart);
  const confirmation = renderer.slice(confirmationStart);
  assert.match(selection, /gridlySettingsAwarenessSearchPending = candidateKey/);
  assert.doesNotMatch(selection, /gridlySaveCanonicalMultiCountyPlaceHome|selectGridlySettingsAwarenessArea/);
  assert.match(confirmation, /gridlySaveCanonicalMultiCountyPlaceHome/);
  assert.match(confirmation, /selectGridlySettingsAwarenessArea/);
  assert.equal((renderer.slice(0, renderer.indexOf('if \(result.status === "AMBIGUOUS"\)')).match(/Use this Home Area/g) || []).length, 1);
  assert.match(renderer, /aria-pressed/);
  assert.match(search, /gridlySettingsAwarenessSearchPending = null/);
});

test("visible attached CTA executes the recovered transaction and replaces persisted Dallas", () => {
  const rendererSource = functionSource("renderGridlyManualAwarenessAreaPicker");
  const persisted = {
    canonical: { awarenessAreaKey: "dallas", consumerLabel: "Dallas", countyId: "dallas-tx", communityKey: "4819000" },
    settings: { homeTown: "Dallas", awarenessArea: "Dallas", awarenessAreaKey: "dallas", countyId: "dallas-tx" },
    profile: { homeTown: "Dallas", homeTownLabel: "Dallas", awarenessArea: "Dallas", awarenessAreaKey: "dallas" },
    localHomeTown: "Dallas"
  };
  const listeners = {};
  const resultButton = { dataset: { gridlyManualAwarenessValue: "Dayton", gridlyManualAwarenessCountyId: "liberty-tx" }, addEventListener(type, listener) { listeners.result = listener; } };
  const applyButton = { addEventListener(type, listener) { listeners.apply = listener; } };
  const container = {
    set innerHTML(value) { this.markup = value; },
    querySelector(selector) {
      if (selector === "[data-gridly-manual-awareness-search]") return null;
      if (selector === "[data-gridly-manual-awareness-apply]") return context.gridlySettingsManualAwarenessPending ? applyButton : null;
      return null;
    },
    querySelectorAll(selector) { return selector === "[data-gridly-manual-awareness-value]" ? [resultButton] : []; }
  };
  const context = {
    gridlySettingsManualAwarenessQuery: "Dayton",
    gridlySettingsManualAwarenessPending: "",
    gridlySettingsManualAwarenessPendingCountyId: "",
    getGridlySettingsAwarenessAreaDisplay: () => ({ storageValue: persisted.settings.homeTown }),
    buildGridlySettingsAwarenessOptionsHtml: () => "picker",
    resolveGridlyManualAwarenessAreaSearch: () => ({ groups: [{ countyId: "liberty-tx", countyLabel: "Liberty County", communities: [{ key: "dayton", value: "Dayton", label: "Dayton", placeGeoid: "4819432" }] }] }),
    gridlyManualAwarenessSelectionMatches: (community, group, value, countyId) => community.value === value && group.countyId === countyId,
    gridlyManualAwarenessMembershipCountyId: (_community, group) => group.countyId,
    gridlySaveCanonicalMultiCountyPlaceHome: () => false,
    selectGridlySettingsAwarenessArea(value) {
      assert.equal(value, "Dayton");
      persisted.canonical = null;
      persisted.settings = { homeTown: "Dayton", awarenessArea: "Dayton", awarenessAreaKey: "dayton", countyId: "liberty-tx" };
      persisted.profile = { homeTown: "Dayton", homeTownLabel: "Dayton", awarenessArea: "Dayton", awarenessAreaKey: "dayton" };
      persisted.localHomeTown = "Dayton";
      return true;
    }
  };
  vm.createContext(context);
  vm.runInContext(`${rendererSource};this.renderGridlyManualAwarenessAreaPicker=renderGridlyManualAwarenessAreaPicker`, context);

  context.renderGridlyManualAwarenessAreaPicker(container);
  assert.equal(persisted.settings.homeTown, "Dallas", "Dallas is persisted before candidate click");
  listeners.result();
  assert.equal(persisted.settings.homeTown, "Dallas", "candidate selection remains pending only");
  listeners.apply();
  assert.deepEqual(persisted.settings, { homeTown: "Dayton", awarenessArea: "Dayton", awarenessAreaKey: "dayton", countyId: "liberty-tx" });
  assert.equal(context.getGridlySettingsAwarenessAreaDisplay().storageValue, "Dayton", "rerender reads persisted Dayton");
  assert.equal(JSON.parse(JSON.stringify(persisted)).settings.homeTown, "Dayton", "rehydration retains Dayton");
  assert.equal(context.gridlySettingsManualAwarenessPending, "", "pending state clears after the successful save");
});

test("ordinary saves retire a conflicting canonical Home Area owner before writing Settings and profile", () => {
  const saver = functionSource("saveGridlyHomeTownPreference");
  assert.match(saver, /persistedCanonicalAreaKey && persistedCanonicalAreaKey !== area\.key/);
  assert.match(saver, /removeItem\(GRIDLY_LP0517_HOME_PERSONALIZATION_STORAGE_KEY\)/);
  assert.ok(saver.indexOf("removeItem(GRIDLY_LP0517_HOME_PERSONALIZATION_STORAGE_KEY)") < saver.indexOf("saveGridlySettingsPreferences"));
  assert.match(saver, /homeTown, awarenessArea: homeTown, awarenessAreaKey: area\.key, countyId: resolvedCountyId/);
  assert.match(saver, /saveGridlyUserProfile\(\{[\s\S]*homeTownLabel: area\.label[\s\S]*awarenessAreaCountyId: resolvedCountyId/);
  assert.match(saver, /gridlySafeLocalStorageSet\("gridlyHomeTown", homeTown\)/);
});

test("Dayton and Tarkington retain the identity needed by the shared commit", () => {
  const dayton = areas.find((area) => area.key === "dayton");
  const tarkington = areas.find((area) => area.key === "tarkington");
  assert.deepEqual({ storageValue: dayton?.storageValue, countyId: dayton?.countyId, placeGeoid: dayton?.placeGeoid }, {
    storageValue: "Dayton",
    countyId: "liberty-tx",
    placeGeoid: "4819432"
  });
  assert.deepEqual({ storageValue: tarkington?.storageValue, countyId: tarkington?.countyId, placeGeoid: tarkington?.placeGeoid }, {
    storageValue: "Tarkington",
    countyId: "liberty-tx",
    placeGeoid: null
  });
});

test("canonical multi-county controls remain unique with governed memberships intact", () => {
  const expected = {
    Austin: ["bastrop-tx", "hays-tx", "travis-tx", "williamson-tx"],
    "Port Arthur": ["jefferson-tx", "orange-tx"],
    Abilene: ["jones-tx", "taylor-tx"]
  };
  for (const [label, counties] of Object.entries(expected)) {
    const row = multiCounty.inventory.find((candidate) => candidate.label === label);
    assert.ok(row, `${label} remains canonical`);
    assert.deepEqual(row.members.map((member) => member.countyId).sort(), counties);
    assert.equal(new Set(row.members.map((member) => member.placeGeoid)).size, 1, `${label} has one PLACE identity`);
  }
  assert.match(functionSource("filterGridlyManualAwarenessAreas"), /collapsedGeoids/);
  assert.doesNotMatch(functionSource("gridlySaveCanonicalMultiCountyPlaceHome"), /countyMemberships\s*\[\s*0\s*\]/);
});

test("single-county and governed non-PLACE candidates use the same shared presentation", () => {
  const dayton = areas.find((area) => area.key === "dayton");
  const tarkington = areas.find((area) => area.key === "tarkington");
  assert.match(String(dayton?.placeGeoid), /^48\d{5}$/);
  assert.equal(dayton?.countyId, "liberty-tx");
  assert.equal(tarkington?.placeGeoid, null);
  assert.equal(tarkington?.countyId, "liberty-tx");
  assert.equal((source.match(/settings-manual-result-presentation/g) || []).length >= 2, true);
});

test("saved Home Area display and close-without-confirmation semantics remain separate", () => {
  const control = functionSource("renderGridlySettingsAwarenessControl");
  const opener = functionSource("openGridlyPrimaryHomeAreaChooser");
  assert.match(control, /getGridlySettingsAwarenessAreaDisplay/);
  assert.match(control, /settingsAwarenessAreaValue/);
  assert.match(opener, /gridlySettingsManualAwarenessPending = ""/);
  assert.doesNotMatch(opener, /localStorage|selectGridlySettingsAwarenessArea|gridlySaveCanonicalMultiCountyPlaceHome/);
});
