#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

await import(path.join(repoRoot, "js/gridlyTxdotGeometryRetentionPrototype.js"));
await import(path.join(repoRoot, "js/gridlyRouteWatchGeometryShadowScoring.js"));

const fixturesPath = path.join(repoRoot, "data/route-watch-geometry-shadow-fixtures.json");
const fixturesPayload = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));
globalThis.gridlyRouteWatchGeometryShadowFixtures = fixturesPayload;
const auditHelper = globalThis.gridlyRouteWatchGeometryShadowAudit;

if (typeof auditHelper !== "function") {
  throw new Error("V294 Route Watch geometry shadow audit helper is unavailable.");
}

const report = auditHelper();
console.log(JSON.stringify(report, null, 2));

if (!report.validation.passed) {
  process.exitCode = 1;
}
