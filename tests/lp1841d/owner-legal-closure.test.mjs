import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const readJson = async name => JSON.parse(await readFile(`reports/lp1841d/${name}`, "utf8"));
const drafts = ["privacy-policy.md","terms-of-service.md","community-reporting-guidelines.md","location-route-intelligence-disclosure.md"];

test("owner decisions have exact governed classifications", async () => {
  const register = await readJson("owner-decision-register.json");
  assert.equal(register.records.length, 14);
  assert.deepEqual(register.records.map(x => x.id), ["LEGAL_OPERATOR","SUPPORT_CONTACT","PRIVACY_CONTACT","MINIMUM_AGE","SERVER_HISTORICAL_RETENTION","HAZARD_ZIP_VS_REPORTER_ZIP","PRIVACY_REQUEST_PROCESS","REPORT_REMOVAL","SUBSCRIPTION_INTENT","GOVERNING_LAW","DISPUTE_TERMS","LIABILITY_SAFETY_POLICY","FUTURE_COMMERCIAL_INTELLIGENCE","FINAL_EFFECTIVE_DATE"]);
  assert.ok(register.records.every(x => x.blocksScopedPreviewValidation === false));
});

test("readiness fails closed without impacting scoped preview", async () => {
  const report = await readJson("legal-readiness-reassessment.json");
  assert.equal(report.status, "LEGAL_OWNER_DECISIONS_SUBSTANTIALLY_COMPLETE_FINAL_APPROVAL_REQUIRED");
  assert.equal(report.pass, false);
  assert.equal(report.closed, false);
  assert.equal(report.blocksScopedPreviewValidation, false);
  assert.equal(report.blocksStoreSubmission, true);
});

test("drafts remain unapproved and do not claim unresolved operations", async () => {
  const all = (await Promise.all(drafts.map(x => readFile(`legal/drafts/${x}`, "utf8")))).join("\n");
  assert.equal((all.match(/DRAFT — NOT LEGALLY APPROVED/g) || []).length, 4);
  assert.match(all, /Neither mailbox is yet proven operational/);
  assert.match(all, /not currently operational/);
  assert.match(all, /no device-link deidentification lifecycle currently exists/i);
  assert.match(all, /No payment or subscription implementation currently exists/);
  assert.match(all, /Current stored reports are not represented as already deidentified/);
  assert.doesNotMatch(all, /Effective Date:\s*(?:19|20)\d\d/);
});

test("summary preserves authorizations, protected scope, and all store blockers", async () => {
  execFileSync("node", ["tools/lp1841d/close-owner-legal-decisions.mjs", "verify"]);
  const summary = await readJson("lp1841d-summary.json");
  assert.equal(summary.scopedPreviewImpact, "NO_NEW_BLOCKER");
  assert.deepEqual(summary.authorizationsGranted, []);
  assert.equal(summary.storeSubmissionBlockers.length, 11);
  assert.equal(summary.storeSubmissionOccurred, false);
  const diff = execFileSync("git", ["diff","--name-only","--","index.html","js/app.js","manifest.json","service-worker.js","android","ios"], {encoding:"utf8"}).trim();
  assert.equal(diff, "");
});
