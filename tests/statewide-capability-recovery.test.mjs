import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { certify } from "../tools/certify-statewide-capability-recovery.mjs";

test("254 county bounds, containment, and zero-write hazard placement certify", () => {
  const result = certify();
  assert.equal(result.countyCount, 254);
  assert.equal(result.uniqueFips, 254);
  assert.equal(result.runtimeBounds, 254);
  assert.equal(result.containmentCorrect, 254);
  assert.equal(result.placementSuccesses, 254);
  assert.equal(result.persistenceWrites, 0);
});

test("Waco resolves to governed McLennan metadata without crossing runtime", () => {
  const { waco } = certify();
  assert.deepEqual([waco.countyId, waco.countyFips, waco.community, waco.placeGeoid], ["mclennan-tx", "48309", "Waco", "4876000"]);
  assert.equal(waco.coverageInvalid, false);
  assert.equal(waco.crossingRuntimeRequired, false);
  assert.equal(waco.persistenceWriteAttempted, false);
});

test("runtime uses governed bounds for pruning and polygons for final truth", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  const loader = fs.readFileSync("js/gridlyLp0361cRuntimeCountyGeometryPackageAudit.js", "utf8");
  assert.match(app, /getCountyBoundsById/);
  assert.match(app, /gridlyAuthoritativePointInGeometry/);
  assert.match(app, /inclusive-deterministic-lowest-county-id/);
  assert.match(loader, /getCountyBoundsById/);
  assert.match(loader, /GOVERNED_COUNTY_COUNT = 254/);
});
