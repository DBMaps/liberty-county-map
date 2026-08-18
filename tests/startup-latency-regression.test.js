const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readiness = require("../js/gridlyStartupReadiness.js");
const appSource = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("mobile core readiness does not await LP201, provider, or geocoder readiness", async () => {
  const lp201 = deferred();
  const provider = deferred();
  const geocoder = deferred();
  const ready = [];

  const secondary = [lp201, provider, geocoder].map((dependency, index) =>
    readiness.startSecondary(() => dependency.promise, () => ready.push(index))
  );

  const coreReached = await Promise.resolve("mobile-shell-ready");
  assert.equal(coreReached, "mobile-shell-ready");
  assert.deepEqual(ready, []);

  lp201.resolve("canonical-anchor");
  provider.resolve("provider-ready");
  geocoder.resolve("boundary-ready");
  assert.deepEqual(await Promise.all(secondary), ["canonical-anchor", "provider-ready", "boundary-ready"]);
  await Promise.resolve();
  assert.deepEqual(ready, [0, 1, 2]);
});

test("production shell checkpoint precedes secondary crossing wait", () => {
  const shell = appSource.indexOf('markMilestone?.("mobileShellReady")');
  const crossing = appSource.indexOf('await crossingReadiness');
  assert.ok(shell > 0 && crossing > shell, "shell readiness must be published before crossing hydration is awaited");
  assert.doesNotMatch(appSource, /await runStartupStage\("statewide PLACE presentation loading"/);
  assert.match(appSource, /startSecondary\([\s\S]*statewide PLACE presentation loading/);
});

test("destination search retains its fail-closed LP201 execution wait", () => {
  assert.match(appSource, /async function gridlySearchAddress[\s\S]*?await gridlyLoadStatewidePlacePresentation\(\)\.catch\(\(\) => null\)/);
  assert.match(appSource, /CANONICAL_PLACE_PRESENTATION_COORDINATES_UNAVAILABLE/);
});
