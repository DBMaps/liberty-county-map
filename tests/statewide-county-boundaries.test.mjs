import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { certify } from "../tools/certify-statewide-county-boundaries.mjs";

test("all governed county identities, geometries, containment points, and polygon renders certify", () => {
  const result = certify();
  assert.deepEqual([result.countyCount, result.identityMatches, result.validGeometries, result.containmentMatches, result.renderPasses], [254, 254, 254, 254, 254]);
  assert.equal(result.mclennan.countyFips, "48309");
  assert.equal(result.mclennan.containmentResolvedCountyId, "mclennan-tx");
});

test("County consumer mode owns a real governed GeoJSON overlay and polygon-derived fit", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  assert.match(app, /activeGeoFilter !== "county"/);
  assert.match(app, /L\.geoJSON\(activeGeojson/);
  assert.match(app, /polygonLayer\?\.getBounds\?\.\(\)/);
  assert.match(app, /renderGridlyCountyBoundaryOverlay\(`filter-change:/);
  assert.match(app, /gridlyGetCountyBoundaryRenderSnapshot/);
  assert.doesNotMatch(app, /L\.rectangle\([^)]*county/i);
});

test("County exits clear the owned layer and hazard layers remain independent", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  assert.match(app, /gridlyCountyBoundaryOverlayLayer\.clearLayers\(\)/);
  assert.match(app, /unifiedIncidentLayer = L\.layerGroup\(\)\.addTo\(map\)/);
  assert.match(app, /crossingLayer = L\.layerGroup\(\)\.addTo\(map\)/);
});
