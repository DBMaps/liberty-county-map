import { expect, test } from "@playwright/test";

async function submitBareDallas(page, action) {
  const input = page.locator("#gridlyAddressSearchInput");
  await input.evaluate((node) => {
    node.value = "Dallas";
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
  if (action === "click") {
    await page.locator("#gridlyRemoteSearchBtn").evaluate((node) => node.click());
  } else {
    await input.press("Enter");
  }
  await expect(page.locator("#gridlySearchResults .gridly-search-section-title")).toHaveText("Best matches");
  await expect(page.locator("#gridlySearchResults .gridly-search-result-title", { hasText: "Dallas" })).toBeVisible();
}

test("Search button and Enter consume governed Dallas and preserve its publication", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => typeof window.resolveGridlyGovernedBareTexasPlaceQuery === "function");

  const authority = await page.evaluate(() => window.resolveGridlyGovernedBareTexasPlaceQuery("Dallas"));
  expect(authority).toMatchObject({
    status: "RESOLVED_CANONICAL_MULTI_COUNTY_PLACE",
    community: "Dallas",
    placeGeoid: "4819000",
    operational: true,
    ambiguous: false,
    countyIds: ["collin-tx", "dallas-tx", "denton-tx", "kaufman-tx", "rockwall-tx"]
  });

  await submitBareDallas(page, "click");
  await expect(page.locator("#gridlySearchResults")).not.toContainText("No matching destination found");
  const trace = await page.evaluate(() => window.gridlyDestinationInteractiveSearchTrace());
  expect(trace).toMatchObject({
    governedBarePlaceStatus: "RESOLVED_CANONICAL_MULTI_COUNTY_PLACE",
    governedBarePlaceConsumed: true,
    runtimeBridgeEligible: false,
    runtimeBridgeAttempted: false
  });
  expect(trace.canonicalGovernedCandidateCount).toBeGreaterThan(0);
  expect(trace.mergedCandidateCount).toBeGreaterThan(0);
  expect(trace.deduplicatedCandidateCount).toBeGreaterThan(0);
  expect(trace.finalPublishedCandidateCount).toBeGreaterThan(0);
  expect(trace.finalPublishedCandidates[0]).toMatchObject({
    title: "Dallas",
    provider: "gridly_canonical_place",
    placeGeoid: "4819000",
    countyMemberships: ["48085", "48113", "48121", "48257", "48397"]
  });

  const input = page.locator("#gridlyAddressSearchInput");
  await input.focus();
  await input.click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#gridlySearchResults .gridly-search-result-title", { hasText: "Dallas" })).toBeVisible();

  await submitBareDallas(page, "enter");
  await expect(page.locator("#gridlySearchResults .gridly-search-result-title", { hasText: "Dallas" })).toBeVisible();
});
