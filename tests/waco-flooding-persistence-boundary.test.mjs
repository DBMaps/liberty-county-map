import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("js/app.js", "utf8");

test("report submission county metadata expects latitude and longitude", () => {
  assert.match(app, /function gridlyGetReportSubmissionCountyScopedMetadata\(lat, lng\)/);
  assert.match(app, /gridlyGetReportSubmissionCountyScopedMetadata\(lat, lng\)/);
  assert.doesNotMatch(app, /gridlyGetReportSubmissionCountyScopedMetadata\(coordinateCountyResolution\.countyId\)/);
});

test("zero-write diagnostic mirrors the hazard persistence boundary", () => {
  const start = app.indexOf("function gridlyDiagnoseHazardReportPersistenceBoundary");
  const end = app.indexOf("async function createSharedHazardReport", start);
  assert.ok(start > 0 && end > start);
  const diagnostic = app.slice(start, end);
  assert.match(diagnostic, /gridlyResolveCountyIdForCoordinate\(numericLat, numericLng\)/);
  assert.match(diagnostic, /gridlyGetReportSubmissionCountyScopedMetadata\(numericLat, numericLng\)/);
  assert.match(diagnostic, /gridlyPickRowKeys\(row, GRIDLY_REPORTS_BASE_INSERT_KEYS\)/);
  assert.match(diagnostic, /persistenceAttempted: false/);
  assert.match(diagnostic, /wouldSubmit: payloadReady && !blockingGuard/);
  assert.doesNotMatch(diagnostic, /\.insert\s*\(/);
  assert.doesNotMatch(diagnostic, /await gridlyInsertWithCountyMetadataFallback\s*\(/);
});

test("production hazard path reaches the reports insert helper after coordinate metadata", () => {
  const start = app.indexOf("async function createSharedHazardReport");
  const path = app.slice(start, app.indexOf("async function", start + 20));
  const metadata = path.indexOf("gridlyGetReportSubmissionCountyScopedMetadata(lat, lng)");
  const persistence = path.indexOf('gridlyInsertWithCountyMetadataFallback(supabaseClient, "reports", row)');
  assert.ok(metadata > 0);
  assert.ok(persistence > metadata);
});
