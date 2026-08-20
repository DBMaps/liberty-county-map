import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");

test("statewide Alerts expose an accessible action only for a current resolvable map target", () => {
  assert.match(app, /function gridlyResolveAlertShowOnMapTarget/);
  assert.match(app, /gridlyLp019ResolveAlertRecord\(id\) !== resolvedRecord/);
  assert.match(app, /findGridlyAlertMarker\(coords, markerOptions\)/);
  assert.match(app, /requireIdentityMatch: true/);
  assert.match(app, /source\.consumerSituationId/);
  assert.match(app, /action\.type = "button"/);
  assert.match(app, /action\.setAttribute\("aria-label", `Show/);
  assert.match(app, /action\.textContent = "Show on map"/);
  assert.match(css, /\.gridly-alert-show-on-map:focus-visible/);
});

test("Show on map reuses the existing focus and marker contracts without marker creation or state rewrites", () => {
  const resolver = app.match(/function gridlyResolveAlertShowOnMapTarget[\s\S]*?\n}/)?.[0] || "";
  const focus = app.match(/function focusGridlyAlertIncident[\s\S]*?\n}\n\nfunction focusAlertLocation/)?.[0] || "";
  assert.doesNotMatch(resolver, /L\.marker|fetch\(/);
  assert.match(app, /source: showOnMapAction \? "alerts_show_on_map"/);
  assert.match(focus, /preserveZoom = focus\?\.source === "alerts_show_on_map"/);
  assert.match(focus, /alreadyVisibleNoCameraMove/);
  assert.match(focus, /marker\.openPopup\(\)/);
  assert.match(focus, /closePortraitV2Sheet/);
  assert.doesNotMatch(focus, /setGridlySelectedAwarenessArea|activeCounty\s*=|homeTown\s*=/);
});

test("Fredericksburg control is provider- and city-agnostic", () => {
  const resolver = app.match(/function gridlyResolveAlertShowOnMapTarget[\s\S]*?\n}/)?.[0] || "";
  assert.doesNotMatch(resolver, /Fredericksburg|4827348|US\s*87/i);
  assert.match(resolver, /gridlyLp019OfficialCoords\(resolvedRecord\)/);
  assert.match(resolver, /return Object\.freeze\(\{ id, record: resolvedRecord, coords, marker/);
});
