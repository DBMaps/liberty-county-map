import { chromium } from "@playwright/test";
import { adb, bounded, exactlyOneDevice, PACKAGE, writeReports } from "./core.mjs";

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
let browser;

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

  let pid = "";
  const deadline = Date.now() + 15000;
  while (!pid && Date.now() < deadline) {
    pid = adb(["shell", "pidof", PACKAGE], { serial, allowFailure: true });
    if (!pid) await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!pid) throw new Error("Gridly process did not start within 15 seconds.");
  add("PASS", "cold launch and process alive", `pid ${pid}`);

  adb(["forward", "tcp:9222", `localabstract:webview_devtools_remote_${pid}`], { serial });
  browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const page = browser.contexts().flatMap(context => context.pages())[0];
  if (!page) throw new Error("Debug WebView exposed no inspectable page. Use a debug APK and current Android System WebView.");
  await page.waitForSelector("#gridlyAddressSearchInput", { state: "attached", timeout: 15000 });
  add("PASS", "debug WebView/CDP inspection", page.url());

  const jsErrors = [];
  page.on("pageerror", error => jsErrors.push(error.message));
  await page.evaluate(() => document.getElementById("mobileDestinationCommandBtn")?.click());
  await page.locator("#gridlyAddressSearchInput").fill("Dallas");
  await page.locator("#gridlyRemoteSearchBtn").click();
  await page.waitForFunction(() => !/searching/i.test(document.getElementById("gridlySearchResults")?.textContent || ""), null, { timeout: 15000 });
  const search = await page.locator("#gridlySearchResults").innerText();
  add("PASS", "Dallas search keeps app alive", `pid ${adb(["shell", "pidof", PACKAGE], { serial, allowFailure: true }) || "missing"}`);
  add(/Dallas/i.test(search) ? "PASS" : "FAIL", "visible Dallas result", bounded(search, 500) || "empty result surface");
  add(/No matching destination found/i.test(search) ? "SKIP" : "PASS", "Dallas provider/result state", /No matching destination found/i.test(search) ? "provider returned no governed match" : "governed result rendered");

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
    await page.waitForTimeout(500);
    const center = await page.evaluate(() => typeof map?.getCenter === "function" ? map.getCenter() : null);
    add(center && Math.abs(center.lat - lat) < 0.05 && Math.abs(center.lng - lng) < 0.05 ? "PASS" : "FAIL", "UI consumes native location", center ? `${center.lat}, ${center.lng}` : "map center unavailable");
  }

  const logs = adb(["logcat", "-d", `--pid=${pid}`, "-v", "brief"], { serial, allowFailure: true });
  const fatal = /FATAL EXCEPTION|AndroidRuntime|SIG(?:SEGV|ABRT)|providerId[^\n]*(?:TypeError|undefined|null)|Uncaught (?:TypeError|ReferenceError)/i.test(`${logs}\n${jsErrors.join("\n")}`);
  add(fatal ? "FAIL" : "PASS", "no native crash, providerId error, or WebView exception", fatal ? "see bounded diagnostics" : "scoped process log clean");
  diagnostics = fatal ? `${logs}\n${jsErrors.join("\n")}` : "";
  add(adb(["shell", "pidof", PACKAGE], { serial, allowFailure: true }) ? "PASS" : "FAIL", "process remains alive");
} catch (error) {
  diagnostics = `${error.stack || error}\n${serial ? adb(["logcat", "-d", "-t", "250", "-v", "brief"], { serial, allowFailure: true }) : ""}`;
  add("FAIL", "device harness preflight/runtime", error.message);
} finally {
  await browser?.close().catch(() => {});
  if (serial) adb(["forward", "--remove", "tcp:9222"], { serial, allowFailure: true });
  writeReports(results, metadata, diagnostics);
  console.log(`\nReport: .artifacts/android-acceptance/latest.{json,md}`);
  const failures = results.filter(item => item.status === "FAIL").length;
  console.log(`Summary: ${results.filter(item => item.status === "PASS").length} PASS, ${failures} FAIL, ${results.filter(item => item.status === "SKIP").length} SKIP`);
  if (failures) process.exitCode = 1;
}
