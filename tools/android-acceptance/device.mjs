import { adb, bounded, exactlyOneDevice, PACKAGE, writeReports } from "./core.mjs";
import { AndroidHarnessError, cleanupCreatedForward, connectReadyWebView, pollUntil, waitForCdpReadiness } from "./cdp.mjs";
import { waitForDallasTerminal } from "./dallas-terminal.mjs";

const options = process.argv.slice(2);
if (options.length) {
  console.error(`Unknown device harness option: ${options[0]}. This command only reuses the already-installed APK. Build, sync, and install through the governed native workflow first.`);
  process.exit(2);
}

const results = [];
const add = (status, name, detail = "") => { results.push({ status, name, detail }); console.log(`${status.padEnd(4)} ${name}${detail ? ` — ${detail}` : ""}`); };
let serial;
let metadata = {};
let diagnostics = "";
let page;
let forwardCreated = false;

try {
  serial = exactlyOneDevice(adb(["devices"]));
  const model = adb(["shell", "getprop", "ro.product.model"], { serial });
  const api = adb(["shell", "getprop", "ro.build.version.sdk"], { serial });
  const emulator = serial.startsWith("emulator-") || adb(["shell", "getprop", "ro.kernel.qemu"], { serial, allowFailure: true }) === "1";
  metadata = { deviceId: serial, model, apiLevel: api, target: emulator ? "emulator" : "physical device" };
  console.log(`Target: ${serial} | ${model} | API ${api} | ${metadata.target}`);

  const packageInfo = adb(["shell", "dumpsys", "package", PACKAGE], { serial, allowFailure: true });
  if (!/versionName=/.test(packageInfo)) throw new Error(`${PACKAGE} is not installed. Install a debug APK, or explicitly build/install it outside the ordinary smoke rerun.`);
  metadata.versionName = packageInfo.match(/versionName=([^\s]+)/)?.[1] || "unknown";
  metadata.lastUpdateTime = packageInfo.match(/lastUpdateTime=([^\r\n]+)/)?.[1]?.trim() || "unknown";
  add("PASS", "installed package", `version ${metadata.versionName}; updated ${metadata.lastUpdateTime}`);

  if (emulator) {
    adb(["emu", "geo", "fix", "-94.8852", "30.0466"], { serial });
    add("PASS", "emulator GPS set", "Dayton 30.0466, -94.8852");
  } else add("SKIP", "emulator GPS set", "physical devices are never sent emulator geo commands");

  adb(["logcat", "-c"], { serial });
  adb(["shell", "am", "force-stop", PACKAGE], { serial });
  adb(["shell", "monkey", "-p", PACKAGE, "-c", "android.intent.category.LAUNCHER", "1"], { serial });

  const pid = await pollUntil(() => adb(["shell", "pidof", PACKAGE], { serial, allowFailure: true }), { stage: "process missing" });
  add("PASS", "cold launch and process alive", `pid ${pid}`);

  const socket = `@webview_devtools_remote_${pid}`;
  await pollUntil(() => adb(["shell", "cat", "/proc/net/unix"], { serial, allowFailure: true }).split(/\r?\n/).some(line => line.trim().endsWith(socket)), { stage: "socket missing" });
  try {
    const existing = adb(["forward", "--list"], { serial, allowFailure: true });
    if (existing.split(/\r?\n/).some(line => line.split(/\s+/)[1] === "tcp:9222")) throw new Error("tcp:9222 is already owned by another forward");
    adb(["forward", "tcp:9222", `localabstract:webview_devtools_remote_${pid}`], { serial });
    forwardCreated = true;
  } catch (error) {
    throw new AndroidHarnessError("forward failure", error.message, error);
  }
  const readiness = await waitForCdpReadiness("http://127.0.0.1:9222");
  const connected = await connectReadyWebView(readiness);
  page = connected.page;
  await page.waitForSelector("#gridlyAddressSearchInput", { state: "attached", timeout: 15000 });
  add("PASS", "debug WebView/CDP inspection", `${page.url()} via ${connected.connection}`);

  const jsErrors = [];
  await page.evaluate(() => document.getElementById("mobileDestinationCommandBtn")?.click());
  await page.evaluate(() => { const input = document.getElementById("gridlyAddressSearchInput"); input.value = "Dallas"; input.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.evaluate(() => document.getElementById("gridlyRemoteSearchBtn")?.click());
  const search = await waitForDallasTerminal(
    () => page.evaluate(() => document.getElementById("gridlySearchResults")?.innerText || ""),
    { timeoutMs: 15000, intervalMs: 100 }
  );
  const searchDetail = bounded(search.text, 500) || "empty result surface";
  const searchPid = adb(["shell", "pidof", PACKAGE], { serial, allowFailure: true });
  add(searchPid ? "PASS" : "FAIL", "Dallas search keeps app alive", `pid ${searchPid || "missing"}`);
  add(search.terminal ? "PASS" : "FAIL", "terminal provider response observed", search.terminal ? searchDetail : "Dallas search timed out before a terminal result.");
  add(search.visibleDallas ? "PASS" : "FAIL", "visible Dallas result", searchDetail);
  add(search.noMatch ? "PASS" : "SKIP", "explicit no-governed-match response", search.noMatch ? searchDetail : "not observed");
  add(search.providerFailure ? "PASS" : "SKIP", "explicit provider/search failure", search.providerFailure ? searchDetail : "not observed");

  const finePermissionGranted = /android\.permission\.ACCESS_FINE_LOCATION:\s+granted=true/.test(packageInfo);
  if (!finePermissionGranted) {
    await page.evaluate(() => document.getElementById("useLocationBtn")?.click());
    add("SKIP", "native location consumed by UI", "permission prompt left for the owner; the harness never silently grants location");
  } else {
    const nativePosition = await page.evaluate(() => new Promise((resolve, reject) => window.requestGridlyForegroundPosition(resolve, reject, { timeout: 10000 })));
    const lat = Number(nativePosition?.coords?.latitude); const lng = Number(nativePosition?.coords?.longitude);
    const dayton = Math.abs(lat - 30.0466) < 0.02 && Math.abs(lng + 94.8852) < 0.02;
    add(dayton ? "PASS" : "FAIL", "native plugin returns Dayton coordinates", `${lat}, ${lng}`);
    await page.evaluate(() => document.getElementById("useLocationBtn")?.click());
    await new Promise(resolve => setTimeout(resolve, 500));
    const center = await page.evaluate(() => typeof map?.getCenter === "function" ? map.getCenter() : null);
    add(center && Math.abs(center.lat - lat) < 0.05 && Math.abs(center.lng - lng) < 0.05 ? "PASS" : "FAIL", "UI consumes native location", center ? `${center.lat}, ${center.lng}` : "map center unavailable");
  }

  const logs = adb(["logcat", "-d", `--pid=${pid}`, "-v", "brief"], { serial, allowFailure: true });
  jsErrors.push(...page.exceptions);
  const fatal = /FATAL EXCEPTION|AndroidRuntime|SIG(?:SEGV|ABRT)|providerId[^\n]*(?:TypeError|undefined|null)|Uncaught (?:TypeError|ReferenceError)/i.test(`${logs}\n${jsErrors.join("\n")}`);
  add(fatal ? "FAIL" : "PASS", "no native crash, providerId error, or WebView exception", fatal ? "see bounded diagnostics" : "scoped process log clean");
  diagnostics = fatal ? `${logs}\n${jsErrors.join("\n")}` : "";
  add(adb(["shell", "pidof", PACKAGE], { serial, allowFailure: true }) ? "PASS" : "FAIL", "process remains alive");
} catch (error) {
  diagnostics = `${error.stack || error}\n${serial ? adb(["logcat", "-d", "-t", "250", "-v", "brief"], { serial, allowFailure: true }) : ""}`;
  add("FAIL", "device harness preflight/runtime", error.message);
} finally {
  await page?.close().catch(() => {});
  cleanupCreatedForward(serial && forwardCreated, () => adb(["forward", "--remove", "tcp:9222"], { serial, allowFailure: true }));
  writeReports(results, metadata, diagnostics);
  console.log(`\nReport: .artifacts/android-acceptance/latest.{json,md}`);
  const failures = results.filter(item => item.status === "FAIL").length;
  console.log(`Summary: ${results.filter(item => item.status === "PASS").length} PASS, ${failures} FAIL, ${results.filter(item => item.status === "SKIP").length} SKIP`);
  if (failures) process.exitCode = 1;
}
