import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const bodyStart = source.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

test("ZIP manual action transitions into the existing statewide picker without applying state", () => {
  const render = extractFunction("gridlyLp0516Render");
  const transition = extractFunction("gridlyLp0516OpenManualAwarenessAreaPicker");

  assert.match(render, /action === 'manual'\) \{ gridlyLp0516OpenManualAwarenessAreaPicker\(\); \}/);
  assert.match(transition, /gridlyCloseLp0516ZipConfirmationPrototype\(\)/);
  assert.match(transition, /openSettingsSurfaceFromDock\?\.\("zip_confirmation_manual"\)/);
  assert.match(transition, /openGridlySettingsAvailableAreaPicker\?\.\(settingsRoot\)/);
  assert.doesNotMatch(transition, /gridlyApplyConfirmedHomePersonalization|saveGridlyHomeTownPreference|gridlySetActiveCountyContext/);
});

test("manual picker retains statewide governed inventory and explicit apply path", () => {
  const inventory = extractFunction("getGridlyManualAwarenessAreaOptions");
  const renderer = extractFunction("renderGridlyManualAwarenessAreaPicker");
  const apply = extractFunction("selectGridlySettingsAwarenessArea");

  assert.match(inventory, /gridlyGetCountyGroupedAwarenessOptions\(\)/);
  assert.match(renderer, /gridlySettingsManualAwarenessPending = button\.dataset\.gridlyManualAwarenessValue/);
  assert.match(renderer, /selectGridlySettingsAwarenessArea\(gridlySettingsManualAwarenessPending/);
  assert.match(apply, /gridlyResolveCountyIdForAwarenessArea/);
});
