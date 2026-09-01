import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const interactionGate = app.slice(
  app.indexOf("function getGridlyV2SheetInteractionEligibility("),
  app.indexOf("const GRIDLY_V2_PRESENTATION_OWNER_CLASS")
);
const sheetOpen = app.slice(
  app.indexOf("function openGridlyPortraitV2Sheet("),
  app.indexOf("function openPortraitV2Sheet(")
);
const bindV2Start = app.indexOf("function bindV2()");
const bindV2 = app.slice(bindV2Start, bindV2Start + 5_000);

function interactionEligibility({ width, height, layoutMode }) {
  const strictPortrait = layoutMode === "portrait" && width <= 980 && height >= width;
  const acceptedShortLandscapeApplicationOwner = layoutMode === "portrait" && width > height && height <= 500;
  return strictPortrait || acceptedShortLandscapeApplicationOwner;
}

test("shared dock owners, singular sheet owner, registry, and authoritative bindings remain intact", () => {
  for (const id of ["gridlyReportDockButton", "gridlyAlertsDockButton", "gridlyHistoryDockButton", "gridlySettingsDockButton"]) {
    assert.equal((html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} remains singular`);
  }
  assert.equal((html.match(/id=["']gridlyPortraitV2Sheet["']/g) || []).length, 1);
  assert.match(app, /const sheetTemplates = \{[\s\S]*?report:[\s\S]*?alerts:[\s\S]*?settings:[\s\S]*?history:/);
  assert.match(bindV2, /querySelectorAll\("\[data-v2-sheet\]"\)/);
  assert.match(bindV2, /openPortraitV2Sheet\(b\.dataset\.v2Sheet\)/);
  for (const [id, sheet] of [["gridlyReportDockButton", "report"], ["gridlyAlertsDockButton", "alerts"], ["gridlyHistoryDockButton", "history"], ["gridlySettingsDockButton", "settings"]]) {
    assert.match(html, new RegExp(`id=["']${id}["'][^>]*data-v2-sheet=["']${sheet}["']`));
  }
  assert.doesNotMatch(interactionGate, /addEventListener|gridlyReportDockButton|gridlyAlertsDockButton|gridlyHistoryDockButton|gridlySettingsDockButton/);
});

test("interaction eligibility is separate from unchanged strict Portrait cleanup", () => {
  assert.match(interactionGate, /acceptedShortLandscapeApplicationOwner/);
  assert.match(interactionGate, /layoutMode === "portrait"/);
  assert.match(interactionGate, /\(orientation: landscape\) and \(max-height: 500px\)/);
  assert.match(interactionGate, /cleanupState\.isStrictPortraitMobile \|\| acceptedShortLandscapeApplicationOwner/);
  assert.match(sheetOpen, /getGridlyV2SheetInteractionEligibility\(\)/);
  assert.match(sheetOpen, /if \(!sheetInteractionEligibility\.eligible\)/);
  assert.doesNotMatch(sheetOpen, /if \(!portraitAuthorization\.isStrictPortraitMobile\)/);
  assert.match(app, /portraitCleanupGateActive: isStrictPortraitMobile/);
});

test("strict Portrait and accepted short landscapes are eligible, unsupported wide layout is not", () => {
  assert.equal(interactionEligibility({ width: 390, height: 844, layoutMode: "portrait" }), true);
  assert.equal(interactionEligibility({ width: 932, height: 430, layoutMode: "portrait" }), true);
  assert.equal(interactionEligibility({ width: 844, height: 390, layoutMode: "portrait" }), true);
  assert.equal(interactionEligibility({ width: 1440, height: 900, layoutMode: "portrait" }), false);
  assert.equal(interactionEligibility({ width: 932, height: 430, layoutMode: "desktop" }), false);
});

test("Report, History, Alerts, and Settings keep the shared sheet identity and builders", () => {
  assert.match(app, /report: \{ title: "Report", html: buildReportHazardSurfaceHtml \}/);
  assert.match(app, /history: \{ title: "Historical Intelligence", html: buildGridlyHistoricalIntelligenceSheetHtml \}/);
  assert.match(app, /alerts: \{ title: "Current Alerts", html: buildAlertsSurfaceHtml \}/);
  assert.match(app, /settings: \{ title: "Settings", html: buildSettingsSurfaceHtml \}/);
  assert.match(sheetOpen, /sheet\.setAttribute\("data-active-sheet", sheetName\)/);
  assert.match(sheetOpen, /if \(settingsActive\) suppressLegacySettingsSurfaceForPortraitV2Settings\(\)/);
});

test("Alerts governed focus, Escape, and opener restoration lifecycle is preserved", () => {
  assert.match(sheetOpen, /gridlyAlertsLastActivationOpener = candidate/);
  assert.match(sheetOpen, /gridlySetAlertsModalFocusOwnership\(sheet, true\)/);
  assert.match(sheetOpen, /alertsClose\?\.focus\?\.\(\)/);
  assert.match(app, /if \(event\.key !== "Escape"\) return;[\s\S]*?closePortraitV2Sheet\(\)/);
  assert.match(app, /gridlyAlertsLastActivationOpener\?\.isConnected[\s\S]*?gridlyAlertsLastActivationOpener\.focus\(\)/);
});

test("close retains the mounted application and only clears sheet foreground state", () => {
  const close = app.slice(app.indexOf("function closePortraitV2Sheet()"), app.indexOf("const gridlyLiveServerRuntimeRecoveryState"));
  assert.match(close, /sheet\.hidden = true/);
  assert.match(close, /sheet\.removeAttribute\("data-active-sheet"\)/);
  assert.doesNotMatch(close, /remove\(\)|setView\(|localStorage|sessionStorage|fetch\(/);
});

test("I1 changes no frozen presentation, Search, KBYG, disclosure, Layers, Leaflet, or data authority", () => {
  assert.match(html, /js\/app\.js\?v=243i21s2-esri-imagery-labels/);
  assert.doesNotMatch(interactionGate + sheetOpen, /mobileDestinationCommandBtn|gridlySearchShell|gridlyBriefFoundationHandle|gridlyBriefInteractionPanel|gridlyLandscapeCommandToggle|layers|Leaflet|setView\(|fetch\(|localStorage|sessionStorage/);
});
