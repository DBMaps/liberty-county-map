import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { bounded, exactlyOneDevice, parseDevices } from "../tools/android-acceptance/core.mjs";
import { AndroidWebViewPage, cleanupCreatedForward, connectReadyWebView, pollUntil, selectGridlyTarget, waitForCdpReadiness } from "../tools/android-acceptance/cdp.mjs";
import { classifyDallasTerminal, waitForDallasTerminal } from "../tools/android-acceptance/dallas-terminal.mjs";

const gridly = { type: "page", url: "https://localhost/", title: "Gridly | Know Before You Go", webSocketDebuggerUrl: "ws://page" };

function textSequence(values) {
  let index = 0;
  return async () => values[Math.min(index++, values.length - 1)];
}

test("initial empty Dallas result surface is pending", () => {
  assert.deepEqual(classifyDallasTerminal(""), {
    kind: "pending", text: "", terminal: false, visibleDallas: false, noMatch: false, providerFailure: false
  });
});

test("delayed visible Dallas result is observed", async () => {
  const result = await waitForDallasTerminal(textSequence(["", "Checking nearby places…", " Dallas   County "]), { timeoutMs: 100, intervalMs: 1 });
  assert.equal(result.kind, "dallas");
  assert.equal(result.text, "Dallas County");
  assert.equal(result.visibleDallas, true);
});

test("delayed no-match is terminal but fails Dallas visibility", async () => {
  const result = await waitForDallasTerminal(textSequence(["", "No matching destination found. Try adding the city or ZIP code."]), { timeoutMs: 100, intervalMs: 1 });
  assert.equal(result.kind, "no_match");
  assert.equal(result.terminal, true);
  assert.equal(result.noMatch, true);
  assert.equal(result.visibleDallas, false);
});

test("explicit provider failure is classified separately", async () => {
  const result = await waitForDallasTerminal(textSequence(["", "Address search is temporarily unavailable. Try again in a moment."]), { timeoutMs: 100, intervalMs: 1 });
  assert.equal(result.kind, "provider_failure");
  assert.equal(result.providerFailure, true);
  assert.equal(result.noMatch, false);
});

test("permanently empty Dallas result surface times out", async () => {
  const result = await waitForDallasTerminal(async () => "", { timeoutMs: 5, intervalMs: 1 });
  assert.equal(result.kind, "timeout");
  assert.equal(result.terminal, false);
  assert.equal(result.text, "");
});

test("fast synchronous Dallas result is read before the first polling delay", async () => {
  let reads = 0;
  const result = await waitForDallasTerminal(async () => { reads++; return "Dallas, Texas"; }, { timeoutMs: 100, intervalMs: 50 });
  assert.equal(result.kind, "dallas");
  assert.equal(reads, 1);
});

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

class OwnerFailureSocket extends EventTarget {
  static instances = [];
  readyState = 0;
  sent = [];
  constructor(url) {
    super();
    this.url = url;
    OwnerFailureSocket.instances.push(this);
    queueMicrotask(() => { this.readyState = 1; this.dispatchEvent(new Event("open")); });
  }
  send(payload) {
    const request = JSON.parse(payload);
    this.sent.push(request);
    // This fixture represents both owner URLs accepting sockets while the Browser
    // command fails. The repaired harness must select ws://page and never send it.
    const response = request.method === "Browser.setDownloadBehavior"
      ? { id: request.id, error: { message: "Browser context management is not supported." } }
      : request.method === "Runtime.evaluate"
        ? { id: request.id, result: request.params.expression.includes("throw")
          ? { exceptionDetails: { text: "Uncaught", exception: { description: "Error: fixture evaluation" } } }
          : { result: { value: 42 } } }
        : { id: request.id, result: {} };
    queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(response) })));
  }
  close() { this.readyState = 3; queueMicrotask(() => this.dispatchEvent(new Event("close"))); }
}

test("owner failure fixture connects directly to the selected Android WebView page", async () => {
  OwnerFailureSocket.instances.length = 0;
  const connected = await connectReadyWebView({ version: { webSocketDebuggerUrl: "ws://browser" }, target: gridly }, { WebSocketImpl: OwnerFailureSocket });
  const socket = OwnerFailureSocket.instances[0];
  assert.equal(socket.url, "ws://page");
  assert.equal(connected.connection, "raw page-level CDP");
  assert.deepEqual(socket.sent.map(item => item.method), ["Runtime.enable", "Page.enable"]);
  assert.doesNotMatch(socket.sent.map(item => item.method).join(" "), /Browser\.setDownloadBehavior/);
  await connected.page.close();
});

test("raw page CDP Runtime.evaluate returns values and reports evaluation errors", async () => {
  const connected = await connectReadyWebView({ target: gridly }, { WebSocketImpl: OwnerFailureSocket });
  assert.equal(await connected.page.evaluate("21 + 21"), 42);
  await assert.rejects(connected.page.evaluate("throw new Error('no')"), /fixture evaluation/);
  await connected.page.close();
});

test("raw page CDP requests time out within their bound", async () => {
  class SilentSocket extends EventTarget { readyState = 1; send() {} close() { this.readyState = 3; this.dispatchEvent(new Event("close")); } }
  const page = new AndroidWebViewPage(new SilentSocket(), { timeoutMs: 5 });
  await assert.rejects(page.send("Runtime.evaluate"), /did not respond within 5ms/);
});

test("raw page CDP closes its socket orderly", async () => {
  const socket = new OwnerFailureSocket("ws://page");
  await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
  const page = new AndroidWebViewPage(socket);
  await page.close();
  assert.equal(socket.readyState, 3);
});

test("executable Android harness has no browser-context CDP connection path", () => {
  for (const file of ["tools/android-acceptance/cdp.mjs", "tools/android-acceptance/device.mjs"])
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), new RegExp(["connect", "Over", "CDP"].join("")));
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
