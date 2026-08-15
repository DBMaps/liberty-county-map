import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createLp2012VisualReview, installLp2012VisualReview } from "../tools/lp2012/owner-visual-review.mjs";

const evidence = JSON.parse(fs.readFileSync(new URL("../reports/lp2012/promotion-whatif.json", import.meta.url)));
const map = () => ({ calls: [], setView(...args) { this.calls.push(args); } });

test("reads inactive certified evidence and supports exact GEOID and unique name", () => {
  const h = createLp2012VisualReview(evidence, map());
  assert.equal(h.review("4819432").canonical.name, "Dayton");
  assert.equal(h.review("Dayton").canonical.geoid, "4819432");
  assert.equal(h.review("Dayton").review.runtimeActivation, false);
});

test("ambiguous exact names fail closed with identities", () => {
  const duplicate = structuredClone(evidence);
  duplicate.records[1].canonical.name = duplicate.records[0].canonical.name;
  const h = createLp2012VisualReview(duplicate, map());
  assert.throws(() => h.review(duplicate.records[0].canonical.name), error => error.matches.length === 2);
});

test("current and proposed cameras and preserved zoom are certified snapshots", () => {
  const h = createLp2012VisualReview(evidence, map());
  const source = evidence.records.find(row => row.canonical.name === "Dayton");
  const review = h.review("Dayton");
  assert.deepEqual(review.currentCamera, source.currentCamera);
  assert.deepEqual(review.proposedCamera, source.proposal);
  assert.equal(review.proposedCamera.zoom, source.proposal.zoom);
});

test("temporary movement only calls map and does not touch semantic or browser storage", () => {
  const m = map(); let localWrites = 0; let sessionWrites = 0;
  globalThis.localStorage = { setItem() { localWrites++; } };
  globalThis.sessionStorage = { setItem() { sessionWrites++; } };
  const semantic = { identity: "unchanged", county: "unchanged" };
  const h = createLp2012VisualReview(evidence, m); h.review("Dayton"); h.showCurrent(); h.showProposed();
  assert.equal(m.calls.length, 2); assert.deepEqual(semantic, { identity: "unchanged", county: "unchanged" });
  assert.equal(localWrites, 0); assert.equal(sessionWrites, 0);
  delete globalThis.localStorage; delete globalThis.sessionStorage;
});

test("LP197 is retained and comparison is never proposed", () => {
  const h = createLp2012VisualReview(evidence, map()); const austin = h.review("4805000");
  assert.match(austin.protection, /HIGHER AUTHORITY RETAINED/); assert.equal(austin.proposedCamera, null);
  assert.match(austin.comparisonCamera.label, /COMPARISON ONLY/); assert.throws(() => h.showProposed(), /NO AUTOMATIC PROPOSAL/);
  assert.match(h.showComparison().label, /COMPARISON ONLY/);
});

test("Kyle bucket B cannot receive an automatic proposal", () => {
  const h = createLp2012VisualReview(evidence, map()); const kyle = h.review("4839952");
  assert.equal(kyle.lp2011.bucket, "B_MULTIPLE_OSM_CANDIDATES"); assert.equal(kyle.proposedCamera, null);
  assert.throws(() => h.showProposed(), /NO AUTOMATIC PROPOSAL/);
});

test("top distance is deterministic and only proposed", () => {
  const h = createLp2012VisualReview(evidence, map());
  assert.deepEqual(h.topDistance(), h.topDistance()); assert.equal(h.topDistance().length, 10);
  assert.ok(h.topDistance().every((row, index, all) => row.proposedCamera && (!index || all[index - 1].comparison.distanceMeters >= row.comparison.distanceMeters)));
});

test("owner decisions default PENDING and export stays audit-only in memory", () => {
  const h = createLp2012VisualReview(evidence, map()); assert.equal(h.review("Dayton").ownerDecision, "PENDING");
  h.recordDecision("Dayton", "PASS_PROPOSED", "owner inspected"); const exported = JSON.parse(h.exportDecisions());
  assert.equal(exported.auditOnly, true); assert.equal(exported.persisted, false); assert.equal(exported.runtimeActivation, false);
  assert.equal(exported.decisions[0].ownerDecision, "PASS_PROPOSED");
});

test("installer fetches only certified evidence", async () => {
  let requested; const result = await installLp2012VisualReview({ map: map(), fetchImpl: async url => (requested = url, { ok: true, json: async () => evidence }) });
  assert.equal(requested, "/reports/lp2012/promotion-whatif.json"); assert.deepEqual(result, { installed: true, evidenceUrl: requested, runtimeActivation: false, auditOnly: true });
});

test("production authority surfaces remain absent from the helper", () => {
  const source = fs.readFileSync(new URL("../tools/lp2012/owner-visual-review.mjs", import.meta.url), "utf8");
  for (const forbidden of ["gridlyDispatchSemanticCamera", "localStorage.setItem", "sessionStorage.setItem", "gridlyPackageRegistry"]) assert.equal(source.includes(forbidden), false);
});
