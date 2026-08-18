const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readiness = require("../js/gridlyStartupReadiness.js");
const appSource = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const diagnosticsSource = fs.readFileSync(path.join(__dirname, "../js/gridlyStartupDiagnostics.js"), "utf8");
const documentSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const controlSource = fs.readFileSync(path.join(__dirname, "../startup-navigation-control.html"), "utf8");

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

test("development lifecycle attribution is tiny, bounded, and read-only", () => {
  assert.match(diagnosticsSource, /isDevelopmentHost/);
  assert.match(diagnosticsSource, /previousDocumentLifecycle/);
  assert.match(diagnosticsSource, /beforeunload/);
  assert.match(diagnosticsSource, /pagehide/);
  assert.match(diagnosticsSource, /visibilitychange/);
  assert.match(diagnosticsSource, /\[window, "unload"\]/);
  assert.match(diagnosticsSource, /\[document, "freeze"\]/);
  assert.match(diagnosticsSource, /\[document, "resume"\]/);
  assert.match(diagnosticsSource, /record\.events\.length > 24/);
  assert.match(diagnosticsSource, /DEVELOPMENT — NAVIGATION LIFECYCLE EVIDENCE/);
  assert.match(diagnosticsSource, /RELOAD GRIDLY/);
  assert.doesNotMatch(diagnosticsSource, /sendBeacon\s*\(/);
  assert.match(controlSource, />OPEN GRIDLY</);
  assert.match(controlSource, /gridlyLifecycleControl=navigate/);
  assert.match(controlSource, /location\.assign\("\.\/index\.html\?gridlyLifecycleControl=navigate"\)/);
  assert.doesNotMatch(controlSource, /target=["']_blank["']/i);
  assert.doesNotMatch(controlSource, /window\.open\s*\(/);
  assert.match(diagnosticsSource, /lifecycleControlRequested/);
  assert.match(diagnosticsSource, /viewportWidth:/);
  assert.match(diagnosticsSource, /viewportHeight:/);
  assert.match(diagnosticsSource, /devicePixelRatio:/);
  assert.match(diagnosticsSource, /mobileMediaQueryMatch:/);
  assert.match(diagnosticsSource, /navigationType:/);
  assert.match(diagnosticsSource, /preFetchDelay:/);
  assert.match(diagnosticsSource, /mobileConsumerSurfaceDetected:/);
  assert.match(diagnosticsSource, /INVALID MOBILE CONTROL/);
  assert.match(diagnosticsSource, /Gridly did not open in the emulated mobile consumer environment\./);
  assert.doesNotMatch(documentSource, /gridlyLifecycleControl/);
  assert.doesNotMatch(appSource, /gridlyLifecycleControl/);
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

test("startup latency audit is read-only and preserves script ordering", () => {
  assert.match(diagnosticsSource, /window\.gridlyStartupLatencyAudit = startupLatencyAudit/);
  for (const field of ["navigationTiming", "documentDelivery", "earliestResources", "serviceWorker", "timeOriginValidation", "documentStructure", "preResourceGap", "classification", "classifications", "parserProgress", "inlineScriptTimings", "parserGapAttribution", "lifecycle", "trackingPrevention", "milestones", "resources", "scriptEvaluation", "longTasks", "longAnimationFrames", "startupGate", "repeatedWork", "topOwners", "findings"]) {
    assert.match(diagnosticsSource, new RegExp(`\\b${field}\\b`));
  }
  for (const field of ["requestStart", "responseStart", "responseEnd", "responseTransferDuration", "responseEndToFirstResource", "workerStart", "decodedBodySize"]) {
    assert.match(diagnosticsSource, new RegExp(`\\b${field}\\b`));
  }
  assert.match(diagnosticsSource, /allResources\.slice\(0, 20\)/);
  assert.match(diagnosticsSource, /navigator\.serviceWorker\.getRegistration\(\)/);
  assert.match(diagnosticsSource, /nav\?\.type/);
  assert.match(diagnosticsSource, /notRestoredReasons/);
  assert.match(diagnosticsSource, /document\.wasDiscarded/);
  assert.match(diagnosticsSource, /classifications\.push\("NAVIGATION_PRE_REQUEST_DELAY"\)/);
  assert.match(diagnosticsSource, /classifications\.push\("EARLY_PARSER_BLOCK"\)/);
  assert.doesNotMatch(diagnosticsSource, /\.setAttribute\(["'](?:async|defer)["']/);
  assert.doesNotMatch(diagnosticsSource, /serviceWorker\.getRegistrations\(\)[\s\S]*unregister/);
  assert.doesNotMatch(diagnosticsSource, /document\.write\s*\(/);
  assert.ok(appSource.lastIndexOf('markMilestone?.("appEvaluated")') > appSource.indexOf('markMilestone?.("appDOMContentLoadedListenerRegistered")'));
});

test("early parser and lifecycle evidence brackets startup without reordering resources", () => {
  const marks = [
    "DOCUMENT_INLINE_1_START", "DOCUMENT_INLINE_1_END",
    "DOCUMENT_INLINE_2_START", "DOCUMENT_INLINE_2_END",
    "DOCUMENT_INLINE_3_START", "DOCUMENT_INLINE_3_END",
    "FIRST_STYLESHEET_BOUNDARY", "FIRST_EXTERNAL_SCRIPT_BOUNDARY", "APP_SCRIPT_BOUNDARY"
  ];
  let previous = -1;
  for (const mark of marks) {
    const position = documentSource.indexOf(`name: "${mark}"`);
    assert.ok(position > previous, `${mark} must follow the preceding parser mark`);
    previous = position;
  }
  assert.ok(documentSource.indexOf("FIRST_STYLESHEET_BOUNDARY") < documentSource.indexOf('<link rel="stylesheet"'));
  assert.ok(documentSource.indexOf("FIRST_EXTERNAL_SCRIPT_BOUNDARY") < documentSource.indexOf('<script src="js/gridlyStartupDiagnostics.js'));
  assert.ok(documentSource.indexOf("APP_SCRIPT_BOUNDARY") < documentSource.indexOf('<script src="js/app.js'));
  assert.match(documentSource, /visibilitychange/);
  assert.match(documentSource, /pageshow/);
  assert.match(documentSource, /pagehide/);
  assert.doesNotMatch(documentSource, /<(?:script|link)[^>]+\b(?:async|defer)\b/);
});
