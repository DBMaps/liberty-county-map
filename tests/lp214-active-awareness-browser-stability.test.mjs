import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import path from "node:path";

test("browser consumer zero remains stable for ten seconds across late secondary writes", { timeout: 30_000 }, async (t) => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    if (/Executable doesn't exist/.test(String(error))) {
      t.skip("Playwright Chromium is not installed in this environment");
      return;
    }
    throw error;
  }
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent('<section data-v2-location-awareness="panel" data-active-awareness-count="0"></section>');
  await page.addScriptTag({ path: path.resolve("js/gridlyActiveAwarenessConvergence.js") });
  const result = await page.evaluate(async () => {
    const summary = {
      crossingsInArea: Array.from({ length: 70 }, (_, id) => ({ id })),
      sharedActiveIssueContract: {
        areaIdentity: "place-4806128", activeIssueCount: 0,
        activeOfficialRoadwayCount: 0, activeCommunityReportCount: 0,
        activeCrossingIssueCount: 0, activeOtherHazardCount: 0,
        officialRoadwaySourceStatus: "HEALTHY_EMPTY", quietEligible: true
      }
    };
    const samples = [];
    const startedAt = performance.now();
    while (performance.now() - startedAt < 10_000) {
      const raw = {
        runtimeMode: "lightweight_only", activeAwarenessCount: 1,
        headline: "Train blocking crossing.", subline: "Allow extra travel time.",
        topAwarenessSelectedRawDetail: { sourceKind: "rail_inventory", item: { id: "inventory-signal" } }
      };
      const governed = window.reconcileGridlyActiveAwarenessWithSharedContract(raw, summary);
      const previousValue = window.gridlyCommunityPulseAuditState?.activeAwareness?.activeAwarenessCount || 0;
      window.gridlyCommunityPulseAuditState = {
        activeAwareness: governed.activeAwareness,
        communityAwarenessSummary: summary,
        renderedPulseHeadline: governed.activeAwareness.headline,
        visiblePrimary: governed.activeAwareness.headline
      };
      window.gridlyTopAwarenessMicrolineState = { communityAwarenessSummary: summary, activeAwarenessCount: governed.activeIssueCount };
      window.recordGridlyActiveAwarenessWrite({ writer: "browser-scheduled-secondary-refresh", previousValue, nextValue: governed.activeIssueCount, canonicalAreaIdentity: governed.contract.areaIdentity, sharedActiveIssueCount: governed.activeIssueCount, rawLightweightCount: governed.activeAwareness.rawLightweightActiveAwarenessCount, sourceType: "rail_inventory", sourceIdentity: "inventory-signal", reason: "10-second-settling-control" });
      samples.push(window.gridlyActiveAwarenessConvergenceAudit());
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return { elapsedMs: performance.now() - startedAt, samples, lineage: window.gridlyActiveAwarenessWriterAudit() };
  });
  assert(result.elapsedMs >= 10_000);
  assert(result.samples.length >= 40);
  assert(result.samples.every((sample) => sample.sharedActiveIssueCount === 0));
  assert(result.samples.every((sample) => sample.lightweightActiveAwarenessCount === 0));
  assert(result.samples.every((sample) => sample.rawLightweightActiveAwarenessCount === 1));
  assert(result.samples.every((sample) => sample.visibleLocationContextIssueCount === 0));
  assert(result.samples.every((sample) => sample.crossingsWatched === 70));
  assert(result.samples.every((sample) => sample.quietEligible === true));
  assert(result.samples.every((sample) => !/Train blocking crossing/i.test(`${sample.visibleHeadline} ${sample.visibleSubline}`)));
  assert(result.lineage.length <= 80);
});
