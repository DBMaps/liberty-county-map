import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { audit, systems, countyMatrix, legacyFindings, CLASSIFICATIONS } from "../tools/lp204/build-statewide-functional-coverage-audit.mjs";

const system = (name) => systems.find((entry) => entry.systemName === name);
test("LP204 emits all 254 county rows and governed crossing positive control", () => {
  assert.equal(countyMatrix.length, 254);
  assert.equal(new Set(countyMatrix.map((row) => row.countyFips)).size, 254);
  assert.equal(audit.inputs.crossings.packages, 254);
  assert.equal(audit.inputs.crossings.identities, 16099);
  assert.deepEqual(countyMatrix.reduce((m,r)=>(m[r.crossings]=(m[r.crossings]||0)+1,m),{}), {"CERT+":202,"CERT0":52});
});
test("every system uses exactly one governed classification", () => {
  assert.equal(new Set(CLASSIFICATIONS).size, 10);
  systems.forEach((entry) => assert.ok(CLASSIFICATIONS.includes(entry.classification), entry.systemName));
  assert.equal(Object.values(audit.classificationCounts).reduce((a,b)=>a+b,0), systems.length);
});
test("required conservative source results are fixed", () => {
  assert.equal(system("DriveTexas").classification, "SOURCE_PRESENT_RUNTIME_INACTIVE");
  assert.equal(system("NWS weather alerts").classification, "SOURCE_PRESENT_RUNTIME_INACTIVE");
  assert.equal(system("Current weather / observations").classification, "MISSING");
  assert.equal(system("Road geometry / roadway names").classification, "LEGACY_COHORT_ONLY");
  assert.equal(system("Road geometry / roadway names").countiesRuntimeCapable, 28);
  assert.equal(system("Community reports / hazards / Supabase").classification, "STATEWIDE_PRESENT_BUT_UNCERTIFIED");
});
test("audit is observational and legacy findings distinguish runtime from history", () => {
  assert.equal(audit.auditOnly, true);
  assert.equal(audit.productionFilesModified, false);
  assert.ok(legacyFindings.some((x)=>x.productionActive && x.kind === "RUNTIME_BLOCKER"));
  assert.ok(legacyFindings.some((x)=>!x.productionActive && x.kind === "HISTORICAL_EVIDENCE"));
  const changed = execFileSync("git", ["status", "--short", "--untracked-files=all"], {encoding:"utf8"})
    .trimEnd().split("\n").filter(Boolean)
    .map((line) => line.replace(/^.. /, ""))
    .filter((file) => !file.startsWith("node_modules/") && !file.startsWith("android/.gradle/") && !file.startsWith("android/build/"));
  assert.ok(changed.every((file) => file === "package.json" || file === "package-lock.json" || file.startsWith("reports/lp204/") || file === "tools/lp204/build-statewide-functional-coverage-audit.mjs" || file === "tests/lp204-statewide-functional-coverage-audit.test.mjs"), `production file modified: ${changed.join(", ")}`);
});
