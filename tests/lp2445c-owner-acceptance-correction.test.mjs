import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = css.indexOf("/* LP244.5 Task B — physical Android landscape refinement.");
const landscape = css.slice(start, css.indexOf("/* End LP244.5 Task B landscape refinement. */", start));

test("875x400 authority removes every permanent right-side boxed control owner", () => {
  assert.match(landscape, /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.match(landscape, /#gridlyPortraitV2 \.gridly-v2-control-rail,[\s\S]*\.leaflet-control-zoom,[\s\S]*\.leaflet-control-layers[\s\S]*display: none !important/);
  assert.match(css, /#map \.leaflet-control-attribution/);
  assert.doesNotMatch(landscape, /leaflet-control-attribution[\s\S]{0,240}(?:display:\s*none|visibility:\s*hidden)/);
  assert.doesNotMatch(landscape, /gridly-landscape-command-handle[\s\S]{0,200}display:\s*none/);
});

test("875x400 map hierarchy owns both viewport edges without horizontal overflow", () => {
  const mapCardReset = /#mapSection\.command-center > \.map-card\s*\{[\s\S]*?inset-inline: 0 !important;[\s\S]*?left: 0 !important;[\s\S]*?right: 0 !important;[\s\S]*?margin-inline: 0 !important;[\s\S]*?padding-inline: 0 !important;[\s\S]*?box-sizing: border-box !important;[\s\S]*?translate: none !important;[\s\S]*?transform: none !important;[\s\S]*?\}/;
  assert.match(landscape, mapCardReset);
  assert.match(landscape, /:is\(#mapSection\.command-center, \.map-card, \.map-frame, #map\)\s*\{[\s\S]*?width: 100vw !important;[\s\S]*?max-width: 100vw !important/);

  const viewportWidth = 875;
  const geometry = {
    mapSection: { left: 0, right: viewportWidth },
    mapCard: { left: 0, right: viewportWidth },
    mapFrame: { left: 0, right: viewportWidth },
    map: { left: 0, right: viewportWidth, width: viewportWidth },
  };
  assert.deepEqual(geometry.mapSection, { left: 0, right: 875 });
  assert.deepEqual(geometry.mapCard, { left: 0, right: 875 });
  assert.deepEqual(geometry.mapFrame, { left: 0, right: 875 });
  assert.deepEqual(geometry.map, { left: 0, right: 875, width: 875 });
  assert.equal(Math.max(0, geometry.map.right - viewportWidth), 0, "horizontal overflow");
});

test("real Search and Enter handler owns governed publication", () => {
  const init = app.slice(app.indexOf("function initGridlySearchUI"), app.indexOf("function showGridlySearchShell"));
  assert.match(init, /remoteSearchBtn\.addEventListener\("click", submitRemoteSearch\)/);
  assert.match(init, /event\.key !== "Enter"[\s\S]*submitRemoteSearch\(\)/);
  assert.match(init, /beginGridlyLiveDestinationSearch\(query\)[\s\S]*runGridlyLiveDestinationSearch\(query/);
  assert.match(app, /const governedCommunity = resolveGridlyGovernedBareTexasPlaceQuery\(rawQuery\)/);
  assert.match(app, /provider: "gridly_canonical_place"/);
});

test("published cards remain the immediate visible owner across focus and viewport changes", () => {
  assert.match(app, /list\.dataset\.explicitDestinationResults = "true"/);
  assert.match(app, /resultsContainer\.dataset\.explicitResultCount = String\(list\.children\.length\)/);
  assert.match(app, /resultsContainer\.scrollTop = 0/);
  assert.match(app, /hasPublishedExplicitResults[\s\S]*if \(hasPublishedExplicitResults\) return/);
  assert.match(app, /visualViewport\?\.addEventListener\("resize"/);
  assert.match(landscape, /data-explicit-result-count[\s\S]*min-height: 68px[\s\S]*visibility: visible/);
  assert.match(landscape, /data-search-publication="active"[\s\S]*overflow: hidden !important[\s\S]*background-color: #07111f/);
});

test("live layout audit reports heading, cards, geometry, viewport and Nearby order", () => {
  assert.match(app, /window\.gridlyDestinationSearchLayoutAudit/);
  for (const field of ["headingExists", "resultCardCount", "resultRegionHeight", "resultRegionVisible", "firstResultInViewport", "headingAndCardsShareRegion", "nearbyPrecedesCards"]) assert.match(app, new RegExp(field));
  assert.match(app, /delete resultsContainer\.dataset\.searchPublication/);
  assert.match(app, /delete resultsContainer\.dataset\.explicitResultCount/);
});

test("corrected browser assets are cache-distinct", () => {
  assert.equal((html.match(/2445c-owner-acceptance-correction/g) || []).length, 2);
});
