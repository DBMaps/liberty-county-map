import { expect, test } from "@playwright/test";

const PLACE_CASES = [
  { query: "Dayton", placeGeoid: "4819432", memberships: ["48291"] },
  { query: "Dallas", placeGeoid: "4819000", memberships: ["48085", "48113", "48121", "48257", "48397"] },
  { query: "Austin", placeGeoid: "4805000", memberships: ["48021", "48209", "48453", "48491"] },
  { query: "Abilene", placeGeoid: "4801000", memberships: ["48253", "48441"] },
  { query: "Port Arthur", placeGeoid: "4858820", memberships: ["48245", "48361"] },
  { query: "Pecos", placeGeoid: "4873493", memberships: ["48389"] }
];

async function openRuntime(page) {
  await page.goto("/");
  await page.waitForFunction(() => typeof window.gridlySearchAddress === "function"
    && typeof window.resolveGridlyGovernedBareTexasPlaceQuery === "function");
}

test("physical Android defect cohort publishes canonical statewide PLACE authority at rank one", async ({ page }) => {
  await openRuntime(page);
  const outcomes = await page.evaluate(async (cases) => {
    const rows = [];
    for (const entry of cases) {
      const resolution = window.resolveGridlyGovernedBareTexasPlaceQuery(entry.query);
      const results = await window.gridlySearchAddress(entry.query, { limit: 5 });
      const diagnostics = results.gridlyProviderDiagnostics;
      rows.push({
        query: entry.query,
        resolution,
        resultCount: results.length,
        first: results[0] && {
          title: results[0].title,
          provider: results[0].provider,
          placeGeoid: results[0].placeGeoid,
          countyMemberships: results[0].countyMemberships,
          publishedRank: results[0].searchRank?.publishedRank
        },
        intent: diagnostics?.intent,
        canonicalCount: diagnostics?.canonicalGovernedCandidateCount,
        canonicalConsumed: diagnostics?.governedBarePlaceConsumed,
        remoteAttempts: diagnostics?.variants?.filter((variant) => variant.requestAttempted).length || 0
      });
    }
    return rows;
  }, PLACE_CASES);

  for (const [index, expected] of PLACE_CASES.entries()) {
    const actual = outcomes[index];
    expect(actual.query).toBe(expected.query);
    expect(actual.resolution).toMatchObject({
      matchType: "town",
      community: expected.query,
      placeGeoid: expected.placeGeoid,
      countyMemberships: expected.memberships,
      ambiguous: false
    });
    expect(actual.intent).toBe("explicit_destination");
    expect(actual.canonicalCount).toBe(1);
    expect(actual.canonicalConsumed).toBe(true);
    expect(actual.remoteAttempts).toBe(0);
    expect(actual.resultCount).toBeGreaterThan(0);
    expect(actual.first).toEqual({
      title: expected.query,
      provider: "gridly_canonical_place",
      placeGeoid: expected.placeGeoid,
      countyMemberships: expected.memberships,
      publishedRank: 1
    });
  }
});

test("canonical PLACE rank survives local POI collisions and the five-result cap", async ({ page }) => {
  await openRuntime(page);
  const collisionResults = await page.evaluate(async () => {
    const output = {};
    for (const query of ["Dayton", "Austin", "Port Arthur"]) {
      const results = await window.gridlySearchAddress(query, { limit: 5 });
      output[query] = results.map((result) => ({ title: result.title, provider: result.provider }));
    }
    return output;
  });

  expect(collisionResults.Dayton[0]).toEqual({ title: "Dayton", provider: "gridly_canonical_place" });
  expect(collisionResults.Dayton.some((result) => result.title === "Dayton City Hall")).toBe(true);
  expect(collisionResults.Austin[0]).toEqual({ title: "Austin", provider: "gridly_canonical_place" });
  expect(collisionResults.Austin.some((result) => result.title === "Austin County Courthouse")).toBe(true);
  expect(collisionResults["Port Arthur"][0]).toEqual({ title: "Port Arthur", provider: "gridly_canonical_place" });
});

test("statewide bare PLACE normalization remains punctuation-safe and ambiguity-safe", async ({ page }) => {
  await openRuntime(page);
  const resolutions = await page.evaluate(() => ({
    portArthur: window.resolveGridlyGovernedBareTexasPlaceQuery("  Port   Arthur. "),
    pecosLegalName: window.resolveGridlyGovernedBareTexasPlaceQuery("Town of Pecos"),
    ambiguous: window.resolveGridlyGovernedBareTexasPlaceQuery("Mesquite")
  }));
  expect(resolutions.portArthur).toMatchObject({ community: "Port Arthur", placeGeoid: "4858820" });
  expect(resolutions.pecosLegalName).toMatchObject({ community: "Pecos", placeGeoid: "4873493" });
  expect(resolutions.ambiguous).toBeNull();
});

test("local POI, roadway, and null-result paths remain available", async ({ page }) => {
  await openRuntime(page);
  const results = await page.evaluate(async () => {
    const poi = await window.gridlySearchAddress("Dayton City Hall", { limit: 5 });
    const road = await window.gridlySearchAddress("County Road 677, Dayton, TX", { limit: 5 });
    const empty = await window.gridlySearchAddress("", { limit: 5 });
    return {
      poi: poi.map((result) => ({ title: result.title, provider: result.provider })),
      road: {
        intent: road.gridlyProviderDiagnostics?.intent,
        attempted: road.gridlyProviderDiagnostics?.variants?.some((variant) => variant.requestAttempted) || false
      },
      empty
    };
  });
  expect(results.poi.some((result) => result.title === "Dayton City Hall")).toBe(true);
  expect(results.road).toEqual({ intent: "address", attempted: true });
  expect(results.empty).toEqual([]);
});
