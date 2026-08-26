const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const { classifyWeatherAuthority, observeAlertsWeatherPresentation } = require("../js/gridlyLP240WeatherAuthorityAudit.js");

function valueNode(value) { return { textContent: value }; }

function condition(id, event, timing, source, groupLabel = event) {
  const values = {
    '[data-gridly-weather-event="true"]': event ? valueNode(event) : null,
    '[data-gridly-weather-timing="true"]': timing ? valueNode(timing) : null,
    '[data-gridly-weather-source="true"]': source ? valueNode(source) : null
  };
  const group = { querySelector: (selector) => selector === '[data-gridly-weather-group-label="true"]' ? valueNode(groupLabel) : null };
  return {
    dataset: { gridlyLp236ConditionId: id },
    querySelector: (selector) => values[selector] || null,
    closest: (selector) => selector === "[data-gridly-lp236-group]" ? group : null
  };
}

function alertsRoot(rows, state = "ACTIVE", label = "") {
  const section = {
    dataset: { gridlyLp236Count: String(rows.length), gridlyLp236AuthorityState: state },
    textContent: label || rows.map((row) => row.dataset.gridlyLp236ConditionId).join(" "),
    querySelectorAll: (selector) => selector === "[data-gridly-lp236-condition-id]" ? rows : [],
    querySelector: () => null
  };
  return {
    isConnected: true,
    section,
    querySelector: (selector) => selector === '[data-gridly-lp236-source="weather"]' ? section : null,
    closest: () => null
  };
}

function documentFixture({ active = null, retained = null, historical = [] } = {}) {
  const sheetRoot = active || retained;
  const sheet = sheetRoot ? { querySelector: (selector) => selector === '[data-gridly-lp236-alerts="true"]' ? sheetRoot : null } : null;
  return {
    querySelector(selector) {
      if (selector === '#gridlyPortraitV2Sheet[data-active-sheet="alerts"]') return active ? sheet : null;
      if (selector === "#gridlyPortraitV2Sheet") return sheet;
      return null;
    },
    querySelectorAll: (selector) => selector === '[data-gridly-lp236-alerts="true"]' ? [...historical, ...(sheetRoot ? [sheetRoot] : [])] : []
  };
}

const tarkington = () => condition("nws-heat", null, "Until 7 PM CDT", "NWS Houston/Galveston TX", "Heat Advisory");

test("A/C: current mounted Tarkington and Dayton details come from their condition rows", () => {
  const tarkingtonResult = observeAlertsWeatherPresentation(documentFixture({ active: alertsRoot([tarkington()]) }));
  assert.equal(tarkingtonResult.displayedCount, 1);
  assert.equal(tarkingtonResult.identityCount, 1);
  assert.deepEqual({ ...tarkingtonResult.conditions[0] }, { conditionId: "nws-heat", event: "Heat Advisory", timing: "Until 7 PM CDT", source: "NWS Houston/Galveston TX" });

  const dayton = alertsRoot([condition("nws-flood", "Flood Warning", "Until 9 PM CDT", "NWS Houston/Galveston TX")]);
  assert.equal(observeAlertsWeatherPresentation(documentFixture({ active: dayton })).conditions[0].event, "Flood Warning");
});

test("B/H: canonical active or retained Portrait sheet outranks stale historical roots", () => {
  const stale = alertsRoot([condition("dayton-old", "Flood Warning", "Until 4 PM CDT", "Old office")]);
  const current = alertsRoot([tarkington()]);
  for (const fixture of [documentFixture({ active: current, historical: [stale] }), documentFixture({ retained: current, historical: [stale] })]) {
    const result = observeAlertsWeatherPresentation(fixture);
    assert.equal(result.conditions[0].conditionId, "nws-heat");
    assert.equal(result.displayedCount, 1);
  }
});

test("D/E/I: rows determine displayed count, while provider identities are unique and headings do not count", () => {
  const duplicate = condition("nws-heat", "Heat Advisory", "Until 7 PM CDT", "NWS");
  let result = observeAlertsWeatherPresentation(documentFixture({ active: alertsRoot([duplicate, duplicate]) }));
  assert.equal(result.displayedCount, 2);
  assert.equal(result.identityCount, 1);

  result = observeAlertsWeatherPresentation(documentFixture({ active: alertsRoot([
    duplicate,
    condition("nws-flood", null, "Until 9 PM CDT", "NWS", "Flood Warning")
  ]) }));
  assert.equal(result.displayedCount, 2);
  assert.equal(result.identityCount, 2);
  assert.deepEqual(Array.from(result.conditions, (row) => row.event), ["Heat Advisory", "Flood Warning"]);
});

test("F/G: quiet and unavailable mounts expose zero rows and truthful agreement", () => {
  for (const [state, emptyText] of [["QUIET", "No active weather alerts"], ["UNAVAILABLE", "Weather information unavailable"]]) {
    const observed = observeAlertsWeatherPresentation(documentFixture({ retained: alertsRoot([], state, emptyText) }));
    assert.equal(observed.displayedCount, 0);
    assert.equal(observed.conditions[0], undefined);
    const agreement = classifyWeatherAuthority({
      sourceConfigured: state === "QUIET", sourceRequestAttempted: state === "QUIET", sourceRequestSucceeded: state === "QUIET",
      sourceHealthy: state === "QUIET", sourceFreshEnough: state === "QUIET", canonicalGeographyResolved: state === "QUIET",
      geographyAgreementPass: state === "QUIET", currentApplicableCount: 0, presentationCount: 0, presentationEmptyState: observed.presentationText
    });
    assert.equal(agreement.presentationAgreementPass, true);
  }
});

test("J-L: repair is audit-only and leaves identity and both production formatters/renderers untouched", () => {
  const audit = fs.readFileSync("js/gridlyLP240WeatherAuthorityAudit.js", "utf8");
  const app = fs.readFileSync("js/app.js", "utf8");
  assert.doesNotMatch(audit.slice(audit.indexOf("function observeAlertsWeatherPresentation"), audit.indexOf("function getWeatherAuthorityEnvelope")), /innerHTML|appendChild|replaceChildren|fetch\(|localStorage|render/i);
  assert.match(app, /function gridlyTravelBriefWeatherLines/);
  assert.match(app, /function gridlyLP236RenderAlertsPresentation/);
  assert.match(audit, /currentAwarenessIdentity/);
});
