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

test("78205 manual action opens the focused statewide picker without Settings or state mutation", () => {
  const render = extractFunction("gridlyLp0516Render");
  const transition = extractFunction("gridlyLp0516OpenManualAwarenessAreaPicker");

  assert.match(render, /action === 'manual'\) \{ gridlyLp0516OpenManualAwarenessAreaPicker\(\); \}/);
  assert.match(render, /manual_picker[\s\S]*Choose your home area[\s\S]*Search for your Texas community\.[\s\S]*data-gridly-lp0516-manual-picker/);
  assert.match(render, /renderGridlyManualAwarenessAreaPicker\(manualPicker,[\s\S]*consumerFlow: true/);
  assert.match(transition, /state\.previousStep = state\.step[\s\S]*state\.step = "manual_picker"/);
  assert.doesNotMatch(transition, /openSettingsSurfaceFromDock|openGridlySettingsAvailableAreaPicker|settingsModal|gridlyCloseLp0516ZipConfirmationPrototype/);
  assert.doesNotMatch(transition, /gridlyApplyConfirmedHomePersonalization|saveGridlyHomeTownPreference|gridlySetActiveCountyContext/);
});

test("manual search and selection stay pending; Back preserves ZIP state; apply uses governed identity", () => {
  const inventory = extractFunction("getGridlyManualAwarenessAreaOptions");
  const renderer = extractFunction("renderGridlyManualAwarenessAreaPicker");
  const flow = extractFunction("gridlyLp0516Render");
  const apply = extractFunction("gridlyLp0516ApplyManualAwarenessArea");

  assert.match(inventory, /gridlyGetCountyGroupedAwarenessOptions\(\)/);
  assert.match(renderer, /gridlySettingsManualAwarenessPending = button\.dataset\.gridlyManualAwarenessValue/);
  assert.doesNotMatch(renderer.slice(0, renderer.indexOf('data-gridly-manual-awareness-apply')), /saveGridlyHomeTownPreference|gridlySetActiveCountyContext|gridlyApplyConfirmedHomePersonalization/);
  assert.match(flow, /action === 'manualBack'[\s\S]*state\.step = state\.previousStep \|\| 'entry'/);
  assert.doesNotMatch(flow.match(/action === 'manualBack'[\s\S]*?else if \(action === 'confirm'/)?.[0] || '', /zipInput\s*=/);
  assert.match(apply, /consumerAwarenessAreas[\s\S]*governedCommunity\?\.placeGeoid/);
  assert.match(apply, /countyId: area\.countyId/);
  assert.match(apply, /gridlyApplyConfirmedHomePersonalization/);
  assert.match(apply, /resolutionMethod: "manual_governed_area"/);
});
