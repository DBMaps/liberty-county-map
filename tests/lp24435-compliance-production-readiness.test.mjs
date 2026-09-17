import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const migrationPath = new URL("../supabase/migrations/20260916183911_google_play_compliance_closure.sql", import.meta.url);
const reportPath = new URL("../docs/launch/GRIDLY-LP24435-COMPLIANCE-PRODUCTION-READINESS.md", import.meta.url);
const expectedHash = "01d37b7ef8a7d4f1d2a2b53ef80ae76c0037e5327eca12596fd26dd723d4fdf4";

test("LP244.35 readiness report identifies the exact unmodified migration", async () => {
  const migration = await readFile(migrationPath);
  const report = await readFile(reportPath, "utf8");
  assert.equal(createHash("sha256").update(migration).digest("hex"), expectedHash);
  assert.match(report.toLowerCase(), new RegExp(expectedHash));
});

test("LP244.35 readiness report contains every required handoff section", async () => {
  const report = await readFile(reportPath, "utf8");
  const sections = [
    "Migration hash",
    "Production preflight",
    "Schema dependencies",
    "Privilege / RLS review",
    "Retention interaction",
    "Reporting fail-closed review",
    "Public API surface",
    "Disposable rehearsal",
    "Test results",
    "Production postflight SQL",
    "Rollback plan",
    "Remaining risks",
    "Files changed",
    "Commit",
    "Push",
    "Production safety",
    "Final verdict"
  ];
  sections.forEach((section, index) => {
    assert.match(report, new RegExp(`## ${index + 1}\\. ${section.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`, "i"));
  });
  assert.match(report, /A\. READY FOR OWNER-AUTHORIZED PRODUCTION DEPLOYMENT/);
});

test("postflight and rollback guidance remain read-only and evidence-aware", async () => {
  const report = await readFile(reportPath, "utf8");
  assert.match(report, /begin read only;/i);
  assert.match(report, /target_migration_recorded/);
  assert.match(report, /reporting_enabled/);
  assert.match(report, /writer_definitions/);
  assert.match(report, /rollback refused: moderation\/deletion evidence exists/);
  assert.match(report, /Do not delete `20260916183911` from the migration ledger/i);
  assert.match(report, /No production migration was applied/i);
});

test("migration preserves fail-closed reporting and exposes only bounded public wrappers", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.doesNotMatch(migration, /set\s+reporting_enabled\s*=\s*true/i);
  assert.match(migration, /grant execute on function public\.submit_community_moderation_report\(text,uuid,text,text\) to anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.request_community_report_deletion\(text,uuid,text\) to anon, authenticated;/);
  assert.doesNotMatch(migration, /grant execute on function moderation\.apply_action[^;]*to\s+(?:anon|authenticated|service_role)/i);
  assert.doesNotMatch(migration, /grant execute on function privacy_ops\.complete_deletion_request[^;]*to\s+(?:anon|authenticated|service_role)/i);
});
