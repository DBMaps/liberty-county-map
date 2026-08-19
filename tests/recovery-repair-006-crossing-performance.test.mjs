import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

test("forced transition refreshes cannot bypass an identical semantic render signature", () => {
  assert.match(app, /crossingDataChangeSignature === gridlyLastCrossingRenderDataSignature[\s\S]*preliminaryViewportSignature === gridlyLastCrossingRenderViewportSignature/);
  assert.match(app, /skippedBeforeInventoryFilter: true/);
  assert.match(app, /if \(renderSignature === lastRender\.signature\) \{/);
  assert.doesNotMatch(app, /if \(!options\.force && renderSignature === lastRender\.signature\)/);
  assert.match(app, /unchangedSemanticRenderSkipCount \+= 1/);
  assert.match(app, /unchangedSemanticRenderSkipCount: gridlyCrossingRenderAuditState\.unchangedSemanticRenderSkipCount/);
  assert.match(app, /renderMode: "unchanged-skip"/);
});

test("the render signature retains every governing presentation input", () => {
  const signatureBuilder = app.slice(
    app.indexOf("function buildCrossingRenderSignature"),
    app.indexOf("function isGridlyPublicRoadwayCrossing")
  );
  for (const requiredInput of [
    "activeGeoFilter",
    "showAllCrossingsLayer",
    "savedRouteCrossingIds.size",
    "crossingRenderCrossingsVersion",
    "crossingRenderReportsVersion",
    "crossingRenderFilterVersion",
    "visibilityPolicy?.renderMode",
    "visibilityPolicy?.allowMarkers",
    "zoom",
    "boundsKey",
    "visibleCrossings.length",
    "visibleCrossings.map"
  ]) assert.ok(signatureBuilder.includes(requiredInput), `signature must retain ${requiredInput}`);
});

test("the repair changes no crossing qualification or source governance", () => {
  assert.match(app, /const activeCountyCrossings = gridlyV921Phase\("input record acquisition"/);
  assert.match(app, /getGridlyPolicyVisibleCrossings\(\{/);
  assert.match(app, /buildCrossingRenderSignature\(prioritizedVisibleCrossings, visibilityPolicy, bounds\)/);
});
