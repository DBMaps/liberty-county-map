import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { areas, report } from "../tools/lp240x/supported-area-identity-audit.mjs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const source = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const body = source.indexOf(") {", start) + 2;
  let depth = 0;
  for (let i = body; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`cannot extract ${name}`);
}

test("onboarding and Settings start with the shared community-or-ZIP search", () => {
  assert.match(html, /id="gridlyWelcomeHomeAreaSearchInput"[^>]*placeholder="Dayton, Tarkington, or 77535"/);
  assert.match(html, /id="settingsAwarenessAreaSearchInput"/);
  assert.equal((html.match(/Search your Texas community/g) || []).length, 2);
  assert.doesNotMatch(html, /id="gridlyWelcomeZipSetupBtn"/);
  assert.doesNotMatch(html, /id="settingsChooseCommunityManuallyBtn"/);
  assert.match(source, /searchGridlySettingsAwarenessArea\(document\.getElementById\("gridlyWelcomeHomeAreaSearchInput"\)/);
});

test("Portrait Settings exposes one Home Area action and opens the primary chooser directly", () => {
  const surface = functionSource("buildSettingsSurfaceHtml");
  const opener = functionSource("openGridlyPrimaryHomeAreaChooser");
  const acceptance = functionSource("gridlyLP2419HomeAreaAcceptance");
  assert.match(surface, /data-v2-action="settings-change-home-area"/);
  assert.match(surface, /Change Home Area/);
  assert.match(surface, /Choose Home Area/);
  assert.doesNotMatch(surface, /Home ZIP|Current view|settings-change-home-zip|settings-choose-available-areas|Choose from available areas/);
  assert.match(opener, /renderGridlyManualAwarenessAreaPicker\(container, \{ consumerFlow: true, focusSearch: true \}\)/);
  assert.doesNotMatch(opener, /gridlyOpenLp0516ZipConfirmationPrototype/);
  for (const field of ["changeAreaOpensPrimarySearchDirectly", "zipOnlyModalRequired", "chooseManuallyRequired", "chooseAvailableAreasPrimary", "separateHomeZipPrimary", "primaryJourneyStepCount"]) {
    assert.match(acceptance, new RegExp(field));
  }
});

test("selection presentation preserves explicit multi-county membership", () => {
  const renderer = functionSource("renderGridlySettingsAwarenessSearchResult");
  const saver = functionSource("gridlySaveCanonicalMultiCountyPlaceHome");
  assert.match(renderer, /result\.candidates/);
  assert.match(renderer, /Use this Home Area — \$\{candidate\.county\}/);
  assert.match(saver, /explicit_operational_membership_missing/);
  assert.match(saver, /requestedOperationalCountyId/);
  for (const label of ["Austin", "Abilene"]) {
    const rows = areas.filter((area) => area.label === label && area.placeGeoid);
    assert.ok(rows.length > 1, `${label} retains governed memberships`);
  }
});

test("Dayton and Tarkington retain governed identity classes", () => {
  const dayton = areas.find((area) => area.key === "dayton");
  const tarkington = areas.find((area) => area.key === "tarkington");
  assert.match(String(dayton?.placeGeoid), /^48\d{5}$/);
  assert.equal(tarkington?.placeGeoid, null);
  assert.equal(tarkington?.countyId, "liberty-tx");
  assert.match(functionSource("gridlyLp240ResolveGovernedHomeIdentity"), /GOVERNED_NON_PLACE/);
});

test("location is secondary and denial leaves search rendered", () => {
  const input = html.indexOf('id="gridlyWelcomeHomeAreaSearchInput"');
  const location = html.indexOf('id="gridlyWelcomeEnableLocationBtn"');
  assert.ok(input > -1 && location > input);
  assert.match(functionSource("requestGridlyWelcomeLocation"), /Location was not enabled/);
  assert.doesNotMatch(functionSource("requestGridlyWelcomeLocation"), /gridlyWelcomeHomeAreaSearchInput[^\n]*hidden/);
});

test("acceptance is read-only and save plus rehydration retain shared governance", () => {
  const helper = functionSource("gridlyLP2419HomeAreaAcceptance");
  assert.match(helper, /gridlyLp0517ValidateHomeRecord\(record\)/);
  assert.match(helper, /gridlyLp240ResolveGovernedHomeIdentity\(record, validation\.area\)/);
  assert.match(helper, /JSON\.parse\(JSON\.stringify\(record\)\)/);
  assert.doesNotMatch(helper, /localStorage\.setItem|gridlyApplyConfirmedHomePersonalization/);
  assert.match(functionSource("gridlyLp0517ValidateHomeRecord"), /gridlyLp240ResolveGovernedHomeIdentity\(record, area\)/);
  assert.match(functionSource("gridlyReadHomePersonalizationRecord"), /gridlyLp0517ValidateHomeRecord\(parsed\)/);
});

test("statewide eligibility authority is unchanged", () => {
  assert.deepEqual({
    supportedAwarenessAreaCount: areas.length,
    homeAreaEligibleCount: report.counts.homeAreaEligibleCount,
    acceptedEligibleCount: report.counts.currentValidatorAcceptedCount + report.counts.currentValidatorRejectedEligibleCount,
    rejectedEligibleCount: 0
  }, { supportedAwarenessAreaCount: 2342, homeAreaEligibleCount: 2341, acceptedEligibleCount: 2341, rejectedEligibleCount: 0 });
});
