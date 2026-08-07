import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const draftNames = ["privacy-policy.md", "terms-of-service.md", "community-reporting-guidelines.md", "location-route-intelligence-disclosure.md"];
const draft = name => readFile(`legal/drafts/${name}`, "utf8");
const report = async name => JSON.parse(await readFile(`reports/lp1841c/${name}`, "utf8"));

test("every draft is conspicuously unapproved and has no invented effective date", async () => {
  for (const name of draftNames) {
    const text = await draft(name);
    assert.ok(text.startsWith("DRAFT — NOT LEGALLY APPROVED\n\nEffective Date: [TO BE SET AT LEGAL APPROVAL]"));
    assert.doesNotMatch(text, /Effective Date:\s*(?:19|20)\d\d/);
  }
});

test("privacy and location disclosures state governed behavior without invention", async () => {
  const text = `${await draft("privacy-policy.md")}\n${await draft("location-route-intelligence-disclosure.md")}`;
  assert.match(text, /precise foreground location/i);
  assert.match(text, /No background-location implementation is currently proven/i);
  assert.match(text, /persistent pseudonymous device identifier/i);
  assert.match(text, /not anonymous/i);
  assert.match(text, /Report expiry does not prove server deletion/i);
  assert.match(text, /No consumer account or login is currently implemented/i);
  assert.match(text, /No payment or subscription implementation currently exists/i);
  assert.match(text, /No analytics or advertising stack was found/i);
  assert.doesNotMatch(text, /reporting is anonymous/i);
});

test("safety and community language does not elevate community evidence", async () => {
  const terms = await draft("terms-of-service.md");
  const community = await draft("community-reporting-guidelines.md");
  assert.match(terms, /not an emergency service/i);
  assert.match(terms, /not official evidence/i);
  assert.match(terms, /not automatically authoritative weather evidence/i);
  assert.match(community, /not official evidence/i);
  assert.match(community, /Official traffic controls[\s\S]*always take priority/i);
});

test("commercial, contact, operator, age, and legal questions remain placeholders", async () => {
  const all = (await Promise.all(draftNames.map(draft))).join("\n");
  for (const placeholder of ["[GRIDLY LEGAL OPERATOR]", "[GRIDLY SUPPORT CONTACT]", "[GRIDLY PRIVACY CONTACT]", "[MINIMUM AGE]", "[GOVERNING LAW]"]) assert.ok(all.includes(placeholder));
  assert.match(await draft("terms-of-service.md"), /\[SUBSCRIPTION TERMS — OWNER\/LEGAL DECISION REQUIRED\]/);
  assert.doesNotMatch(all, /\$\d|per month|per year|Apple billing|Google billing|web billing/i);
});

test("decision register is complete without turning legal approval into a scoped-preview blocker", async () => {
  const register = await report("legal-owner-decision-register.json");
  const expected = ["LEGAL_OPERATOR","SUPPORT_CONTACT","PRIVACY_CONTACT","MINIMUM_AGE","SERVER_RETENTION","PRIVACY_REQUEST_PROCESS","REPORT_REMOVAL","SUBSCRIPTION_TERMS","GOVERNING_LAW","DISPUTE_TERMS","LIABILITY_REVIEW","FUTURE_AGGREGATED_DATA_POLICY","FINAL_EFFECTIVE_DATE"];
  assert.deepEqual(register.records.map(x => x.id), expected);
  for (const item of register.records) {
    assert.deepEqual(Object.keys(item), ["id","currentEvidence","ownerDecisionRequired","legalReviewRequired","blocksStoreSubmission","blocksPublicLaunch","blocksScopedPreviewValidation"]);
    assert.equal(item.ownerDecisionRequired, true);
    assert.equal(item.legalReviewRequired, true);
    assert.equal(item.blocksScopedPreviewValidation, false);
  }
});

test("LP167-B012 remains open with exact closure work", async () => {
  const reassessment = await report("legal-readiness-reassessment.json");
  assert.equal(reassessment.status, "LEGAL_DRAFTING_COMPLETE_APPROVAL_REQUIRED");
  assert.equal(reassessment.pass, false);
  assert.equal(reassessment.closed, false);
  assert.equal(reassessment.whatRemainsBeforeClosure.length, 5);
  assert.equal(reassessment.blocksScopedPreviewValidation, false);
  assert.equal(reassessment.blocksStoreSubmission, true);
});

test("outputs are deterministic, secret-safe, non-executing, and protected files and authorizations remain unchanged", async () => {
  execFileSync("node", ["tools/lp1841c/build-consumer-legal-drafts.mjs", "verify"], { stdio: "pipe" });
  const summary = await report("lp1841c-summary.json");
  assert.equal(summary.classification, "DRAFTS_COMPLETE_OWNER_LEGAL_REVIEW_REQUIRED");
  assert.equal(summary.runtimeModified, false);
  assert.equal(summary.nativeFilesModified, false);
  assert.equal(summary.authorizationsChanged, false);
  assert.equal(summary.deterministic, true);
  assert.equal(summary.secretSafety, "PASS_NO_SECRETS_EMITTED");
  const protectedDiff = execFileSync("git", ["diff", "--name-only", "--", "index.html", "js/app.js", "manifest.json", "service-worker.js", "android", "ios"], { encoding: "utf8" }).trim();
  assert.equal(protectedDiff, "");
  for (const file of [...draftNames.map(x => `legal/drafts/${x}`), "reports/lp1841c/legal-owner-decision-register.json", "reports/lp1841c/legal-readiness-reassessment.json", "reports/lp1841c/lp1841c-summary.json"]) {
    const raw = await readFile(file, "utf8");
    assert.equal(raw.includes("\r"), false);
    assert.doesNotMatch(raw, /(?:service_role|SUPABASE_(?:ANON|PUBLIC|SERVICE)[_A-Z]*KEY|eyJ[A-Za-z0-9_-]{20,})/);
  }
});
