import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const foundationSource = fs.readFileSync(new URL("../js/gridlyWeatherAuthorityFoundation.js", import.meta.url), "utf8");
const connectorSource = fs.readFileSync(new URL("../js/gridlyWeatherLiveConnector.js", import.meta.url), "utf8");

function functionSource(name) {
  const match = appSource.match(new RegExp(`function ${name}\\([^]*?^\\}`, "m"));
  assert.ok(match, `${name} source must exist`);
  return match[0];
}

function weatherImpactContext(extra = {}) {
  const context = vm.createContext({
    console,
    safeDisplayText: (value, fallback = "") => String(value ?? fallback),
    ...extra,
  });
  context.window = context;
  context.globalThis = context;
  vm.runInContext([
    functionSource("gridlyStoryText"),
    functionSource("gridlyStoryWeatherMeaningfulImpact"),
  ].join("\n"), context);
  return context;
}

function foundationContext() {
  const context = vm.createContext({ console });
  context.window = context;
  context.globalThis = context;
  vm.runInContext(foundationSource, context);
  return context;
}

const NOW = "2026-09-15T18:00:00.000Z";
const liberty = { label: "Liberty", countyName: "Liberty County" };
const current = (overrides = {}) => ({
  id: "nws-current",
  providerId: "weather",
  event: "Heat Advisory",
  title: "Heat Advisory",
  locality: "Liberty",
  effectiveTime: "2026-09-15T17:00:00.000Z",
  expirationTime: "2026-09-15T20:00:00.000Z",
  ...overrides,
});

function connectorContext(initialPoint, eventForPoint = (point) => point.awarenessKey === "liberty" ? "Freeze Warning" : "Heat Advisory") {
  let point = { ...initialPoint };
  const context = vm.createContext({
    console,
    AbortController,
    setTimeout,
    clearTimeout,
    Date,
  });
  context.window = context;
  context.globalThis = context;
  context.gridlyResolveGovernedWeatherPoint = () => ({ ...point });
  context.gridlyWeatherProvider = {
    normalizeRecords(payload) {
      return (payload.features || []).map((feature) => ({ id: feature.id, providerId: "weather", ...feature.properties }));
    },
  };
  context.fetch = async (url) => {
    const text = String(url);
    if (text.includes("/points/")) return { ok: true, json: async () => ({ properties: { forecast: "https://api.weather.gov/gridpoints/TST/1,1/forecast" } }) };
    if (text.includes("/forecast")) return { ok: true, json: async () => ({ properties: { periods: [] } }) };
    const now = Date.now();
    const event = eventForPoint(point);
    return { ok: true, json: async () => ({ type: "FeatureCollection", features: event ? [{ id: `${point.stableIdentity}-${event}`, properties: { event, title: event, status: "Actual", messageType: "Alert", effectiveTime: new Date(now - 60_000).toISOString(), expirationTime: new Date(now + 3_600_000).toISOString() } }] : [] }) };
  };
  vm.runInContext(connectorSource, context);
  return { context, setPoint(next) { point = { ...next }; } };
}

test("1 current Heat Advisory without a temperature cannot become freezing KBYG", () => {
  const context = weatherImpactContext();
  assert.equal(context.gridlyStoryWeatherMeaningfulImpact({ event: "Heat Advisory", temperature: "" }).kind, "heat");
  assert.equal(context.gridlyStoryWeatherMeaningfulImpact({ event: "Heat Advisory" }).kind, "heat");
});

test("2 stale freeze evidence is excluded from current weather authority", () => {
  const context = foundationContext();
  const result = context.gridlySelectConsumerWeatherAuthority({ selectedAwarenessArea: liberty, now: NOW, records: [current({ event: "Freeze Warning", title: "Freeze Warning", effectiveTime: "2026-09-15T00:00:00.000Z", expirationTime: null })] });
  assert.equal(result.consumerSituationCount, 0);
  assert.equal(result.staleRecords.length, 1);
});

test("3 expired freeze alerts are not eligible", () => {
  const context = foundationContext();
  const result = context.gridlySelectConsumerWeatherAuthority({ selectedAwarenessArea: liberty, now: NOW, records: [current({ event: "Freeze Warning", title: "Freeze Warning", expirationTime: "2026-09-15T17:59:59.000Z" })] });
  assert.equal(result.consumerSituationCount, 0);
  assert.equal(result.expiredRecords.length, 1);
});

test("4 retained historical weather cannot be promoted as current", () => {
  const context = foundationContext();
  const result = context.gridlySelectConsumerWeatherAuthority({ selectedAwarenessArea: liberty, now: NOW, records: [current({ event: "Freeze Warning", connectorRetained: true, effectiveTime: "2026-09-14T00:00:00.000Z", expirationTime: null })] });
  assert.equal(result.authorityStatus, "QUIET");
  assert.equal(result.staleRecords.length, 1);
});

test("5 current PLACE identity must own the KBYG weather candidate", () => {
  const context = foundationContext();
  const result = context.gridlySelectConsumerWeatherAuthority({ selectedAwarenessArea: liberty, now: NOW, records: [current({ locality: "Dayton" })] });
  assert.equal(result.consumerSituationCount, 0);
  assert.equal(result.fallbackReason, "no_consumer_eligible_weather");
});

test("6 precise current PLACE authority wins over a county or legacy weather candidate", () => {
  const context = weatherImpactContext({
    gridlyWeatherPresentationState: { event: "Freeze Warning", temperature: "29", county: "Liberty County" },
    gridlySelectConsumerVisibleWeatherSituations: () => ({ consumerVisibleSituationCount: 1, consumerVisibleSituations: [current()] }),
  });
  vm.runInContext([functionSource("gridlyBriefInteractionWeatherFromAuthority"), functionSource("gridlyBriefInteractionWeatherBridge")].join("\n"), context);
  const bridge = context.gridlyBriefInteractionWeatherBridge({ requireLocality: true });
  assert.equal(bridge.event, "Heat Advisory");
  assert.equal(context.gridlyStoryWeatherMeaningfulImpact(bridge).kind, "heat");
});

test("7 area transition invalidates previous weather before publishing the next identity", async () => {
  const libertyPoint = { stableIdentity: "4842568", awarenessKey: "liberty", countyId: "liberty-tx", lat: 30.0572, lng: -94.795, placeGeoid: "4842568" };
  const daytonPoint = { stableIdentity: "4819432", awarenessKey: "dayton", countyId: "liberty-tx", lat: 30.0466, lng: -94.8852, placeGeoid: "4819432" };
  const { context, setPoint } = connectorContext(libertyPoint);
  await context.gridlyWeatherConnector.fetchNow();
  assert.equal(context.gridlyWeatherConnector.getNormalizedRecords()[0].event, "Freeze Warning");
  setPoint(daytonPoint);
  const pending = context.gridlyWeatherConnector.refreshAwarenessView();
  assert.equal(context.gridlyWeatherConnector.getNormalizedRecords().length, 0);
  await pending;
  assert.equal(context.gridlyWeatherConnector.getNormalizedRecords()[0].event, "Heat Advisory");
  assert.equal(context.gridlyWeatherConnectorRuntimeAudit().responseIdentity, "4819432|dayton|30.0466,-94.8852");
});

test("8 hard refresh does not rehydrate a stale weather narrative", async () => {
  const point = { stableIdentity: "4842568", awarenessKey: "liberty", countyId: "liberty-tx", lat: 30.0572, lng: -94.795, placeGeoid: "4842568" };
  const first = connectorContext(point);
  await first.context.gridlyWeatherConnector.fetchNow();
  assert.equal(first.context.gridlyWeatherConnector.getNormalizedRecords().length, 1);
  const refreshed = connectorContext(point, () => null);
  assert.equal(refreshed.context.gridlyWeatherConnector.getNormalizedRecords().length, 0);
  assert.doesNotMatch(connectorSource, /localStorage|sessionStorage/);
});

test("9 a legitimate current freeze condition still promotes freezing awareness", () => {
  const context = weatherImpactContext();
  assert.equal(context.gridlyStoryWeatherMeaningfulImpact({ event: "Freeze Warning", temperature: "29°" }).kind, "freezing");
});

test("10 a legitimate current Heat Advisory still promotes heat awareness", () => {
  const context = weatherImpactContext();
  assert.equal(context.gridlyStoryWeatherMeaningfulImpact({ event: "Heat Advisory", temperature: "104°" }).kind, "heat");
});

test("11 non-weather KBYG transportation candidates remain unaffected", () => {
  const context = weatherImpactContext();
  vm.runInContext([functionSource("gridlyStoryRecordText"), functionSource("gridlyStoryTransportationImpact")].join("\n"), context);
  assert.equal(context.gridlyStoryTransportationImpact({ title: "Road closed", description: "Emergency detour in effect" }).kind, "road_closure");
  assert.equal(context.gridlyStoryWeatherMeaningfulImpact({ title: "Road closed", description: "Emergency detour in effect" }), null);
});

test("12 current NWS official alerts remain independently governed", () => {
  const context = foundationContext();
  const result = context.gridlySelectConsumerWeatherAuthority({ selectedAwarenessArea: liberty, now: NOW, records: [current()] });
  assert.equal(result.authorityStatus, "ACTIVE");
  assert.equal(result.consumerEligibleWeather[0].event, "Heat Advisory");
  assert.equal(result.consumerEligibleWeather[0].authority.freshness, "fresh");
});

test("13 multi-county PLACE weather identity remains PLACE-owned", async () => {
  const dallas = { stableIdentity: "4819000", awarenessKey: "place-4819000", countyId: null, countyMemberships: ["48085", "48113", "48121", "48257", "48397"], lat: 32.7767, lng: -96.797, placeGeoid: "4819000" };
  const { context } = connectorContext(dallas);
  await context.gridlyWeatherConnector.fetchNow();
  const audit = context.gridlyWeatherConnectorRuntimeAudit();
  assert.equal(audit.responseIdentity, "4819000|place-4819000|32.7767,-96.797");
  assert.equal(audit.selectedIdentityClass, null);
  assert.equal(audit.selectedPlaceGeoid, "4819000");
});
