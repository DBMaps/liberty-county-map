import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync("js/gridly-saved-place-revalidation-ownership.js", "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const contract = context.globalThis.GRIDLY_SAVED_PLACE_REVALIDATION_OWNERSHIP_CONTRACT;

const clone = (value) => JSON.parse(JSON.stringify(value));
const legacy = (slot, address = `${slot} A, Liberty, TX 77575`) => ({
  id: slot, type: slot, label: slot === "home" ? "Home" : "Work", address,
  lat: 30.05, lng: -94.79, coordinateSource: "geocode",
  resolutionStatus: "legacy_requires_revalidation", validationStatus: "legacy_requires_revalidation", routeEligible: false
});
const verified = (slot, address = `${slot} B, Liberty, TX 77575`) => ({
  ...legacy(slot, address), lat: 30.06, lng: -94.80,
  resolutionStatus: "success", validationStatus: "passed", routeEligible: true
});
const migrated = (place) => ({ ...place, lat: 30.07, lng: -94.81,
  resolutionStatus: "success", validationStatus: "passed", routeEligible: true,
  migrationAttempted: true, migrationResult: "passed" });
const failed = (place) => ({ ...place, resolutionStatus: "legacy_requires_revalidation",
  validationStatus: "legacy_requires_revalidation", routeEligible: false,
  migrationAttempted: true, migrationResult: "locality_required" });

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function harness(initialState) {
  let state = clone(initialState);
  const pending = { home: deferred(), work: deferred() };
  const starts = [];
  const controller = contract.createController({
    getState: () => clone(state),
    saveState: (nextState) => { state = clone(nextState); },
    shouldRevalidate: (place) => Boolean(place && place.resolutionStatus === "legacy_requires_revalidation" && place.migrationAttempted !== true),
    revalidatePlace: ({ slot, place }) => { starts.push(slot); return pending[slot].promise.then((placeResult) => ({
      place: placeResult, attempted: true, result: placeResult.migrationResult
    })); }
  });
  return { controller, pending, starts, get state() { return clone(state); }, set state(value) { state = clone(value); } };
}

test("same-slot replacement suppresses the stale Home completion", async () => {
  const homeA = legacy("home");
  const homeB = verified("home");
  const run = harness({ home: homeA, work: null, custom: [], favorites: [] });
  const completion = run.controller.revalidateSlots();
  assert.deepEqual(run.starts, ["home"]);
  run.state = { ...run.state, home: homeB };
  run.pending.home.resolve(migrated(homeA));
  await completion;
  assert.deepEqual(run.state.home, homeB);
  const attempt = run.controller.audit().slotAttempts.home[0];
  assert.equal(attempt.commitSuppressed, true);
  assert.equal(attempt.suppressionReason, "slot_replaced");
});

test("Home migration patches current state and preserves newer Work, Favorites, and custom places", async () => {
  const homeA = legacy("home");
  const run = harness({ home: homeA, work: legacy("work"), custom: [{ id: "custom-a" }], favorites: [{ id: "favorite-a" }] });
  const completion = run.controller.revalidateSlots();
  const current = run.state;
  const workB = verified("work");
  run.state = { ...current, work: workB, custom: [{ id: "custom-b" }], favorites: [{ id: "favorite-b" }] };
  run.pending.home.resolve(migrated(homeA));
  run.pending.work.resolve(migrated(current.work));
  await completion;
  assert.deepEqual(run.state.work, workB);
  assert.deepEqual(run.state.custom, [{ id: "custom-b" }]);
  assert.deepEqual(run.state.favorites, [{ id: "favorite-b" }]);
  assert.equal(run.state.home.migrationResult, "passed");
});

test("deleting Home while revalidation awaits cannot recreate it", async () => {
  const homeA = legacy("home");
  const run = harness({ home: homeA, work: null, custom: [], favorites: [] });
  const completion = run.controller.revalidateSlots();
  run.state = { ...run.state, home: null };
  run.pending.home.resolve(migrated(homeA));
  await completion;
  assert.equal(run.state.home, null);
  assert.equal(run.controller.audit().slotAttempts.home[0].suppressionReason, "slot_deleted");
});

for (const order of [["work", "home"], ["home", "work"]]) {
  test(`Home and Work migrations survive ${order.join("-then-")} completion`, async () => {
    const homeA = legacy("home");
    const workA = legacy("work");
    const run = harness({ home: homeA, work: workA, custom: [], favorites: [] });
    const completion = run.controller.revalidateSlots();
    assert.deepEqual(run.starts, ["home", "work"]);
    run.pending[order[0]].resolve(migrated(order[0] === "home" ? homeA : workA));
    await Promise.resolve();
    run.pending[order[1]].resolve(migrated(order[1] === "home" ? homeA : workA));
    await completion;
    assert.equal(run.state.home.migrationResult, "passed");
    assert.equal(run.state.work.migrationResult, "passed");
  });
}

test("stale failure cannot downgrade a newer verified or user-confirmed Home", async () => {
  const homeA = legacy("home");
  const replacements = [verified("home"), { ...verified("home"), coordinateSource: "user_map_selection",
    resolutionStatus: "user_confirmed", validationStatus: "user_confirmed", confirmedAt: "2026-09-07T00:00:00.000Z" }];
  for (const homeB of replacements) {
    const run = harness({ home: homeA, work: null, custom: [], favorites: [] });
    const completion = run.controller.revalidateSlots();
    run.state = { ...run.state, home: homeB };
    run.pending.home.resolve(failed(homeA));
    await completion;
    assert.deepEqual(run.state.home, homeB);
  }
});

test("Favorites and custom changes survive a Work-only migration", async () => {
  const workA = legacy("work");
  const run = harness({ home: verified("home"), work: workA, custom: [], favorites: [] });
  const completion = run.controller.revalidateSlots();
  run.state = { ...run.state, custom: [{ id: "custom-new" }], favorites: [{ id: "favorite-new" }] };
  run.pending.work.resolve(migrated(workA));
  await completion;
  assert.deepEqual(run.state.custom, [{ id: "custom-new" }]);
  assert.deepEqual(run.state.favorites, [{ id: "favorite-new" }]);
});

test("normal valid Work migration commits when ownership is unchanged", async () => {
  const workA = legacy("work", "1829 Sam Houston St, Liberty, TX 77575");
  const run = harness({ home: null, work: workA, custom: [], favorites: [] });
  const completion = run.controller.revalidateSlots();
  run.pending.work.resolve(migrated(workA));
  await completion;
  assert.equal(run.state.work.resolutionStatus, "success");
  assert.equal(run.state.work.validationStatus, "passed");
  assert.equal(run.state.work.routeEligible, true);
  assert.equal(run.controller.audit().slotAttempts.work[0].commitApplied, true);
});

test("bad legacy Home remains blocked when no newer action supersedes it", async () => {
  const homeA = legacy("home", "1710 Sam Houston Avenue");
  const run = harness({ home: homeA, work: null, custom: [], favorites: [] });
  const completion = run.controller.revalidateSlots();
  run.pending.home.resolve(failed(homeA));
  await completion;
  assert.equal(run.state.home.routeEligible, false);
  assert.equal(run.state.home.migrationResult, "locality_required");
  assert.equal(run.controller.audit().overallPass, true);
});

test("production wiring rereads current state and publishes the ownership audit", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  const index = fs.readFileSync("index.html", "utf8");
  assert.match(index, /gridly-saved-place-revalidation-ownership\.js\?v=2447/);
  assert.match(app, /const ownershipContract = window\.GRIDLY_SAVED_PLACE_REVALIDATION_OWNERSHIP_CONTRACT/);
  assert.match(app, /ownershipContract\.createController/);
  assert.match(app, /getState: getSavedPlacesState/);
  assert.match(app, /saveState: saveSavedPlacesState/);
  assert.match(app, /gridlySavedPlaceRevalidationOwnershipAudit/);
  assert.doesNotMatch(app, /state\[slot\] = outcome\.place;[\s\S]{0,200}saveSavedPlacesState\(state\)/);
});
