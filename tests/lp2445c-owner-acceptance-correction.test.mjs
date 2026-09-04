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
  assert.doesNotMatch(landscape, /gridly-landscape-command-handle[\s\S]{0,200}display:\s*none/);
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
