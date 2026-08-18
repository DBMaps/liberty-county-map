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

test("startup resources download in parallel without parser-blocking the first shell", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const externalScripts = [...html.matchAll(/<script\b([^>]*\bsrc=[^>]*)>/g)].map((match) => match[1]);
  assert.ok(externalScripts.length > 50, "fixture must cover the full production startup stack");
  assert.equal(externalScripts.filter((attributes) => !/\b(?:defer|async)\b/.test(attributes)).length, 0);
  assert.doesNotMatch(html, /markUiUsable[^\n]+prepaint lock released and visible UI painted/);
});

test("RCA helper separates browser paints, resources, tasks, lifecycle stages, and crossing hydration", () => {
  const diagnostics = fs.readFileSync(path.join(__dirname, "../gridly-startup-latency-rca.js"), "utf8");
  assert.match(diagnostics, /window\.gridlyStartupLatencyRcaAudit = audit/);
  for (const field of ["firstPaintMs", "firstContentfulPaintMs", "consumerShellInteractiveMs", "longAnimationFrames", "bootstrapStages", "crossingStages", "topOwners"]) {
    assert.match(diagnostics, new RegExp(field));
  }
  assert.match(appSource, /DOMContentLoaded lifecycle \(core plus secondary hydration\)[\s\S]*blocking: false/);
  assert.match(appSource, /consumer shell core bootstrap[\s\S]*blocking: true/);
});
