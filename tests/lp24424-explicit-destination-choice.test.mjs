import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const app = fs.readFileSync("js/app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("css/styles.css", "utf8");

function section(start, end) {
  const startIndex = app.indexOf(start);
  const endIndex = app.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
  return app.slice(startIndex, endIndex);
}

const renderResults = section("function renderGridlySearchResults", "function collapseGridlySearchResults");
const selectResult = section("function selectGridlySearchResult", "window.gridlySelectNearbyPlace");
const previewPending = section("async function previewGridlyPendingDestinationRoute", "function getSelectedDestinationLabel");
const buildPreview = section("async function buildGridlyDestinationRoutePreview", "window.gridlyDestinationRoutePreviewDebug");
const mobileCard = section("function syncMobileDestinationCommandCard", "function clearGridlyDestinationRoutePreview");
const initSearch = section("function initGridlySearchUI", "function showGridlySearchShell");
const closeSearch = section("function closeGridlyDestinationSearchSurface", "function hideGridlySearchShell");
const hideSearch = section("function hideGridlySearchShell", "let lastRouteWatchSelection");

test("1 search submission alone does not route", () => {
  const submit = section("const submitRemoteSearch =", "if (remoteSearchBtn");
  assert.doesNotMatch(submit, /buildGridlyDestinationRoutePreview/);
});

test("2 a single rendered result does not auto-route", () => {
  assert.match(renderResults, /itemBtn\.addEventListener\("click"/);
  assert.doesNotMatch(renderResults, /renderedResults\.length\s*===\s*1[\s\S]*selectGridlySearchResult/);
});

test("3 Enter submits search without choosing an ambiguous first result", () => {
  assert.match(initSearch, /event\.key !== "Enter"[\s\S]*submitRemoteSearch\(\)/);
  assert.doesNotMatch(initSearch, /event\.key !== "Enter"[\s\S]*selectGridlySearchResult/);
});

test("4 result selection creates a visible pending confirmation", () => {
  assert.match(selectResult, /state\.selectedDestination = normalized/);
  assert.match(selectResult, /renderGridlyDestinationConfirmation/);
  assert.ok(selectResult.indexOf("clearGridlyDestinationRoutePreview") < selectResult.indexOf("const state = ensureGridlySearchState"));
  assert.doesNotMatch(selectResult, /buildGridlyDestinationRoutePreview/);
});

test("5 only Preview route explicitly initiates destination route calculation", () => {
  assert.match(previewPending, /buildGridlyDestinationRoutePreview\(\{ reason: "explicit-preview-route", explicitPreview: true \}\)/);
  assert.match(buildPreview, /options\?\.explicitPreview !== true[\s\S]*options\?\.originRefresh === true && priorPreview\?\.active/);
});

test("6 Change returns to candidate selection without routing", () => {
  const change = section("function changeGridlyPendingDestination", "async function previewGridlyPendingDestinationRoute");
  assert.match(change, /renderGridlySearchResults/);
  assert.match(change, /input\?\.focus/);
  assert.doesNotMatch(change, /buildGridlyDestinationRoutePreview/);
});

test("7 double activation is suppressed while one preview is pending", () => {
  assert.match(previewPending, /if \(gridlySearchUiState\.routePreviewInFlight\) return false/);
  assert.match(app, /previewBtn\.disabled = options\.loading === true/);
});

test("8 stale search completion cannot replace current input or selection", () => {
  const currentGuard = section("function isGridlyLiveSearchRenderCurrent", "function renderGridlySearchResults");
  assert.match(currentGuard, /requestId !== gridlySearchUiState\.activeSearchRequestId/);
  assert.match(currentGuard, /getGridlySearchActiveInputQuery/);
  assert.match(selectResult, /activeSearchRequestId \+= 1/);
});

test("9 stale route publication remains owned by the existing controller", () => {
  const ownershipSource = fs.readFileSync("js/gridly-route-publication-ownership.js", "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(ownershipSource, context);
  const controller = context.globalThis.GRIDLY_ROUTE_PUBLICATION_OWNERSHIP_CONTRACT.createController();
  const stale = controller.start("route-a");
  const current = controller.start("route-b");
  assert.equal(controller.publish(current), true);
  assert.equal(controller.publish(stale), false);
  assert.match(buildPreview, /guardGridlyRoutePublication/);
});

test("10 visible identity and routed coordinates share one selected object", () => {
  assert.match(selectResult, /state\.selectedDestination = normalized/);
  assert.match(app, /buildGridlySearchDisplayLines\(destination\)/);
  assert.match(buildPreview, /normalizeGridlySearchResult\(state\?\.selectedDestination\)/);
  assert.match(buildPreview, /destination\.lat, destination\.lng/);
});

test("11 route failure preserves the confirmed destination", () => {
  assert.doesNotMatch(previewPending, /state\.selectedDestination\s*=\s*null/);
  assert.match(previewPending, /renderGridlyDestinationConfirmation\(\{[\s\S]*retry: true/);
});

test("12 retry reuses the same confirmed destination", () => {
  assert.match(previewPending, /const destination = normalizeGridlySearchResult\(ensureGridlySearchState\(\)\.selectedDestination\)/);
  assert.match(previewPending, /const destinationKey = getGridlyPendingDestinationKey\(destination\)/);
  assert.match(html, />Retry route|>Preview route</);
});

test("13 no-route and provider failure messages are distinct and truthful", () => {
  assert.match(previewPending, /Route service is unavailable right now\. Try again\./);
  assert.match(previewPending, /No route found for this destination\. Change the destination or try again\./);
  const consumerMessages = [...previewPending.matchAll(/"([^"\n]+(?:route|destination)[^"\n]*)"/gi)].map((match) => match[1]).join(" ");
  assert.doesNotMatch(consumerMessages, /\bsafe\b|\bclear\b/i);
});

test("14 dismissal cannot initiate routing", () => {
  const close = section("function closeGridlyDestinationSearchSurface", "function hideGridlySearchShell");
  assert.doesNotMatch(close, /buildGridlyDestinationRoutePreview/);
  assert.doesNotMatch(hideSearch, /buildGridlyDestinationRoutePreview/);
});

test("15 closing restores focus to the opening control when practical", () => {
  assert.match(app, /searchShellOpener = options\?\.opener \|\| document\.activeElement/);
  assert.match(hideSearch, /requestAnimationFrame\(\(\) => opener\.focus\(\)\)/);
});

test("16 keyboard operation supports Enter, Escape, and native buttons", () => {
  assert.match(initSearch, /event\.key !== "Enter"/);
  assert.match(initSearch, /event\.key !== "Escape"/);
  assert.match(html, /id="gridlyDestinationChangeBtn"[^>]*type="button"/);
  assert.match(html, /id="gridlyDestinationPreviewBtn"[^>]*type="button"/);
});

test("17 accessible names, announcements, focus visibility, and selected state exist", () => {
  assert.match(html, /aria-labelledby="gridlyDestinationConfirmationTitle"/);
  assert.match(html, /gridlyDestinationConfirmation"[^>]*role="group"/);
  assert.match(html, /gridlyDestinationConfirmationStatus"[^>]*aria-live="polite"/);
  assert.match(app, /toggleAttribute\("data-selected", visible\)/);
  assert.match(css, /gridly-destination-confirmation[\s\S]*:focus-visible/);
});

test("18 consumer confirmation never exposes raw coordinates", () => {
  const confirmation = html.slice(html.indexOf("gridlyDestinationConfirmation"), html.indexOf("</section>", html.indexOf("gridlyDestinationConfirmation")));
  assert.doesNotMatch(confirmation, /latitude|longitude|\blat\b|\blng\b/i);
  assert.doesNotMatch(previewPending, /textContent[\s\S]{0,80}(destination\.(lat|lng)|toFixed)/);
});

test("19 protected portrait structure keeps bounded actions and reduced motion", () => {
  assert.match(css, /body\[data-layout-mode="portrait"\][\s\S]*\.gridly-destination-confirmation/);
  assert.match(css, /gridly-destination-confirmation-actions > button \{ min-height: 48px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(html, /gridly-destination-confirmation[^>]*role="navigation"/);
});

test("20 route provider and source-authority contracts remain unchanged", () => {
  assert.match(buildPreview, /fetchRoadRoutePreviewData/);
  assert.match(buildPreview, /beginGridlyRoutePublication\("destination_route_preview"\)/);
  assert.match(html, /gridly-route-publication-ownership\.js\?v=2448/);
  assert.match(html, /gridlyRuntimeSourceRegistryBridge\.js/);
});

test("21 pending selection hides the underlying route-summary strip", () => {
  assert.match(app, /pendingDestinationConfirmation = Boolean\([\s\S]*!gridlySearchUiState\.routePreviewTransitionStarted[\s\S]*!routePreviewActive/);
  assert.match(mobileCard, /cardVisible = Boolean\(visibilityState\.visible && !visibilityState\.pendingDestinationConfirmation\)/);
  assert.match(selectResult, /routePreviewTransitionStarted = false[\s\S]*renderGridlyDestinationConfirmation/);
});

test("22 pending selection publishes no route geometry or route-state presentation", () => {
  assert.ok(selectResult.indexOf("clearGridlyDestinationRoutePreview") < selectResult.indexOf("state.selectedDestination = normalized"));
  assert.doesNotMatch(selectResult, /drawGridlyDestinationRoutePreviewLine|fetchRoadRoutePreviewData|routeRelationLineText/);
  assert.match(mobileCard, /routePresentationActive[\s\S]*selectedLabel && routePresentationActive[\s\S]*getGridlyRouteRelationLineText/);
});

test("23 Preview route reveals route presentation only after the explicit transition", () => {
  assert.ok(previewPending.indexOf("routePreviewTransitionStarted = true") < previewPending.indexOf("syncMobileDestinationCommandCard()"));
  assert.ok(previewPending.indexOf("syncMobileDestinationCommandCard()") < previewPending.indexOf("buildGridlyDestinationRoutePreview"));
  assert.match(previewPending, /hideGridlySearchShell\(\{ clear: false, restoreFocus: false \}\)/);
});

test("24 changing or dismissing clears stale route presentation", () => {
  const change = section("function changeGridlyPendingDestination", "async function previewGridlyPendingDestinationRoute");
  assert.match(change, /clearGridlyPendingDestination\(\{ reason: "destination_change"/);
  assert.match(app, /function clearGridlyPendingDestination[\s\S]*invalidateGridlyRoutePublication[\s\S]*clearGridlyDestinationRoutePreview/);
  assert.match(closeSearch, /invalidateGridlyRoutePublication[\s\S]*clearGridlyDestinationRoutePreview/);
  assert.match(app, /mobileDestinationCommandBtn\.addEventListener[\s\S]*selectedDestination[\s\S]*changeGridlyPendingDestination/);
});

test("25 destination identity is not duplicated in stacked consumer panels before preview", () => {
  assert.equal((html.match(/id="gridlyDestinationConfirmationTitle"/g) || []).length, 1);
  assert.match(mobileCard, /pendingDestinationConfirmation/);
  assert.match(mobileCard, /card\.hidden = !cardVisible/);
  assert.match(mobileCard, /aria-hidden", cardVisible \? "false" : "true"/);
});
