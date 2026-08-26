import assert from "node:assert/strict";
import test from "node:test";
import { areas, registry, report } from "../tools/lp240x/supported-area-identity-audit.mjs";

const byKey = new Map(areas.map((area) => [area.key, area]));
const knownCounty = (countyId) => Boolean(registry[countyId]);
const currentManualValidator = (area, countyId = area?.countyId) => Boolean(area && knownCounty(countyId) && area.countyId === countyId && (
  (area.countyWide === true) || Boolean(area.placeGeoid) || area.sanAntonioRegion === true
));

test("inventory is deterministic and reconciles to LP239 unique PLACE authority", () => {
  assert.equal(report.counts.supportedAwarenessAreaCount, 2342);
  assert.equal(report.counts.canonicalPlaceUniqueCount, 1859);
  assert.equal(Object.values(report.classifications).reduce((sum, count) => sum + count, 0), 2342);
  assert.equal(report.counts.withPlaceGeoidCount + report.counts.withoutPlaceGeoidCount, 2342);
});

test("A Dayton accepts; B Tarkington and C governed non-PLACE reproduce current rejection", () => {
  assert.equal(currentManualValidator(byKey.get("dayton")), true);
  assert.equal(currentManualValidator(byKey.get("tarkington")), false);
  assert.equal(currentManualValidator(byKey.get("new-caney")), false);
  assert.equal(report.counts.currentValidatorRejectedEligibleCount, 20);
});

test("D arbitrary, E unknown county, and F unknown key fail closed", () => {
  assert.equal(currentManualValidator({ key: "invented", countyId: "liberty-tx" }), false);
  assert.equal(currentManualValidator(byKey.get("dayton"), "unknown-tx"), false);
  assert.equal(currentManualValidator(undefined, "liberty-tx"), false);
});

test("G county-wide accepts and H fallback remains ineligible", () => {
  assert.equal(currentManualValidator(byKey.get("liberty-county")), true);
  assert.equal(byKey.get("other").fallback, true);
  assert.equal(report.counts.homeAreaEligibleCount, 2341);
});

test("I multi-county canonical PLACE remains represented by governed memberships", () => {
  const katyRows = areas.filter((area) => area.placeGeoid === "4838476");
  assert.ok(katyRows.length > 1);
  assert.ok(katyRows.every((area) => currentManualValidator(area)));
  assert.ok(new Set(katyRows.map((area) => area.countyId)).size > 1);
});

test("J canonical rehydration validates structurally; K existing schema can carry but cannot validate non-PLACE", () => {
  const dayton = byKey.get("dayton");
  const rehydratedDayton = { countyId: dayton.countyId, communityKey: dayton.placeGeoid, awarenessAreaKey: dayton.key };
  assert.match(rehydratedDayton.communityKey, /^48\d{5}$/);
  assert.equal(currentManualValidator(dayton), true);
  const tarkingtonModel = { countyId: "liberty-tx", communityKey: "tarkington", awarenessAreaKey: "tarkington", consumerLabel: "Tarkington", identityType: null, canonicalRegionId: null };
  assert.equal(tarkingtonModel.awarenessAreaKey, "tarkington");
  assert.equal(currentManualValidator(byKey.get(tarkingtonModel.awarenessAreaKey)), false);
});
