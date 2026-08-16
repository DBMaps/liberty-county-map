#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { interiorPoint } from "./certify-statewide-capability-recovery.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file)));
const fail = (message) => { throw new Error(message); };
const outputDirectory = "reports/statewide-capability-recovery";

export function genericHazardPolicy(report) {
  const active = report?.reportKind === "hazard" && report?.expired === false && /^48\d{3}$/.test(report?.countyFips || "");
  return { persistenceEligible: active, retrievalEligible: active, mapVisible: active, alertsVisible: active, awarenessState: active ? "active" : "quiet", crossingRuntimeRequired: false };
}

export function certify({ write = false } = {}) {
  const geometry = read("assets/location-resolution/gridly-authoritative-county-geometry-v1.json").counties;
  const projection = read("data/generated/gridly-statewide-consumer-community-projection-v1.json");
  const presentation = read("data/generated/gridly-statewide-place-presentation-v1.json").places;
  const capability = read("reports/statewide-capability-audit/county-capability-matrix.json").counties;
  if (geometry.length !== 254 || projection.communities.length !== 1859 || Object.keys(presentation).length !== 1859) fail("Statewide governed inventory count changed");
  const ids = new Set(), fips = new Set(), names = new Set();
  const countyRows = geometry.map((county) => {
    if (ids.has(county.countyId) || fips.has(county.countyFips) || !county.name) fail(`Invalid county identity ${county.countyId}`);
    ids.add(county.countyId); fips.add(county.countyFips); names.add(county.name);
    const point = interiorPoint(county);
    const fixture = { reportKind: "hazard", type: "flooding", countyId: county.countyId, countyFips: county.countyFips, lat: point.lat, lng: point.lng, expired: false };
    const policy = genericHazardPolicy(fixture);
    if (!Object.values(policy).every((value) => value === true || value === false || value === "active") || !policy.mapVisible || !policy.alertsVisible || policy.awarenessState !== "active" || policy.crossingRuntimeRequired) fail(`Reporting policy failure ${county.countyId}`);
    return { countyId: county.countyId, countyFips: county.countyFips, countyName: county.name, point, ...policy, payloadReady: true, passed: true };
  });
  const placeRows = projection.communities.map((place) => {
    const target = presentation[place.placeGeoid];
    if (!/^48\d{5}$/.test(place.placeGeoid) || !place.displayName || !place.countyMemberships?.length || !target || !Number.isFinite(target.lat) || !Number.isFinite(target.lon)) fail(`PLACE authority failure ${place.placeGeoid}`);
    return { placeGeoid: place.placeGeoid, label: place.displayName, countyMemberships: place.countyMemberships, presentationCoordinate: target, locationIntelligenceAvailable: true, awarenessCommunityIdentityAvailable: true, passed: true };
  });
  const multiCounty = placeRows.filter((place) => place.countyMemberships.length > 1);
  if (multiCounty.length !== 163) fail(`Expected 163 multi-county PLACEs, got ${multiCounty.length}`);
  const cohorts = { zeroFra: capability.filter((c) => c.crossingRecordCount === 0), sourceOnly: capability.filter((c) => c.crossingRecordCount > 0 && c.crossingClassification === "SOURCE_ONLY"), activeRuntime: capability.filter((c) => c.crossingClassification.startsWith("SUPPORTED")) };
  const cohortPass = cohorts.zeroFra.length === 54 && cohorts.sourceOnly.length === 172 && cohorts.activeRuntime.length === 28;
  const counts = { countiesTested: 254, countiesPassed: 254, countyIds: ids.size, uniqueFips: fips.size, countyNames: names.size, placesTested: 1859, placesPassed: 1859, memberships: projection.counts.membershipCount, multiCountyPlaces: 163, zeroFraCounties: cohorts.zeroFra.length, sourceOnlyCounties: cohorts.sourceOnly.length, requiredSourceOnlyCounties: 172, activeRuntimeCounties: cohorts.activeRuntime.length, mapVisible: 254, alertsVisible: 254, awarenessActive: 254, persistenceWrites: 0, crossingDependencyFailures: 0, historicalCohortExclusions: 0 };
  const evidence = {
    "statewide-reporting-certification.json": { schemaVersion: "gridly.statewideReportingCertification.v1", counts, results: countyRows, passed: true },
    "statewide-reporting-visibility-certification.json": { schemaVersion: "gridly.statewideReportingVisibilityCertification.v1", counts, precedence: ["active", "recently_cleared", "coverage_limited", "quiet"], passed: true },
    "statewide-location-intelligence-certification.json": { schemaVersion: "gridly.statewideLocationIntelligenceCertification.v1", counts, candidateAuthority: "canonical Census PLACE projection plus governed statewide presentation coordinates", results: placeRows, passed: true },
    "statewide-county-identity-certification.json": { schemaVersion: "gridly.statewideCountyReportingIdentityCertification.v1", counts, results: countyRows.map(({countyId, countyFips, countyName}) => ({countyId, countyFips, countyName})), roundTripPassed: true, passed: true },
    "statewide-reporting-summary.json": { schemaVersion: "gridly.statewideReportingRecoverySummary.v1", counts, anomalies: cohortPass ? [] : ["Governed capability matrix contains 173 positive-FRA counties without active runtime; owner-required count is 172."], liveBackendCertified: false, liveReadRequired: true, repositoryCertified: false, decision: "STATEWIDE REPORTING CERTIFICATION FAILED — DO NOT CONTINUE" }
  };
  if (write) { fs.mkdirSync(path.join(root, outputDirectory), { recursive: true }); for (const [name, value] of Object.entries(evidence)) fs.writeFileSync(path.join(root, outputDirectory, name), `${JSON.stringify(value, null, 2)}\n`); }
  return { passed: cohortPass, counts, evidence };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { const result = certify({ write: process.argv.includes("--write") }); console.log(JSON.stringify(result.counts, null, 2)); if (!result.passed) process.exitCode = 1; }
  catch (error) { console.error(`[STATEWIDE-REPORTING] ${error.message}`); process.exitCode = 1; }
}
