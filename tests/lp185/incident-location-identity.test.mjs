import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const helperSource = fs.readFileSync(new URL("../../js/gridlyIncidentLocationIdentity.js", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../../js/app.js", import.meta.url), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(helperSource, context);
const present = context.window.getGridlyIncidentLocationPresentation;

const reviewedContextStart = appSource.indexOf("let crossingReviewOverrides = {};");
const reviewedContextEnd = appSource.indexOf("if (typeof window !== \"undefined\") window.getGridlyCanonicalCrossingLocationContext", reviewedContextStart);
const reviewedContext = { crossings: [] };
vm.createContext(reviewedContext);
vm.runInContext(`${appSource.slice(reviewedContextStart, reviewedContextEnd)}
this.normalizeReviewedId = normalizeGridlyReviewedCrossingId;
this.getReviewedContext = getGridlyReviewedCrossingLocationContext;
this.getCanonicalContext = getGridlyCanonicalCrossingLocationContext;`, reviewedContext);

const crossingIncident = Object.freeze({
  id: "fixture-crossing-incident",
  crossingId: "fixture-crossing-reference",
  type: "rail_blocked",
  title: "Train Blocking Crossing",
  primaryRoad: "US 90",
  secondaryRoad: "Waco Street",
  lat: 30.01,
  lng: -94.89,
  confidence: "community",
  updatedAt: "2026-08-10T00:00:00Z"
});

test("canonical crossing metadata produces one trusted full and compact identity", () => {
  const identity = present(crossingIncident);
  assert.equal(identity.fullLabel, "US 90 & Waco Street");
  assert.equal(identity.compactLabel, identity.fullLabel);
  assert.equal(identity.source, "canonical-infrastructure");
  assert.equal(identity.precision, "intersection");
});

test("authoritative FRA crossing IDs normalize narrowly for reviewed lookup", () => {
  assert.equal(reviewedContext.normalizeReviewedId("FRA-762790L"), "762790L");
  assert.equal(reviewedContext.normalizeReviewedId("fra-123456a"), "123456A");
  assert.equal(reviewedContext.normalizeReviewedId("FRA-MISSING-US90"), "FRA-MISSING-US90");
  assert.equal(reviewedContext.getReviewedContext("FRA-999999Z").source, "none");
});

test("reviewed context supports normalized FRA, configured alias, and bare IDs", () => {
  for (const id of ["FRA-762790L", "LC-003", "762790L"]) {
    const result = reviewedContext.getReviewedContext(id);
    assert.equal(result.reviewedCrossingId, "762790L");
    assert.equal(result.primaryLabel, "US 90");
    assert.equal(result.secondaryLabel, "Waco Street");
  }
});

test("canonical runtime context promotes FRA locality and county without changing its exact ID join", () => {
  reviewedContext.crossings.push({
    id: "FRA-762790L",
    props: { STREET: "US 90", CITYNAME: "DAYTON", COUNTYNAME: "LIBERTY" }
  });
  const canonical = reviewedContext.getCanonicalContext({ crossingId: "FRA-762790L", lat: 0, lng: 0 });
  assert.equal(canonical.crossingId, "FRA-762790L");
  assert.equal(canonical.resolvedLocality, "Dayton");
  assert.equal(canonical.county, "LIBERTY");
  assert.equal(canonical.primaryRoad, "US 90");
  assert.equal(canonical.secondaryRoad, "Waco Street");
  assert.equal(present({ type: "rail_blocked", ...canonical }).fullLabel, "US 90 & Waco Street");
  assert.equal(reviewedContext.getCanonicalContext({ crossingId: "762790L" }), null);
});

test("FRA CITYNAME supplies road-locality fallback only when reviewed intersection context is absent", () => {
  reviewedContext.crossings.push({
    id: "FRA-123456A",
    primaryRoad: "US 90",
    props: { CITYNAME: "DAYTON", COUNTYNAME: "LIBERTY" }
  });
  const canonical = reviewedContext.getCanonicalContext({ crossingId: "FRA-123456A" });
  assert.equal(present({ type: "rail_blocked", ...canonical }).fullLabel, "US 90 — Dayton");
});

test("reviewed-ID normalization is independent of coordinates and fixture identities", () => {
  const functionStart = appSource.indexOf("function normalizeGridlyReviewedCrossingId");
  const functionEnd = appSource.indexOf("\nfunction ", functionStart + 10);
  const normalizationSource = appSource.slice(functionStart, functionEnd);
  assert.doesNotMatch(normalizationSource, /(?:lat|lng|latitude|longitude|Waco|762790)/i);
});

test("canonical projection preserves authoritative crossing fields for the shared resolver", () => {
  assert.match(appSource, /function getGridlyCanonicalCrossingLocationContext/);
  assert.match(appSource, /crossings\.find/);
  assert.match(appSource, /primaryRoad,[\s\S]*secondaryRoad,[\s\S]*referenceRoad:[\s\S]*canonicalDisplayLocation:[\s\S]*resolvedLocality,/);
  assert.match(helperSource, /getGridlyCanonicalCrossingLocationContext/);
});

test("road and authoritative locality are richer than road-only", () => {
  const identity = present({ type: "rail_blocked", primaryRoad: "US 90", resolvedLocality: "Dayton" });
  assert.equal(identity.fullLabel, "US 90 — Dayton");
  assert.equal(identity.source, "trusted-road-locality");
  assert.equal(identity.precision, "road-locality");
});

test("intersection wins over locality without duplicating locality", () => {
  const identity = present({ type: "rail_blocked", primaryRoad: "US 90", secondaryRoad: "Waco Street", resolvedLocality: "Dayton" });
  assert.equal(identity.fullLabel, "US 90 & Waco Street");
  assert.equal(identity.secondaryLabel, "Dayton");
});

test("alerts, crossing popup, Travel Brief, and Destination Intelligence consume the shared decision", () => {
  for (const functionName of [
    "normalizeGridlyAlertCardLocationLabel",
    "buildGridlyAlertCardConsumerModel",
    "buildGridlyCrossingPopupConsumerModel",
    "gridlyTravelBriefCommunityLine",
    "getGridlyDestinationRouteBestLocationLine"
  ]) {
    const start = appSource.indexOf(`function ${functionName}`);
    assert.notEqual(start, -1, `${functionName} exists`);
    const body = appSource.slice(start, appSource.indexOf("\nfunction ", start + 10));
    assert.match(body, /getGridlyIncidentLocationPresentation/);
  }
  assert.doesNotMatch(appSource, /US 90 & Waco Street/);
});

test("visible Portrait V2 Alerts preserve governed crossing evidence through the final markup sink", () => {
  const functionSource = (name) => {
    const start = appSource.indexOf(`function ${name}`);
    assert.notEqual(start, -1, `${name} exists`);
    let depth = 0;
    let opened = false;
    const bodyStart = appSource.indexOf(") {", start) + 2;
    for (let index = bodyStart; index < appSource.length; index += 1) {
      if (appSource[index] === "{") { depth += 1; opened = true; }
      if (appSource[index] === "}" && opened) depth -= 1;
      if (opened && depth === 0) return appSource.slice(start, index + 1);
    }
    throw new Error(`${name} body not closed`);
  };
  const runtime = {
    getGridlyAlertCardCrossingLocationEvidence: () => ({ locationLineLabel: "US 90 & Waco Street", reviewedLabelApplied: true, fallbackLabelUsed: false }),
    getGridlyIncidentLocationPresentation: present,
    gridlyLp021ResolvedLocationPresentation: () => ({ primaryLocation: "US 90" }),
    gridlyLp023ResolveConsumerLocation: () => ({ displayLocation: "US 90" }),
    normalizeGridlyCountyAwareDisplayText: (value) => String(value || ""),
    normalizeGridlyAlertCardTitleCandidate: (_alert, fallback) => fallback,
    standardizeGridlyAlertHeadline: (value) => value,
    getGridlyCommunityTrustPresentationModel: () => ({ reportCountLine: "1 community report", trustLine: "Community reported" }),
    formatGridlyHazardPopupFreshnessLine: () => "Updated just now",
    normalizeGridlyUserFacingRoadText: (value) => value,
    getGridlyHazardPopupReportCount: () => 1,
    GRIDLY_HAZARD_POPUP_TECHNICAL_METADATA_PATTERN: /$a/,
    cleanDisplayValue: (value) => String(value || "").trim(),
    esc: (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  };
  vm.createContext(runtime);
  vm.runInContext([
    functionSource("normalizeGridlyAlertCardLocationLabel"),
    functionSource("buildGridlyAlertCardConsumerModel"),
    functionSource("gridlyResolveVisibleAlertCardLocationLine"),
    functionSource("gridlyBuildVisibleAlertLocationLineMarkup")
  ].join("\n"), runtime);

  const report = { ...crossingIncident, crossingId: "FRA-762790L", __gridlyPresentationLocationLabel: "US 90" };
  const evidence = runtime.getGridlyAlertCardCrossingLocationEvidence(report);
  const model = runtime.buildGridlyAlertCardConsumerModel(report, { fallbackTitle: "Train Blocking Crossing" });
  const visibleLocation = runtime.gridlyResolveVisibleAlertCardLocationLine(report, model);
  const markup = runtime.gridlyBuildVisibleAlertLocationLineMarkup(visibleLocation, runtime.esc);

  assert.equal(present(report).fullLabel, "US 90 & Waco Street");
  assert.equal(evidence.locationLineLabel, "US 90 & Waco Street");
  assert.equal(model.locationLine, "US 90 & Waco Street");
  assert.equal(visibleLocation, "US 90 & Waco Street");
  assert.match(markup, /class="gridly-alert-location-line"/);
  assert.match(markup, />US 90 &amp; Waco Street<\/div>/);
  assert.doesNotMatch(markup, />US 90<\/div>/);
  assert.match(appSource, /gridlyBuildVisibleAlertLocationLineMarkup\(displaySubtitle, esc\)/);
});

test("visible Alerts fallbacks and source ownership remain intact", () => {
  const resolverStart = appSource.indexOf("function gridlyResolveVisibleAlertCardLocationLine");
  const resolverBody = appSource.slice(resolverStart, appSource.indexOf("\nfunction ", resolverStart + 10));
  assert.ok(resolverBody.indexOf("consumerCard?.locationLine") < resolverBody.indexOf("alert?.__gridlyPresentationLocationLabel"));
  assert.match(resolverBody, /alert\?\.roadName/);
  assert.match(resolverBody, /alert\?\.city/);
  assert.doesNotMatch(resolverBody, /Waco|secondaryRoad|crossingDisplayName/);
  assert.doesNotMatch(appSource.slice(appSource.indexOf("const RenderCompleteAlertCard"), appSource.indexOf("const renderAlertCard", appSource.indexOf("const RenderCompleteAlertCard"))), /secondaryRoad|crossingDisplayName|\s&\s/);
});

test("published-awareness Alerts cannot downgrade the completed consumer location", () => {
  const publishedSource = fs.readFileSync(new URL("../../js/gridlyAlertsPublishedAwareness.js", import.meta.url), "utf8");
  const escapeText = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const sandbox = {
    window: {},
    console,
    normalizeGridlyCountyAwareDisplayText: (value) => String(value || "").trim(),
    cleanDisplayValue: (value) => String(value || "").trim(),
    esc: escapeText,
    gridlyBuildNeutralAlertsSheetMarkup: () => "<div>neutral</div>",
    formatGridlyAlertsFreshnessLine: () => "Updated just now",
    formatGridlyAlertsTrustLine: () => "Community reported",
    buildGridlyAlertCardConsumerModel: (record) => ({ title: record.title, locationLine: record.governedLocation }),
    gridlyResolveVisibleAlertCardLocationLine: (record, consumerCard) => consumerCard?.locationLine || consumerCard?.locationLabel || record.locationLabel || record.roadName || "Nearby",
    gridlyBuildVisibleAlertLocationLineMarkup: (location, escape = escapeText) => `<div class="gridly-alert-location-line" data-gridly-alert-location-line="true">${escape(location)}</div>`,
    isGridlyCachedAwarenessSummaryForCurrentArea: () => true,
    gridlyCommunityPulseAuditState: null,
    gridlyLP012RecordAlertsClick: () => {},
    gridlyAlertsOpenRefreshFixNow: () => 0,
    gridlyBeginAlertsSheetLifecycle: () => 1,
    gridlyBeginAlertsOpenRefreshFixTiming: () => {},
    gridlyRecordAlertsOpenRefreshFixTiming: () => {},
    gridlyInstantAlertsSheetAuditState: {},
    gridlyAlertsSheetLifecycleState: { lateResultIgnoredCount: 0 }
  };
  vm.createContext(sandbox);
  vm.runInContext(publishedSource, sandbox);

  const record = {
    id: "FRA-762790L",
    crossingId: "FRA-762790L",
    type: "rail_blocked",
    title: "Train Blocking Crossing",
    locationLabel: "US 90",
    primaryRoad: "US 90",
    governedLocation: "US 90 & Waco Street"
  };
  assert.equal(sandbox.gridlyGetPublishedAwarenessConsumerLocation(record, record.governedLocation), "US 90");

  const html = sandbox.gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords([record]);
  assert.match(html, /class="gridly-alert-location-line"[^>]*>US 90 &amp; Waco Street<\/div>/);
  assert.doesNotMatch(html, /class="gridly-alert-location-line"[^>]*>US 90<\/div>/);
  assert.match(html, /data-gridly-alert-location="US 90 &amp; Waco Street"/);

  for (const fixture of [
    { title: "Road closure", locationLabel: "FM 1960", governedLocation: "FM 1960" },
    { title: "Crossing blocked", locationLabel: "US 90", governedLocation: "US 90 — Dayton" },
    { title: "Disabled vehicle", locationLabel: "Highway 90 and Bowie Street", governedLocation: "Highway 90 and Bowie Street" },
    { title: "DriveTexas closure", providerId: "drivetexas", locationLabel: "From FM 364 to the Neches River", governedLocation: "From FM 364 to the Neches River" },
    { title: "Travel Alert", governedLocation: "Nearby" }
  ]) {
    const fixtureHtml = sandbox.gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords([fixture]);
    assert.match(fixtureHtml, new RegExp(`data-gridly-alert-location="${escapeText(fixture.governedLocation)}"`));
  }

  const builderStart = publishedSource.indexOf("function gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords");
  const builderEnd = publishedSource.indexOf("\nfunction openAlertsSurfaceFromDock", builderStart);
  const builderSource = publishedSource.slice(builderStart, builderEnd);
  assert.match(builderSource, /gridlyResolveVisibleAlertCardLocationLine\(\s*record,\s*consumerCard\s*\)/);
  assert.match(builderSource, /gridlyBuildVisibleAlertLocationLineMarkup\(location, esc\)/);
  assert.doesNotMatch(builderSource, /gridlyGetPublishedAwarenessConsumerLocation\(/);
});

test("road-only records remain road-only and coordinates never synthesize a cross street", () => {
  assert.equal(present({ type: "rail_blocked", primaryRoad: "US 90" }).fullLabel, "US 90");
  assert.equal(present({ type: "rail_blocked", primaryRoad: "US 90", lat: 30.01, lng: -94.89 }).fullLabel, "US 90");
  assert.equal(present({ type: "rail_blocked", lat: 30.01, lng: -94.89 }).available, false);
});

test("community hazard structured identity is preserved without crossing-specific synthesis", () => {
  const identity = present({ id: "hazard-1", type: "disabled_vehicle", locationLabel: "Highway 90 and Bowie Street" });
  assert.equal(identity.fullLabel, "Highway 90 and Bowie Street");
  assert.equal(identity.source, "structured-community-location");
});

test("official source-owned location wins and official prose is not reformatted", () => {
  const official = {
    id: "official-1", providerId: "drivetexas", roadName: "IH 10",
    locationLabel: "From FM 364 to the Neches River in Beaumont",
    description: "Main lanes are not affected."
  };
  const identity = present(official);
  assert.equal(identity.fullLabel, official.locationLabel);
  assert.equal(identity.source, "official-source-location");
  assert.equal(official.description, "Main lanes are not affected.");
});

test("presentation leaves incident identity, trust, freshness, filtering, and lifecycle inputs untouched", () => {
  const before = JSON.stringify(crossingIncident);
  present(crossingIncident);
  assert.equal(JSON.stringify(crossingIncident), before);
  assert.equal(crossingIncident.id, "fixture-crossing-incident");
  assert.equal(crossingIncident.crossingId, "fixture-crossing-reference");
  assert.equal(crossingIncident.confidence, "community");
  assert.equal(crossingIncident.updatedAt, "2026-08-10T00:00:00Z");
});

test("runtime loads the shared identity helper before app renderers", () => {
  const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("js/gridlyIncidentLocationIdentity.js") < html.indexOf("js/app.js"));
});
