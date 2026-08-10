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
