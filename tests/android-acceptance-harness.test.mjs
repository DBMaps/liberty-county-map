import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { bounded, exactlyOneDevice, parseDevices } from "../tools/android-acceptance/core.mjs";
import { cleanupCreatedForward, connectReadyWebView, pollUntil, selectGridlyTarget, waitForCdpReadiness } from "../tools/android-acceptance/cdp.mjs";

const gridly = { type: "page", url: "https://localhost/", title: "Gridly | Know Before You Go", webSocketDebuggerUrl: "ws://page" };

function jsonResponse(body) {
  return { ok: true, json: async () => body };
}

test("CDP endpoint may be unavailable initially and then become ready", async () => {
  let versionCalls = 0;
  const result = await waitForCdpReadiness("http://cdp", {
    timeoutMs: 100,
    intervalMs: 1,
    fetchImpl: async url => {
      if (url.endsWith("/json/version") && ++versionCalls === 1) throw new Error("socket hang up");
      return jsonResponse(url.endsWith("/json/version") ? { webSocketDebuggerUrl: "ws://browser" } : [gridly]);
    }
  });
  assert.equal(versionCalls, 2);
  assert.equal(result.target, gridly);
});

test("service worker appearing first is not selected as the Gridly page", async () => {
  let listCalls = 0;
  const worker = { type: "service_worker", url: "https://localhost/", title: "Gridly | Know Before You Go" };
  const result = await waitForCdpReadiness("http://cdp", {
    timeoutMs: 100,
    intervalMs: 1,
    fetchImpl: async url => jsonResponse(url.endsWith("/json/version")
      ? { webSocketDebuggerUrl: "ws://browser" }
      : (++listCalls === 1 ? [worker] : [worker, gridly]))
  });
  assert.equal(listCalls, 2);
  assert.equal(result.target, gridly);
});

test("Gridly page selection requires the exact type, URL, and title", () => {
  const lookalikes = [
    { ...gridly, type: "service_worker" },
    { ...gridly, url: "http://localhost/" },
    { ...gridly, title: "Gridly" },
    gridly
  ];
  assert.equal(selectGridlyTarget(lookalikes), gridly);
});

test("readiness polling has a bounded timeout", async () => {
  await assert.rejects(pollUntil(() => false, { timeoutMs: 5, intervalMs: 1, stage: "socket missing" }), /socket missing: not ready within 5ms/);
});

test("browser-level rejection falls back to the ready page endpoint", async () => {
  const page = { url: () => "https://localhost/" };
  const fallbackBrowser = { contexts: () => [{ pages: () => [page] }] };
  const endpoints = [];
  const connected = await connectReadyWebView({}, "http://cdp", { version: { webSocketDebuggerUrl: "ws://browser" }, target: gridly }, async endpoint => {
    endpoints.push(endpoint);
    if (endpoint === "ws://browser") throw new Error("socket hang up");
    return fallbackBrowser;
  });
  assert.deepEqual(endpoints, ["ws://browser", "ws://page"]);
  assert.equal(connected.connection, "page-level fallback");
  assert.match(connected.browserError.message, /socket hang up/);
});

test("browser-level and page-level rejections remain separately identified", async () => {
  await assert.rejects(
    connectReadyWebView({}, "http://cdp", { version: { webSocketDebuggerUrl: "ws://browser" }, target: gridly }, async endpoint => {
      throw new Error(endpoint === "ws://browser" ? "browser refused" : "page refused");
    }),
    error => error.stage === "page-level connection rejected"
      && /page refused/.test(error.message)
      && /browser-level connection rejected: browser refused/.test(error.message)
  );
});

test("connection failure cleanup removes only a forward created by this harness", () => {
  let removals = 0;
  cleanupCreatedForward(false, () => removals++);
  cleanupCreatedForward(true, () => removals++);
  assert.equal(removals, 1);
});

test("device discovery accepts exactly one authorized target", () => {
  const output = "List of devices attached\nemulator-5554 device product:sdk model:Pixel_9\n";
  assert.deepEqual(parseDevices(output), [{ serial: "emulator-5554", state: "device" }]);
  assert.equal(exactlyOneDevice(output), "emulator-5554");
  assert.throws(() => exactlyOneDevice("List of devices attached\n"), /exactly one/);
  assert.throws(() => exactlyOneDevice("List of devices attached\nabc unauthorized\n"), /not authorized/);
});

test("failure evidence is bounded and owner-local configuration is never read", () => {
  assert.equal(bounded("abcdef", 3), "def");
  const source = fs.readFileSync("tools/android-acceptance/device.mjs", "utf8");
  assert.doesNotMatch(source, /native-provider-config|owner-local|ACCESS_BACKGROUND_LOCATION/);
  assert.match(source, /SKIP.*permission prompt left for the owner/);
  assert.doesNotMatch(source, /pm", "grant|pm grant/);
});

test("device smoke is installed-package-first and submission-free", () => {
  const source = fs.readFileSync("tools/android-acceptance/device.mjs", "utf8");
  assert.match(source, /dumpsys.*package/);
  assert.match(source, /force-stop/);
  assert.doesNotMatch(source, /gradlew|assembleDebug|cap(?:acitor)?\s+sync|prepare:native|adb\(\["install"|manualReportBtn|submitHazardNearMe|createSharedHazardReport/);
  assert.match(source, /--pid=/);
  assert.match(source, /geo", "fix", "-94\.8852", "30\.0466"/);
});

test("unknown options fail before ADB and explain the installed-package-only boundary", () => {
  const result = spawnSync(process.execPath, ["tools/android-acceptance/device.mjs", "--unexpected"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown device harness option: --unexpected/);
  assert.match(result.stderr, /only reuses the already-installed APK/);
  assert.doesNotMatch(result.stderr, /adb .*failed/);
});
