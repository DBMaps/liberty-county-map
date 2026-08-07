import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const names = ["apple-app-privacy-draft.json", "google-play-data-safety-draft.json", "store-privacy-uncertainty-register.json", "native-store-permission-gap.json", "lp1841b-summary.json"];
const json = async name => JSON.parse(await readFile(`reports/lp1841b/${name}`, "utf8"));

test("Apple and Google drafts consume LP184.1A evidence and retain platform ambiguity", async () => {
  const [apple, google, uncertainty] = await Promise.all([json(names[0]), json(names[1]), json(names[2])]);
  for (const report of [apple, google]) {
    assert.equal(report.sourceAudit, "LP184.1A");
    assert.ok(report.categories.every(item => item.evidence.length > 0));
    assert.ok(report.categories.flatMap(item => item.evidence).some(item => item.report?.startsWith("reports/lp1841a/")));
  }
  const applePrecise = apple.categories.find(x => x.dataSubcategory === "Precise Location");
  assert.notEqual(applePrecise.collected, "NO");
  assert.equal(applePrecise.classification, "UNKNOWN_REQUIRES_APPLE_POLICY_REVIEW");
  assert.equal(google.categories.some(x => x.dataType.includes("Precise location") && x.collected === "YES"), true);
  assert.equal(apple.backgroundLocationCollected, "NO_IMPLEMENTATION_PROVEN");
  assert.equal(google.backgroundLocationCollected, "NO_IMPLEMENTATION_PROVEN");
  assert.ok(uncertainty.items.every(x => x.platformPolicyReviewRequired && x.recommendedNextAction));
});

test("device identifier, community coordinates, retention and deletion remain truthful", async () => {
  const [apple, google, summary] = await Promise.all([json(names[0]), json(names[1]), json(names[4])]);
  const appleId = apple.categories.find(x => x.dataSubcategory === "Device ID");
  const googleId = google.categories.find(x => x.dataType.includes("device_id"));
  assert.equal(appleId.collected, "YES");
  assert.equal(googleId.collected, "YES");
  assert.match(JSON.stringify([appleId, googleId]), /pseudonymous/i);
  assert.notEqual(appleId.classification, "ANONYMOUS");
  assert.notEqual(googleId.classification, "ANONYMOUS");
  assert.equal(google.categories.some(x => x.dataType.includes("Supabase community report coordinates") && x.ephemeral === "NO"), true);
  assert.equal(summary.retentionDisclosureStatus, "UNKNOWN");
  assert.equal(summary.deletionMechanismStatus, "NOT_PROVEN_STORE_READINESS_BLOCKER");
  assert.equal(google.categories.filter(x => x.collected === "YES").some(x => x.deletionRequestSupported === "YES"), false);
});

test("no analytics, advertising, payment or inbound official-data sharing is invented", async () => {
  const [apple, google, summary] = await Promise.all([json(names[0]), json(names[1]), json(names[4])]);
  assert.equal(summary.analyticsStatus, "ABSENT_NOT_INVENTED");
  assert.equal(summary.advertisingTrackingStatus, "ABSENT_NOT_INVENTED");
  assert.equal(summary.purchasePaymentStatus, "ABSENT_NOT_INVENTED");
  assert.equal(apple.categories.filter(x => ["Purchases", "Usage Data", "Diagnostics"].includes(x.dataCategory)).every(x => x.collected === "NO"), true);
  for (const purpose of google.categories.flatMap(x => x.purposes)) assert.notEqual(purpose, "ANALYTICS");
  const inbound = google.thirdPartyDataFlows.filter(x => /DriveTexas|Weather/.test(x.provider));
  assert.ok(inbound.every(x => x.storeDisclosureImplication.startsWith("DO_NOT_LABEL_INBOUND")));
});

test("third-party flows and native permission gaps are retained", async () => {
  const [google, native] = await Promise.all([json(names[1]), json(names[3])]);
  for (const provider of ["Supabase", "OSRM public demo server", "OpenStreetMap Nominatim", "OpenStreetMap/Carto/Esri"]) assert.ok(google.thirdPartyDataFlows.some(x => x.provider === provider));
  assert.equal(native.android.finding, "ANDROID_LOCATION_DECLARATION_REVIEW_REQUIRED");
  assert.equal(native.ios.finding, "IOS_LOCATION_USAGE_DESCRIPTION_REVIEW_REQUIRED");
  assert.equal(native.nativeProjectsModified, false);
});

test("output is deterministic, canonical, secret-safe, non-executing, and preserves governance", async () => {
  execFileSync("node", ["tools/lp1841b/build-store-privacy-mapping.mjs", "verify"], { stdio: "pipe" });
  const summary = await json(names[4]);
  assert.equal(summary.runtimeModified, false);
  assert.equal(summary.nativeConfigModified, false);
  assert.equal(summary.performsStoreSubmission, false);
  assert.equal(summary.performsDeployment, false);
  assert.equal(summary.performsDistribution, false);
  assert.equal(summary.authorizationsChanged, false);
  assert.equal(summary.scopedPreviewGovernancePreserved, true);
  const protectedDiff = execFileSync("git", ["diff", "--name-only", "--", "index.html", "js/app.js", "manifest.json", "service-worker.js", "android", "ios", "capacitor.config.json", "capacitor.config.ts"], { encoding: "utf8" }).trim();
  assert.equal(protectedDiff, "");
  for (const name of names) {
    const raw = await readFile(`reports/lp1841b/${name}`, "utf8");
    assert.equal(raw.startsWith("\ufeff"), false);
    assert.equal(raw.includes("\r"), false);
    assert.doesNotMatch(raw, /(?:service_role|SUPABASE_(?:ANON|PUBLIC|SERVICE)[_A-Z]*KEY|eyJ[A-Za-z0-9_-]{20,})/);
  }
});
