import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = { globalThis: {} };
vm.runInNewContext(fs.readFileSync("js/gridly-saved-address-integrity.js", "utf8"), context);
vm.runInNewContext(fs.readFileSync("js/gridly-saved-address-ui-state.js", "utf8"), context);
const acquisition = context.globalThis.GRIDLY_SAVED_ADDRESS_ACQUISITION_CONTRACT;
const ui = context.globalThis.GRIDLY_SAVED_ADDRESS_UI_STATE_CONTRACT;
const address = "1710 Sam Houston Ave, Liberty, TX 77575";
const anchor = { lat: 30.0572, lng: -94.795 };
const oldHome = Object.freeze({ id: "home", address: "100 Old Home Rd, Liberty, TX 77575", lat: 30.05, lng: -94.8 });

test("fallback and map-confirm actions survive passive rerenders", () => {
  let state = ui.offer(ui.createState(), { slot: "home", pendingAddress: address, currentAnchor: anchor, oldSavedPlace: oldHome });
  for (let pass = 0; pass < 4; pass += 1) {
    const rendered = ui.presentation(state);
    assert.equal(rendered.mode, ui.MODES.AWAITING_MAP_SELECTION);
    assert.equal(rendered.actionLabel, "Choose Location on Map");
    assert.equal(rendered.fallbackControlVisible, true);
    assert.equal(rendered.defaultSaveControlVisible, false);
    assert.equal(rendered.currentAnchor.lat, anchor.lat);
    assert.equal(rendered.currentAnchor.lng, anchor.lng);
  }

  state = ui.beginMapConfirmation(state);
  for (let pass = 0; pass < 4; pass += 1) {
    const rendered = ui.presentation(state);
    assert.equal(rendered.mode, ui.MODES.AWAITING_MAP_CONFIRMATION);
    assert.equal(rendered.actionLabel, "Set Home Here");
    assert.equal(rendered.confirmControlVisible, true);
    assert.equal(rendered.defaultSaveControlVisible, false);
  }
});

test("old Home remains unchanged until explicit confirmation publishes governed provenance", () => {
  let persistedHome = oldHome;
  let state = ui.offer(ui.createState(), { slot: "home", pendingAddress: address, currentAnchor: anchor, oldSavedPlace: persistedHome });
  assert.strictEqual(persistedHome, oldHome);
  state = ui.beginMapConfirmation(state);
  assert.strictEqual(persistedHome, oldHome);

  const selected = { lat: 30.0555, lng: -94.7961 };
  const confirmed = acquisition.confirmMapSelection({
    address,
    slot: "home",
    coordinates: selected,
    anchor: { source: "governed_zip_community", resolvedFrom: "zip", coordinates: anchor },
    confirmedAt: "2026-09-07T12:00:00.000Z"
  });
  state = ui.confirm(state, selected);
  persistedHome = confirmed;

  assert.equal(state.mode, ui.MODES.CONFIRMED);
  assert.equal(confirmed.coordinateSource, "user_map_selection");
  assert.equal(confirmed.resolutionStatus, "user_confirmed");
  assert.equal(confirmed.validationStatus, "user_confirmed");
  assert.equal(confirmed.originalAddressInput, address);
  assert.equal(confirmed.confirmedAt, "2026-09-07T12:00:00.000Z");
  assert.equal(acquisition.isRouteEligible(persistedHome), true);
});

test("Back or Cancel preserves old Home and address editing intentionally clears fallback", () => {
  const offered = ui.offer(ui.createState(), { slot: "home", pendingAddress: address, currentAnchor: anchor, oldSavedPlace: oldHome });
  const canceled = ui.cancel(offered, "backed_out");
  assert.equal(canceled.mode, ui.MODES.CANCELED);
  assert.equal(JSON.stringify(canceled.oldSavedPlace), JSON.stringify(oldHome));
  assert.equal(ui.presentation(canceled).fallbackControlVisible, false);

  const edited = ui.restart("address_edited");
  assert.equal(edited.mode, ui.MODES.DEFAULT_ADDRESS_ENTRY);
  assert.equal(edited.pendingAddress, "");
  assert.equal(ui.presentation(edited).defaultSaveControlVisible, true);
});

test("offered fallback without an actionable control fails the consumer audit", () => {
  const state = ui.offer(ui.createState(), { slot: "home", pendingAddress: address, currentAnchor: anchor, oldSavedPlace: oldHome });
  const missing = ui.auditUiState(state, {
    fallbackOffered: true,
    confirmed: false,
    fallbackControlVisible: false,
    confirmControlVisible: false,
    defaultSaveControlVisible: true
  });
  assert.equal(missing.consumerUsable, false);
  assert.equal(missing.mode, ui.MODES.AWAITING_MAP_SELECTION);
});

test("production renderer owns fallback controls and confirms only after persistence", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  const index = fs.readFileSync("index.html", "utf8");
  assert.match(index, /gridly-saved-address-ui-state\.js\?v=2446-live-map-confirmation/);
  assert.match(app, /function renderManagePlacesFallbackUiState\(\)/);
  assert.match(app, /els\.mobileSaveRouteBtn\.hidden = active/);
  assert.match(app, /els\.mobileUseMapCenterFallbackBtn\.hidden = !active/);
  assert.match(app, /resetManagePlacesGeocodeFallback\(\{ reason: "address_edited" \}\)/);
  assert.match(app, /cancelManagePlacesFallbackUi\("settings_closed"\)/);
  assert.match(app, /fallbackConsumerUsable/);
  assert.match(app, /oldSavedPlacePreserved/);
  const persistAt = app.indexOf("saveSavedPlacesState(nextState);", app.indexOf("async function saveRoute"));
  const confirmAt = app.indexOf("GRIDLY_SAVED_ADDRESS_UI_STATE_CONTRACT.confirm", persistAt);
  assert.ok(persistAt > 0 && confirmAt > persistAt, "CONFIRMED UI state follows successful saved-place persistence");
});
