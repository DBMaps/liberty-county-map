import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
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
