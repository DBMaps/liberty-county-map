import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const publishedAwareness = fs.readFileSync(new URL("../js/gridlyAlertsPublishedAwareness.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const body = source.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = body; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

test("statewide Alerts expose an accessible action only for a current resolvable map target", () => {
  assert.match(app, /function gridlyResolveAlertShowOnMapTarget/);
  assert.match(app, /gridlyLp019ResolveAlertRecord\(id\) !== resolvedRecord/);
  assert.match(app, /findGridlyAlertMarker\(null, markerOptions\)/);
  assert.match(app, /requireIdentityMatch: true/);
  assert.match(app, /source\.consumerSituationId/);
  assert.match(app, /action\.type = "button"/);
  assert.match(app, /action\.setAttribute\("aria-label", `Show/);
  assert.match(app, /action\.textContent = "Show on map"/);
  assert.match(css, /\.gridly-alert-show-on-map:focus-visible/);
});

test("Show on map reuses the existing focus and marker contracts without marker creation or state rewrites", () => {
  const resolver = app.match(/function gridlyResolveAlertShowOnMapTarget[\s\S]*?\n}/)?.[0] || "";
  const focus = app.match(/function focusGridlyAlertIncident[\s\S]*?\n}\n\nfunction focusAlertLocation/)?.[0] || "";
  assert.doesNotMatch(resolver, /L\.marker|fetch\(/);
  assert.match(app, /source: showOnMapAction \? "alerts_show_on_map"/);
  assert.match(focus, /preserveZoom = focus\?\.source === "alerts_show_on_map"/);
  assert.match(focus, /alreadyVisibleNoCameraMove/);
  assert.match(focus, /marker\.openPopup\(\)/);
  assert.match(focus, /closePortraitV2Sheet/);
  assert.doesNotMatch(focus, /setGridlySelectedAwarenessArea|activeCounty\s*=|homeTown\s*=/);
});

test("Fredericksburg control is provider- and city-agnostic", () => {
  const resolver = app.match(/function gridlyResolveAlertShowOnMapTarget[\s\S]*?\n}/)?.[0] || "";
  assert.doesNotMatch(resolver, /Fredericksburg|4827348|US\s*87/i);
  assert.match(resolver, /findGridlyAlertMarker\(null, markerOptions\)/);
  assert.match(resolver, /exactIdentityCandidates/);
  assert.match(resolver, /markerCoords \|\| gridlyLp019OfficialCoords\(resolvedRecord\)/);
  assert.match(resolver, /gridlyLp019OfficialCoords\(resolvedRecord\)/);
  assert.match(resolver, /return Object\.freeze\(\{ id, record: resolvedRecord, coords, marker/);
});

test("an exact current marker is eligible without alert coordinates and remains authoritative", () => {
  const resolver = app.match(/function gridlyResolveAlertShowOnMapTarget[\s\S]*?\n}/)?.[0] || "";
  const focus = app.match(/function focusGridlyAlertIncident[\s\S]*?\n}\n\nfunction focusAlertLocation/)?.[0] || "";

  assert.match(resolver, /gridlyLp019ResolveAlertRecord\(id\) !== resolvedRecord/);
  assert.match(resolver, /findGridlyAlertMarker\(null, markerOptions\)/);
  assert.match(resolver, /resolvedRecord\?\.consumerSituationId/);
  assert.match(resolver, /normalizeCoordinatePair\(markerLatLng\?\.lat, markerLatLng\?\.lng\)/);
  assert.match(app, /const coords = showOnMapTarget\?\.coords \|\| crossingTarget\.coords/);
  assert.match(focus, /focus\?\.markerResolved === true && focus\?\.marker/);
  assert.match(focus, /if \(!focus\?\.markerResolved/);
  assert.doesNotMatch(resolver, /L\.marker|fetch\(|resolvedRecord\.(?:lat|lng)\s*=/);
  assert.doesNotMatch(resolver, /tolerance|proximity|coordinateDelta/);
});

test("the production published-awareness builder renders Show on map for an exact marker without alert coordinates", () => {
  const incidentId = "drivetexas:provider:FE00C70A-A3F8-4CEB-8970-228FD50A14CD";
  const record = { consumerSituationId: incidentId, lat: null, lng: null, title: "Road closure", lifecycleState: "active" };
  const marker = { options: { incidentId }, getLatLng: () => ({ lat: 30.354093522309597, lng: -98.92211903028245 }) };
  const sandbox = {
    window: { __gridlyLatestAlertsForRender: [record] },
    gridlyLp019SafeText: value => String(value ?? "").trim(),
    gridlyLp019IdentityCandidates: (...sources) => sources.flatMap(source => source && typeof source === "object"
      ? [source.consumerSituationId, source.canonicalIncidentId, source.incidentId, source.id]
      : [source]).map(value => String(value ?? "").trim()).filter(Boolean),
    findGridlyAlertMarker: (_coords, options) => options.exactIdentityCandidates.includes(marker.options.incidentId) ? marker : null,
    normalizeCoordinatePair: (lat, lng) => Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : null,
    gridlyLp019OfficialCoords: () => null,
    cleanDisplayValue: value => String(value || "").trim(),
    normalizeGridlyCountyAwareDisplayText: value => String(value || "").trim(),
    gridlyResolveVisibleAlertCardLocationLine: () => "US 87",
    gridlyGetPublishedAwarenessConsumerSummary: () => "Road closure reported.",
    gridlyBuildVisibleAlertLocationLineMarkup: location => `<div>${location}</div>`,
    gridlyPublishedAwarenessCleanConsumerText: value => String(value || "").trim(),
    gridlyBuildNeutralAlertsSheetMarkup: () => "<div></div>",
    resolveGridlyAlertsPanelHeadingCandidate: () => ({ text: "Active Alerts" }),
    esc: value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;"),
  };
  vm.createContext(sandbox);
  vm.runInContext([
    functionSource(app, "gridlyLp019ResolveAlertRecord"),
    functionSource(app, "gridlyResolveAlertShowOnMapTarget"),
    functionSource(publishedAwareness, "gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords"),
    "this.build = gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords;"
  ].join("\n"), sandbox);

  const html = sandbox.build([record]);
  assert.match(html, />Show on map<\/button>/);
  assert.match(html, /aria-label="Show Road closure on map"/);
  assert.match(html, new RegExp(`data-gridly-show-on-map-incident-id="${incidentId}"`));
  assert.equal((html.match(/data-gridly-show-on-map="true"/g) || []).length, 1);
  assert.doesNotMatch(html, /data-gridly-alert-(?:lat|lng)=/, "null alert coordinates are not fabricated as zeroes");
  assert.equal(record.lat, null);
  assert.equal(record.lng, null);
});
