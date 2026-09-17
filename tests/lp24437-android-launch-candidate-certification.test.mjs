import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const reportUrl = new URL("../docs/launch/GRIDLY-LP24437-ANDROID-LAUNCH-CANDIDATE-CERTIFICATION.md", import.meta.url);
const gradleUrl = new URL("../android/app/build.gradle", import.meta.url);
const complianceUrl = new URL("../js/gridly-ugc-compliance.js", import.meta.url);

const requiredSections = [
  "Source main SHA", "Branch", "Package ID", "versionName", "versionCode", "minSdk", "targetSdk",
  "18+ verification", "UGC acceptance version", "Reporting production state", "Signing identity",
  "Certificate SHA-256", "Native staging result", "Regression results", "AAB path", "AAB size",
  "AAB SHA-256", "Build environment", "Package audit", "Installable test artifact",
  "Store declaration alignment", "Physical-device acceptance status", "Known limitations", "Launch state",
  "Final verdict"
];

test("LP244.37 certification contains all 25 required fields", async () => {
  const report = await readFile(reportUrl, "utf8");
  requiredSections.forEach((section, index) => {
    const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(report, new RegExp(`## ${index + 1}\\. ${escaped}`));
  });
});

test("LP244.37 freezes source, package, legal, reporting, and signer authority", async () => {
  const [report, gradle, compliance] = await Promise.all([
    readFile(reportUrl, "utf8"), readFile(gradleUrl, "utf8"), readFile(complianceUrl, "utf8")
  ]);
  for (const expected of [
    "2f7e1948246852f1a047654f7cc56e2ad70a0714",
    "LP244.37-final-android-launch-candidate",
    "com.gridlygo.gridly",
    "gridly-ugc-2026-09-17-v2",
    "84:FB:65:B7:E3:65:38:DD:1F:B9:57:27:B8:9E:46:44:BB:0C:F5:1A:1B:B2:70:C2:54:26:9D:CD:FC:F7:C8:A3"
  ]) assert.ok(report.includes(expected));
  assert.match(report, /reporting_enabled` \| `false`/);
  assert.match(report, /18 and over only/);
  assert.match(gradle, /applicationId 'com\.gridlygo\.gridly'/);
  assert.match(gradle, /minSdk 24/);
  assert.match(gradle, /targetSdk 36/);
  assert.match(gradle, /versionCode 1/);
  assert.match(gradle, /versionName '1\.0\.0'/);
  assert.match(compliance, /gridly-ugc-2026-09-17-v2/);
});

test("LP244.37 freezes native, regression, and release artifact evidence", async () => {
  const report = await readFile(reportUrl, "utf8");
  for (const expected of [
    "946", "206,772,450", "88a84e09472326c63ba3e8458d1d888b036731d48115173e26c756c305863980",
    "56/56 pass", "94/94 pass", "45/45 pass",
    "android/app/build/outputs/bundle/release/app-release.aab", "85,492,395",
    "DEAEC38CF89F6BD1894322198681F040499C4030007E7ECDE4D56915A29D48B0",
    "android/app/build/outputs/apk/release/app-release.apk", "85,965,377",
    "7CAB5C12DECB316D8A147182F009392D6CE372342DC7E0CF3EB689C2B2D28B85"
  ]) assert.ok(report.includes(expected));
  assert.match(report, /exactly one signer/);
  assert.match(report, /PROHIBITED|\.env|keystore/i);
  assert.doesNotMatch(report, /sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/);
});

test("LP244.37 records store alignment, pending device acceptance, and no launch", async () => {
  const report = await readFile(reportUrl, "utf8");
  for (const url of ["privacy", "terms", "community-guidelines", "support", "delete-data"]) {
    assert.ok(report.includes(`https://gridlygo.com/${url}`));
  }
  for (const statement of [
    "PENDING — NOT YET CERTIFIED",
    "Google Play was not uploaded, submitted, or released.",
    "Apple App Store was not submitted or released.",
    "Reporting remains OFF.",
    "Production compliance remains certified.",
    "The 18+ posture remains authoritative.",
    "Public launch did not occur.",
    "A. ANDROID LAUNCH CANDIDATE BUILT AND READY FOR PHYSICAL ACCEPTANCE"
  ]) assert.ok(report.includes(statement));
});
