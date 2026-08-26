const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync("js/app.js", "utf8");
const audit = fs.readFileSync("js/gridlyLP240WeatherAuthorityAudit.js", "utf8");
const integration = fs.readFileSync("js/gridlyWeatherAuthoritySourceIntegration.js", "utf8");

test("A-D/G-I: official event, local timing, source, detail, and fallback are presentation-owned", () => {
  assert.match(app, /function gridlyWeatherDisplayLabel/);
  assert.match(app, /alert\?\.event/);
  assert.match(app, /Weather Alert/);
  assert.match(app, /timeZone: "America\/Chicago"/);
  assert.match(app, /senderName \|\| alert\?\.office/);
  assert.match(app, /\(WHAT\|IMPACTS\?\)/);
});

test("J-K/T: KBYG is bounded to event plus timing and one travel-impact line", () => {
  const weatherLines = app.slice(app.indexOf("function gridlyTravelBriefWeatherLines"), app.indexOf("function gridlyTravelBriefSettledFreshnessCopy"));
  assert.match(weatherLines, /gridlyWeatherTravelerTiming/);
  assert.match(weatherLines, /slice\(0, 2\)/);
  assert.doesNotMatch(weatherLines, /instruction|senderName|description/);
});

test("L-M/P/S: presentation evidence does not alter governed or provider identity", () => {
  assert.match(integration, /event: text\(record\?\.event\) \|\| null/);
  assert.match(integration, /authority: freeze\(clone\(record\?\.authority/);
  assert.doesNotMatch(integration, /providerRecordId:\s*text\(record\?\.event/);
  assert.match(app, /weatherFamilyIdentity: weatherSelection\?\.weatherFamilyIdentity/);
});

test("E-F/Q/R: source order and truthful quiet/unavailable weather states remain explicit", () => {
  const model = app.slice(app.indexOf("function gridlyLP236BuildModel"), app.indexOf("function gridlyLP236AlertsInformationArchitectureAudit"));
  assert.ok(model.indexOf('sourceClass: "official_roadway"') < model.indexOf('sourceClass: "community_report"'));
  assert.ok(model.indexOf('sourceClass: "community_report"') < model.indexOf('sourceClass: "weather"'));
  assert.match(app, /No active weather alerts/);
  assert.match(app, /Weather information unavailable/);
});

test("N-O: counts observe candidates, authoritative snapshot, and mounted identities", () => {
  assert.match(audit, /alertsStages\.presentationCandidates/);
  assert.match(audit, /alertsStages\.finalAlertData/);
  assert.match(audit, /querySelectorAll\?\.\('\[data-gridly-lp236-condition-id\]'/);
  assert.match(audit, /alertsWeatherDomIdentityCount/);
});
