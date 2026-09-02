import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { bounded, exactlyOneDevice, parseDevices } from "../tools/android-acceptance/core.mjs";

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
