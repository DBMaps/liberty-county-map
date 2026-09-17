import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const migrationUrl = new URL("supabase/migrations/20260916183911_google_play_compliance_closure.sql", root);
const reportUrl = new URL("docs/launch/GRIDLY-LP24436-PRODUCTION-COMPLIANCE-CERTIFICATION.md", root);
const searchTestUrl = new URL("tests/lp2445c-consumer-visual-search-closure.test.mjs", root);
const expectedHash = "01d37b7ef8a7d4f1d2a2b53ef80ae76c0037e5327eca12596fd26dd723d4fdf4";

test("LP244.36 certifies the exact owner-authorized migration", async () => {
  const migration = await readFile(migrationUrl);
  const report = await readFile(reportUrl, "utf8");
  assert.equal(createHash("sha256").update(migration).digest("hex"), expectedHash);
  assert.match(report.toLowerCase(), new RegExp(expectedHash));
  assert.match(report, /20260916183911_google_play_compliance_closure\.sql/);
  assert.match(report, /version: 20260916183911/);
  assert.match(report, /name:\s+google_play_compliance_closure/);
});

test("LP244.36 deployment record contains all 24 required certification fields", async () => {
  const report = await readFile(reportUrl, "utf8");
  const sections = [
    "Deployment date/time", "Production project identity", "Migration filename",
    "Migration SHA-256", "Preflight result", "Exposed-schema verification",
    "Production deployment result", "Migration ledger result", "Schema result",
    "RLS result", "Grants result", "Public RPC result",
    "Reporting enabled before", "Reporting enabled after", "Report counts before/after",
    "Retention health before/after", "Writer hashes before/after", "Moderation row counts",
    "Deletion row counts", "Test results", "Anomalies", "Rollback posture",
    "Final production state", "Launch implications"
  ];
  sections.forEach((section, index) => {
    const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(report, new RegExp(`## ${index + 1}\\. ${escaped}`));
  });
});

test("certification freezes project, exposure, safety, and unchanged writer evidence", async () => {
  const report = await readFile(reportUrl, "utf8");
  assert.match(report, /Gridly Platform/);
  assert.match(report, /nhwhkbkludzkuyxmkkcj/);
  assert.match(report, /Only the following schemas are exposed: public, graphql_public/);
  assert.match(report, /Reporting enabled before[\s\S]*`false`/);
  assert.match(report, /Reporting enabled after[\s\S]*`false`/);
  for (const hash of [
    "0fcaa36d41beebee7b39935098fd4ddf",
    "e8dfa42f1b9f69627d20fee71203cb59",
    "75ccf495e03ffc3d2e5efce1fc48ddb4",
    "87cb55d3cf2dab858baef30d615645ff"
  ]) assert.match(report, new RegExp(`${hash}[^\\n]*\\| same`));
  assert.match(report, /moderation\.complaints\s+0/);
  assert.match(report, /privacy_ops\.deletion_requests 0/);
});

test("certification records a backend-only deployment and current cache authority", async () => {
  const report = await readFile(reportUrl, "utf8");
  const searchTest = await readFile(searchTestUrl, "utf8");
  for (const statement of [
    "Google Play was not submitted or released.",
    "Apple App Store was not submitted or released.",
    "The final Android AAB was not rebuilt.",
    "Community reporting remains OFF.",
    "The approved 18+ launch posture remains authoritative.",
    "Consumer public launch did not occur."
  ]) assert.ok(report.includes(statement), statement);
  assert.match(report, /A\. PRODUCTION COMPLIANCE DEPLOYED AND CERTIFIED/);
  assert.match(searchTest, /gridly-pwa-shell-lp24433-v1/);
  assert.doesNotMatch(searchTest, /gridly-pwa-shell-lp24429a-v1/);
});
