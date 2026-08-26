import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { areas, registry, report } from "../tools/lp240x/supported-area-identity-audit.mjs";

const source = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const bodyStart = source.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

const byKey = Object.fromEntries(areas.map((area) => [area.key, area]));
const countyFips = Object.fromEntries(Object.entries(registry).map(([countyId, county]) => [countyId, county.countyFips || county.consumerAwarenessAreas?.[0]?.countyMemberships?.find((value) => /^48\d{3}$/.test(String(value))) || ""]));
const context = { GRIDLY_AWARENESS_AREA_BY_KEY: byKey, GRIDLY_COUNTY_REGISTRY: registry, GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID: countyFips, gridlyNormalizeCountyId: (value) => String(value || ""), Object, String, Number, Set };
vm.createContext(context);
vm.runInContext(`${extractFunction("gridlyLp0517ResolveGovernedSelectedIdentity")}\n${extractFunction("gridlyLp240ResolveGovernedHomeIdentity")}`, context);

function recordFor(area) {
  return { countyId: area.countyId, awarenessAreaKey: area.key, communityKey: area.placeGeoid || area.key, communityLabel: area.label, consumerLabel: area.label };
}

test("all 20 formerly rejected and all 29 governed non-PLACE identities resolve exactly", () => {
  const nonPlace = areas.filter((area) => !area.placeGeoid && !area.countyWide && !area.fallback);
  const generic = nonPlace.filter((area) => !area.sanAntonioRegion);
  assert.equal(generic.length, 20);
  assert.equal(nonPlace.length, 29);
  for (const area of generic) {
    const result = context.gridlyLp240ResolveGovernedHomeIdentity(recordFor(area), area);
    assert.equal(result?.identityClass, "GOVERNED_NON_PLACE", area.key);
    assert.equal(result?.stableIdentity, `${area.countyId}:${area.key}`, area.key);
  }
  assert.equal(report.counts.currentValidatorRejectedEligibleCount, 20);
});

test("Tarkington and ordinary/Houston controls use registered county:key authority", () => {
  for (const key of ["tarkington", "new-caney", "porter", "moss-hill", "raywood", "houston-downtown-midtown"]) {
    const area = byKey[key];
    const result = context.gridlyLp240ResolveGovernedHomeIdentity(recordFor(area), area);
    assert.equal(result?.stableIdentity, `${area.countyId}:${key}`, key);
  }
});

test("canonical PLACE authority remains primary", () => {
  for (const key of ["dayton"]) {
    const area = byKey[key];
    assert.equal(context.gridlyLp240ResolveGovernedHomeIdentity(recordFor(area), area)?.identityClass, "CANONICAL_PLACE");
  }
  for (const placeGeoid of ["4838476", "4841980", "4856348"]) {
    const rows = areas.filter((area) => area.placeGeoid === placeGeoid);
    assert.ok(rows.length > 1, placeGeoid);
    assert.ok(rows.every((area) => context.gridlyLp240ResolveGovernedHomeIdentity(recordFor(area), area)?.identityClass === "CANONICAL_PLACE"));
  }
});

test("non-PLACE trust boundary rejects fabricated and conflicting records", () => {
  const area = byKey.tarkington;
  const base = recordFor(area);
  const invalid = [
    { ...base, communityKey: "invented" },
    { ...base, awarenessAreaKey: "invented" },
    { ...base, countyId: "unknown-tx" },
    { ...base, countyId: "harris-tx" },
    { ...base, consumerLabel: "Invented" },
    { ...base, lat: area.lat + 1 },
    { ...base, communityKey: "4899999" },
    { ...base, identityType: "PLACE_GEOID" },
    { ...base, canonicalRegionId: "4819432" }
  ];
  for (const candidate of invalid) assert.equal(context.gridlyLp240ResolveGovernedHomeIdentity(candidate), null);
  assert.equal(context.gridlyLp240ResolveGovernedHomeIdentity(recordFor(byKey["liberty-county"])), null);
  assert.equal(context.gridlyLp240ResolveGovernedHomeIdentity(recordFor(byKey.other)), null);
});

test("statewide inventory reconciles with zero eligible class gaps after repair", () => {
  const genericAccepted = areas.filter((area) => !area.placeGeoid && !area.countyWide && !area.fallback && !area.sanAntonioRegion)
    .filter((area) => context.gridlyLp240ResolveGovernedHomeIdentity(recordFor(area), area)).length;
  const acceptedEligibleCount = report.counts.currentValidatorAcceptedCount + genericAccepted;
  assert.deepEqual({ supported: areas.length, eligible: report.counts.homeAreaEligibleCount, accepted: acceptedEligibleCount, rejected: report.counts.homeAreaEligibleCount - acceptedEligibleCount }, { supported: 2342, eligible: 2341, accepted: 2341, rejected: 0 });
});

test("save validation, startup rehydration, and passive audit use the shared resolver", () => {
  const validator = extractFunction("gridlyLp0517ValidateHomeRecord");
  const reader = extractFunction("gridlyReadHomePersonalizationRecord");
  const audit = extractFunction("gridlyGovernedHomeIdentityAcceptanceAudit");
  assert.match(validator, /gridlyLp240ResolveGovernedHomeIdentity\(record, area\)/);
  assert.match(reader, /gridlyLp0517ValidateHomeRecord\(parsed\)/);
  assert.match(audit, /gridlyLp0517ValidateHomeRecord\(record\)/);
  assert.match(audit, /JSON\.parse\(JSON\.stringify\(record\)\)/);
});
