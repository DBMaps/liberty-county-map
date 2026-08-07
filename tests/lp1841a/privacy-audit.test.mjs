import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const json = async name => JSON.parse(await readFile(`reports/lp1841a/${name}`, "utf8"));
const app = await readFile("js/app.js", "utf8");

test("inventory is evidence-backed and truthfully classifies identity, accounts, payments, analytics and retention", async () => {
  const report = await json("data-inventory.json");
  assert.ok(report.dataClasses.every(item => item.evidence.length && item.classification));
  assert.equal(report.dataClasses.find(item => item.name === "persistent_device_identifier").classification, "PSEUDONYMOUS_NOT_ANONYMOUS");
  assert.equal(report.accounts.email, false);
  assert.equal(report.payments.classification, "ABSENT");
  assert.equal(report.analytics.googleAnalytics, "ABSENT");
  assert.equal(report.dataClasses.find(item => item.name === "community_report").retention.includes("UNKNOWN"), true);
});

test("location and community report findings match protected implementation", async () => {
  const location = await json("location-privacy-audit.json");
  const community = await json("community-reporting-privacy-audit.json");
  assert.match(app, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(app, /navigator\.geolocation\.watchPosition/);
  assert.match(app, /navigator\.geolocation\.clearWatch/);
  assert.equal(location.preciseLocation, true);
  assert.equal(location.routeWatch.backgroundLocation, false);
  assert.equal(location.currentLocationToSupabase, false);
  for (const field of community.submittedFields) assert.match(app, new RegExp(`${field}:|["']${field}["']`));
  assert.equal(community.classification, "PSEUDONYMOUS_SHARED_COMMUNITY_REPORTING");
});

test("authorization, zero execution, protected runtime and deterministic secret-safe output are enforced", async () => {
  execFileSync("node", ["tools/lp1841a/build-privacy-audit.mjs", "verify"], { stdio: "pipe" });
  const summary = await json("lp1841a-summary.json");
  assert.equal(summary.executionOccurred, false);
  assert.equal(summary.authorizationsChanged, false);
  assert.equal(summary.runtimeChanged, false);
  const files = execFileSync("git", ["diff", "--name-only", "--", "index.html", "js/app.js", "manifest.json", "service-worker.js", "android/app/src/main/AndroidManifest.xml", "ios/App/App/Info.plist"], { encoding: "utf8" }).trim();
  assert.equal(files, "");
  for (const name of [...summary.sourceReports, "lp1841a-summary.json"]) {
    const raw = await readFile(`reports/lp1841a/${name}`, "utf8");
    assert.equal(raw.charCodeAt(0) === 0xfeff, false);
    assert.equal(raw.includes("\r"), false);
    assert.doesNotMatch(raw, /(?:service_role|SUPABASE_PUBLIC_KEY\s*=|eyJ[A-Za-z0-9_-]{20,})/);
  }
});
