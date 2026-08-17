#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "reports/lp205");
const WRITE = process.argv.includes("--write");
const VERIFY = process.argv.includes("--verify");
const read = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, name), "utf8"));
const source = (name) => fs.readFileSync(path.join(ROOT, name), "utf8");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const assertSource = (condition, message) => { if (!condition) throw new Error(`LP205 source contract changed: ${message}`); };

export const HEALTH = Object.freeze(["HEALTHY", "LOADING", "INACTIVE", "NOT_CONFIGURED", "MISSING_CAPABILITY", "FAILED", "STALE", "UNKNOWN", "INTENTIONAL_ZERO", "UNVERIFIED"]);
export const TRUTH = Object.freeze(["SUPPORTED", "SUPPORTED_WITH_SCOPE", "AMBIGUOUS", "OVERSTATED", "FALSE_UNDER_KNOWN_SOURCE_GAP", "UNRESOLVED"]);
export const ROOT_CAUSES = Object.freeze(["NO_SHARED_SOURCE_HEALTH_MODEL", "SOURCE_FAILURE_COLLAPSES_TO_EMPTY", "INACTIVE_SOURCE_COLLAPSES_TO_EMPTY", "MISSING_CAPABILITY_NOT_VISIBLE", "STALE_DATA_NOT_DISTINGUISHED", "STARTUP_UNKNOWN_PRESENTED_AS_QUIET", "QUIET_COPY_SCOPE_OVERSTATEMENT", "TRAVEL_COPY_SCOPE_OVERSTATEMENT", "REPORT_FAILURE_COLLAPSES_TO_ZERO", "OTHER"]);

const app = source("js/app.js");
const drive = source("js/gridlyDriveTexasProvider.js");
const weather = source("js/gridlyWeatherProvider.js");
const lp204 = read("reports/lp204/statewide-functional-coverage-and-source-linkage-audit.json");
const lp204Counties = read("reports/lp204/county-matrix.json");
const crossingManifest = read("Crossing-Packages/production-crossing-manifest.json");
const roads = read("data/roadway-runtime-manifest.json").counties;
const places = read("data/generated/gridly-statewide-consumer-community-projection-v1.json");

assertSource(lp204.countyMatrixSummary.evaluated === 254, "LP204 county authority is not 254");
assertSource(/enabled:\s*configured\.enabled === true/.test(drive) && /if \(state\.enabled !== true\)/.test(drive), "DriveTexas is no longer disabled by default");
assertSource(/normalizedStore = \[\];[\s\S]{0,180}state\.recordCount = 0;[\s\S]{0,180}state\.lastError/.test(drive), "DriveTexas failure no longer empties records");
assertSource(/enabled:\s*configured\.enabled === true/.test(weather) && /if \(state\.enabled !== true\)/.test(weather), "weather is no longer disabled by default");
assertSource(/normalizedStore = \[\];[\s\S]{0,180}state\.recordCount = 0;[\s\S]{0,180}state\.lastError/.test(weather), "weather failure no longer empties records");
assertSource(/if \(!supabaseClient\)[\s\S]{0,260}return null;/.test(app), "report unavailable path changed");
assertSource(/catch \(error\)[\s\S]{0,900}Live sync read failed/.test(app), "report failure handling changed");
assertSource(app.includes('return { headline: "Community is quiet.", subline: "Travel normally today.", state: "quiet" };'), "major quiet copy changed");
assertSource(app.includes('semanticCoverageState = "LOADING"') && app.includes('semanticCoverageState = "TEMPORARILY_UNAVAILABLE"'), "crossing health control changed");

const crossingByCounty = new Map(crossingManifest.records.map((row) => [row.county, row]));
const roadIds = new Set(Object.keys(roads));
const counties = lp204Counties.map((county) => {
  const governed = crossingByCounty.get(county.countyName);
  const crossingState = Number(governed?.crossingCount || 0) > 0 ? "ACTIVE_POSITIVE" : "ACTIVE_EMPTY";
  return {
    countyFips: county.countyFips, countyId: county.countyId, countyName: county.countyName,
    cohorts: { roadwayPackage: roadIds.has(county.countyId), noRoadwayPackage: !roadIds.has(county.countyId), crossingState, legacySourceMetadata: /^(liberty|harris|bexar)-tx$/.test(county.countyId) },
    sourceHealth: { crossings: crossingState, reports: "UNVERIFIED", driveTexas: "INACTIVE", nwsAlerts: "INACTIVE", currentWeather: "MISSING_CAPABILITY", forecastWeather: "MISSING_CAPABILITY", roadGeometry: roadIds.has(county.countyId) ? "HEALTHY" : "MISSING_CAPABILITY" },
    quietPresentationCanDistinguishAllSources: false
  };
});

const sources = [
  { id:"reports", runtimeStatus:"STATEWIDE_CAPABLE_UNVERIFIED", enabled:"Supabase client dependent", configured:"client may be unavailable", fetchAttempt:"observable in a private network audit/startup diagnostics", success:"lastSuccessAt exists", failure:"caught and only sync text changes; active arrays are retained", lastSuccessfulFetch:"network audit lastSuccessAt", freshness:"no quiet-copy stale threshold", cacheFallback:"accepted local reports may be restored after successful reads; unavailable/failure does not authoritatively clear collections", intentionalZero:"successful, county-filtered empty result only", unavailable:"returns null when client is absent", unknown:"initial arrays exist before async read", quietStateVisibility:"No: presentation receives arrays/counts, not report read health", zeroSemantics:"A rendered zero is not proof that Supabase was queried successfully", failureSemantics:"Failure can leave startup [] or retained/local data indistinguishable to quiet presentation", healthStates:["HEALTHY","LOADING","FAILED","UNKNOWN","UNVERIFIED"] },
  { id:"crossings", runtimeStatus:"GOVERNED_254_COUNTIES", enabled:true, configured:"254 packages", fetchAttempt:"hydration attempted/completed fields", success:"owner-matched completed hydration", failure:"explicit failure reason and TEMPORARILY_UNAVAILABLE", lastSuccessfulFetch:"hydration trace, not a reusable wall-clock freshness policy", freshness:"no age threshold", cacheFallback:"remote retry/local package fallback", intentionalZero:"52 ACTIVE_EMPTY counties after hydration; zero-local distinct in 202 ACTIVE_POSITIVE counties", unavailable:"explicit coverage state", unknown:"LOADING until hydrated", quietStateVisibility:"Partial: Community Pulse coverage guard consumes crossing availability only", zeroSemantics:"governed evidence of no crossings, never all-transportation quiet", failureSemantics:"does not collapse to crossing quiet", healthStates:["HEALTHY","LOADING","FAILED","INTENTIONAL_ZERO"] },
  { id:"drivetexas", runtimeStatus:"INACTIVE_BY_DEFAULT", enabled:false, configured:"requires enabled=true and API key", fetchAttempt:"none while disabled", success:"connected/lastRefresh/recordCount provider fields", failure:"clears normalizedStore and recordCount while runtimeHealthy remains true; lastError holds failure", lastSuccessfulFetch:"lastRefresh", freshness:"no consumer stale threshold", cacheFallback:"provider clears; separate publisher/connector can retain last-successful records without quiet-state age disclosure", intentionalZero:"not distinguishable in record-array consumers", unavailable:"disabled returns an empty normalized array", unknown:"consumer cannot see provider lifecycle", quietStateVisibility:"No", zeroSemantics:"inactive and healthy-zero both appear []", failureSemantics:"failure becomes []", healthStates:["INACTIVE","NOT_CONFIGURED","HEALTHY","FAILED","UNKNOWN"] },
  { id:"nws_alerts", runtimeStatus:"INACTIVE_BY_DEFAULT", enabled:false, configured:"endpoint defaults to statewide NWS alerts; no credential", fetchAttempt:"none while disabled", success:"connected/lastRefresh/recordCount provider fields", failure:"clears normalizedStore and recordCount while runtimeHealthy remains true; lastError holds failure", lastSuccessfulFetch:"lastRefresh", freshness:"alert records carry times but quiet consumers receive no source-age gate", cacheFallback:"provider clears; connector retention is not surfaced to quiet copy", intentionalZero:"not distinguishable in record-array consumers", unavailable:"disabled returns an empty normalized array", unknown:"consumer cannot see provider lifecycle", quietStateVisibility:"No", zeroSemantics:"inactive and healthy-zero both appear []", failureSemantics:"failure becomes []", healthStates:["INACTIVE","HEALTHY","FAILED","UNKNOWN"] },
  { id:"weather_products", runtimeStatus:"NOT_IMPLEMENTED", enabled:false, configured:false, fetchAttempt:"none", success:"none", failure:"capability absence", lastSuccessfulFetch:null, freshness:"none", cacheFallback:"none", intentionalZero:"not applicable", unavailable:"current conditions, observations, forecast, temperature, precipitation, wind and visibility are missing", unknown:"presentation often receives null weather", quietStateVisibility:"No", zeroSemantics:"null/no impact is rendered as no travel-impacting weather", failureSemantics:"missing capability is hidden", healthStates:["MISSING_CAPABILITY"] },
  { id:"road_geometry", runtimeStatus:`${roadIds.size}_COUNTY_COHORT`, enabled:true, configured:`${roadIds.size}/254 packages`, fetchAttempt:"county package activation", success:"loaded county and package state", failure:"blocked_missing_asset or explicit load error", lastSuccessfulFetch:"no shared quiet freshness timestamp", freshness:"package identity, not live-condition freshness", cacheFallback:"county package cache", intentionalZero:"not an incident-zero source", unavailable:`${254-roadIds.size} counties missing`, unknown:"county transitions expose package state separately", quietStateVisibility:"No broad quiet gate", zeroSemantics:"absence of geometry says nothing about road conditions", failureSemantics:"not incorporated into calm claim", healthStates:["HEALTHY","LOADING","FAILED","MISSING_CAPABILITY"] }
];

const quietCopy = [
  { statement:"Community is quiet.", owner:"getGridlyHomeCommunityPulseCopy / top Awareness Card and Community Pulse", evidence:"zero selected community count plus crossing coverage not failed", missingEvidence:"report query success/freshness; DriveTexas; NWS; weather products", classification:"AMBIGUOUS", scope:"Community wording is plausibly community-only, but the zero can be startup/unverified and adjacent travel copy broadens it." },
  { statement:"Travel normally today.", owner:"getGridlyHomeCommunityPulseCopy / top Awareness Card", evidence:"zero community activity and crossing coverage not failed", missingEvidence:"inactive DriveTexas/NWS, missing current weather/forecast, report health", classification:"FALSE_UNDER_KNOWN_SOURCE_GAP", scope:"Unqualified travel-normal advice claims more than loaded evidence." },
  { statement:"No active community reports need attention.", owner:"gridlyStoryCommunityEvidence / Awareness Brief", evidence:"community record array length zero", missingEvidence:"whether Supabase read succeeded and is fresh", classification:"AMBIGUOUS", scope:"Explicitly community-scoped, but its data-availability precondition is not carried." },
  { statement:"No official roadway advisories nearby.", owner:"gridlyTravelBriefDriveTexasLines / Travel Brief", evidence:"DriveTexas record array has no impactful records", missingEvidence:"provider enabled/connected/fetched successfully", classification:"FALSE_UNDER_KNOWN_SOURCE_GAP", scope:"Rendered even when DriveTexas is inactive and has never run." },
  { statement:"No travel-impacting weather.", owner:"gridlyTravelBriefWeatherLines / Travel Brief", evidence:"no meaningful impact in nullable weather model", missingEvidence:"inactive NWS alerts and all missing current/forecast products", classification:"FALSE_UNDER_KNOWN_SOURCE_GAP", scope:"Capability absence is treated like observed non-impact." },
  { statement:"Travel normally and stay aware.", owner:"Awareness Story, Community Pulse decision, Travel Brief", evidence:"no active records/recognized official or weather impacts", missingEvidence:"health, success and freshness of those inputs", classification:"OVERSTATED", scope:"Broad travel guidance from partial/unknown sources." },
  { statement:"Your area is clear right now", owner:"Awareness Brief interaction fallback", evidence:"fallback only when DOM text is unavailable", missingEvidence:"all source evidence", classification:"FALSE_UNDER_KNOWN_SOURCE_GAP", scope:"A comprehensive clear claim can be synthesized without source initialization." },
  { statement:"No active local issues reported", owner:"related local-awareness/microline semantics", evidence:"available produced records", missingEvidence:"inactive/failed/missing producer status", classification:"SUPPORTED_WITH_SCOPE", scope:"Defensible only when 'reported' is read literally; not an all-clear." },
  { statement:"zero alert cards", owner:"unified incident / alert rendering", evidence:"no eligible incidents produced", missingEvidence:"provider health and missing capabilities", classification:"AMBIGUOUS", scope:"Absence of cards means no produced alerts, not all sources healthy-zero." }
];

const scenarios = [
  {id:1, result:"Community quiet is conditionally community-scoped; Travel normally today is not justified because official/weather health is absent."},
  {id:2, result:"Yes. At startup an empty collection can remain; report failure updates sync text but quiet presentation has no health input."},
  {id:3, result:"Crossing LOADING is modeled and guards the home pulse only where that coverage object is used; aggregate story/travel source health remains partial."},
  {id:4, result:"ACTIVE_EMPTY is a truthful governed crossing zero, but it can still coexist with an unjustified broad travel-normal state."},
  {id:5, result:"Source-scoped no-report/no-advisory/no-alert statements are justified; broad normal travel still needs current/forecast weather scope or qualification."},
  {id:6, result:"Provider failure clears records; connector/publisher last-success retention can remain, and no common stale age reaches quiet decisions."},
  {id:7, result:"Provider failure clears records and can look like zero alerts; retained connector state has no common quiet freshness gate."},
  {id:8, result:"The static shell says Loading, and Community Pulse installs a placeholder; however arrays are initialized empty and other builders/fallbacks can derive calm before the non-blocking report read completes."}
];

const cohortCounts = {
  roadwayPackages: counties.filter(c=>c.cohorts.roadwayPackage).length,
  withoutRoadwayPackages: counties.filter(c=>c.cohorts.noRoadwayPackage).length,
  activePositiveCrossings: counties.filter(c=>c.cohorts.crossingState === "ACTIVE_POSITIVE").length,
  activeEmptyCrossings: counties.filter(c=>c.cohorts.crossingState === "ACTIVE_EMPTY").length,
  legacySourceMetadata: counties.filter(c=>c.cohorts.legacySourceMetadata).length,
  withoutLegacySourceMetadata: counties.filter(c=>!c.cohorts.legacySourceMetadata).length,
  multiCountyPlaceMemberships: places.counts.membershipCount - places.counts.uniquePlaceCount,
  placeContexts:"Both multi-county and ordinary PLACE contexts use the same source-array quiet decisions; canonical county switching protects crossings/reports but does not create official-provider health."
};

const findings = [
  {priority:"P0", rootCauses:["INACTIVE_SOURCE_COLLAPSES_TO_EMPTY","MISSING_CAPABILITY_NOT_VISIBLE","TRAVEL_COPY_SCOPE_OVERSTATEMENT"], finding:"Travel-normal, no-official-advisory, and no-weather-impact copy can render while DriveTexas/NWS are inactive and live weather products do not exist."},
  {priority:"P1", rootCauses:["NO_SHARED_SOURCE_HEALTH_MODEL","REPORT_FAILURE_COLLAPSES_TO_ZERO","STARTUP_UNKNOWN_PRESENTED_AS_QUIET"], finding:"Presentation cannot prove a successful fresh report read and cannot combine source lifecycle truth across all 254 counties."},
  {priority:"P2", rootCauses:["SOURCE_FAILURE_COLLAPSES_TO_EMPTY","STALE_DATA_NOT_DISTINGUISHED"], finding:"Official provider failures clear arrays; provider/connector cache freshness is not a quiet-state input."},
  {priority:"P3", rootCauses:["QUIET_COPY_SCOPE_OVERSTATEMENT"], finding:"Community-scoped wording is semantically narrower, but data availability is not stated and adjacent copy expands its meaning."},
  {priority:"P4", rootCauses:["MISSING_CAPABILITY_NOT_VISIBLE"], finding:"Current conditions and forecast products remain intentionally unimplemented for this audit and must not be inferred quiet."}
];

const audit = {
  schemaVersion:"gridly.lp205.source-health-quiet-truthfulness.v1", generatedAt:"2026-08-17T00:00:00.000Z", auditOnly:true, productionFilesModified:false,
  vocabulary:{health:HEALTH, truthfulness:TRUTH, rootCauses:ROOT_CAUSES, priorities:["P0","P1","P2","P3","P4"]},
  evidence:{sourceFingerprints:{app:hash(app),driveTexasProvider:hash(drive),weatherProvider:hash(weather)}, inputs:["reports/lp204/statewide-functional-coverage-and-source-linkage-audit.json","Crossing-Packages/production-crossing-manifest.json","data/roadway-runtime-manifest.json","data/generated/gridly-statewide-consumer-community-projection-v1.json"]},
  statewide:{evaluatedCounties:counties.length, cohortCounts, countySwitchSequence:["liberty-tx","sherman-tx","dallas-tx","andrews-tx","tyler-tx"], switchFinding:"Crossing requests use county/generation commit guards and reports refilter by active county. Provider health is global/hidden; inactive stays empty rather than explicitly inactive in consumers. Calm copy recalculates from county arrays without a complete health reset contract."},
  sharedHealthModel:{exists:false, finding:"Provider-specific fields and crossing coverage exist, but no reusable all-source health/freshness object is consumed by quiet presentation."}, sources, quietCopy, scenarios, findings,
  recommendation:"LP205.1 should make the smallest safety repair first: gate broad travel/all-clear/no-official/no-weather conclusions on an explicit presentation-facing completeness result, while preserving narrowly scoped community zero copy only after report-read state is known. Reuse crossing coverage and provider runtime facts behind that boundary; centralize the durable shared health model immediately afterward. Do not activate providers as part of the copy-scope repair.",
  conclusion:{communityQuiet:"AMBIGUOUS: potentially truthful as community-only after a successful scoped read, but current presentation does not know that precondition.",travelNormally:"FALSE_UNDER_KNOWN_SOURCE_GAP",failureOrInactivityCanLookQuiet:true,p0:"Broad normal/all-clear and source-specific zero statements are produced from empty arrays/null inputs while DriveTexas and NWS are inactive and weather capabilities are missing."}
};

const sourceMatrix = {schemaVersion:"gridly.lp205.source-health-matrix.v1", generatedAt:audit.generatedAt, sources, cohortCounts, counties};
const table = (rows) => rows.map(r=>`| ${r.id} | ${r.runtimeStatus} | ${r.healthStates.join(", ")} | ${r.freshness} | ${r.zeroSemantics} | ${r.failureSemantics} | ${r.quietStateVisibility} |`).join("\n");
const copyTable = quietCopy.map(r=>`| ${r.statement} | ${r.owner} | ${r.evidence} | ${r.missingEvidence} | **${r.classification}** |`).join("\n");
const markdown = `# LP205 — Statewide Source Health and Quiet-State Truthfulness Audit

> **Audit only.** This milestone changes no production copy, provider behavior, source activation, or crossing behavior. It diagnoses absence of evidence being presented as evidence of absence.

## 1. Executive Summary

- **“Community is quiet.” is ambiguous, not comprehensively proven.** It can be truthful when read strictly as a community-only statement after a successful, fresh, correctly scoped report read. The rendering decision receives a zero count, not proof of that lifecycle.
- **“Travel normally today.” is not currently truthful under known gaps.** It is **FALSE_UNDER_KNOWN_SOURCE_GAP** because DriveTexas and NWS alerts default inactive, current/forecast weather capabilities are missing, and report health is not an input.
- **Yes, source inactivity and failure can look quiet.** DriveTexas/NWS disabled, successful-zero, and failed states all expose empty record arrays to consumers. Report unavailability/failure can leave startup empty or retained/local collections without conveying health.
- **P0:** broad travel-normal, clear, no-official-advisory, and no-weather-impact statements can render without the upstream awareness needed to support them.

## 2. Source Health Matrix

| Source | Runtime | Observable health | Freshness | Zero semantics | Failure semantics | Visible to quiet decision |
|---|---|---|---|---|---|---|
${table(sources)}

There is **no shared source-health model**. Crossings provide the strongest provider-specific control; official providers expose runtime fields, reports keep a private network audit, and road loading has separate state. Quiet builders primarily receive arrays/counts/nulls.

## 3. Quiet Copy Matrix

| Statement/state | Owner | Actual evidence | Missing evidence | Classification |
|---|---|---|---|---|
${copyTable}

## 4. Community Reports

The initial active report arrays are empty. The asynchronous loader can prove a successful query internally through diagnostics and last-success time, then normalizes and county-filters rows. If Supabase is unavailable it returns without changing those collections. A query exception is caught, updates only sync/diagnostic presentation, and retains the prior collections. Local accepted reports may be merged after a successful read. Thus zero visible reports can mean successful fresh zero, not-yet-loaded startup, unavailable client, failed read with an empty prior collection, or a locally retained view. Quiet presentation cannot distinguish them. Root cause: **REPORT_FAILURE_COLLAPSES_TO_ZERO** / **STARTUP_UNKNOWN_PRESENTED_AS_QUIET**.

## 5. Crossings

Crossings are the positive control: all 254 counties have governed state; ${cohortCounts.activePositiveCrossings} are ACTIVE_POSITIVE and ${cohortCounts.activeEmptyCrossings} ACTIVE_EMPTY. Runtime coverage distinguishes LOADING, TEMPORARILY_UNAVAILABLE, hydrated ACTIVE_EMPTY, ACTIVE_POSITIVE with no local crossings, and ACTIVE_POSITIVE with local crossings. The home Community Pulse uses unavailable crossing coverage to suppress its zero-evidence quiet branch. This protection is only crossing-specific: an ACTIVE_EMPTY county proves no governed crossings, not quiet roads/weather, and other aggregate builders do not consume a complete health model.

## 6. DriveTexas

The provider requires explicit enablement plus an API key and makes no request while disabled. Disabled refresh reports connected=false but healthy=true and returns the same empty normalized array consumed by stories and Travel Brief. On fetch failure it clears the store/count, records lastError, but also leaves runtimeHealthy=true. The Travel Brief converts that array to “No official roadway advisories nearby.” Neither it nor Awareness/Community Pulse/Alerts receives inactive or failed status. Therefore DriveTexas can have never run and still contribute apparent quiet.

## 7. Weather

NWS alert ingestion similarly defaults disabled and provides [] while inactive; a failure clears records and is not visible to quiet surfaces. Alerts have event timestamps, but no common last-success/stale gate protects quiet copy. Separately, current conditions, observations, point/grid forecasts, temperature, precipitation, wind, and visibility are missing capabilities. A null weather model nevertheless becomes “No travel-impacting weather.” This is absence of capability, not observed normal weather.

## 8. Awareness Brief / Community Pulse / Travel Brief / Alerts

- **Awareness Story/Brief:** combines community records, empty DriveTexas records and nullable weather; its default is “Community is quiet,” and broad recommendation/confidence copy is produced without source health.
- **Community Pulse / top/mobile Awareness Card:** crossing failure/loading has a partial coverage guard, but report/official/weather health does not. Its quiet pair directly joins community language to “Travel normally today.”
- **Travel Brief:** always creates Community, Official Roadways and Weather sections. Empty/null dependencies become affirmative no-advisory/no-impact copy. This is the clearest false-under-known-gap path.
- **Alerts:** zero cards means no eligible records produced by active inputs, not all alert sources healthy with zero events. Unavailable providers are invisible.

## 9. Startup / Switching / Freshness

The HTML shell and Community Pulse first paint use loading placeholders, which is good. Crossing hydration is blocking before the first composed desktop render; report hydration is explicitly non-blocking and is not awaited. Other builders have empty-array/default fallbacks, so startup unknown can become calm outside the guarded placeholder path. On Liberty → Sherman → Dallas → Andrews → Tyler, crossing generation/owner guards reject stale commits and reports refilter on county changes. Official provider lifecycle remains global and hidden, so no county switch creates proof of health. No shared stale threshold or last-success age is used by quiet decisions; retained/local/connector data can appear current.

## 10. Statewide Impact

The generated matrix evaluates **${counties.length} counties**. Cohorts: **${cohortCounts.roadwayPackages}** with roadway packages / **${cohortCounts.withoutRoadwayPackages}** without; **${cohortCounts.activePositiveCrossings}** ACTIVE_POSITIVE / **${cohortCounts.activeEmptyCrossings}** ACTIVE_EMPTY crossing counties; **${cohortCounts.legacySourceMetadata}** legacy seeded metadata counties / **${cohortCounts.withoutLegacySourceMetadata}** without. The PLACE projection includes ${places.counts.uniquePlaceCount} unique places and ${places.counts.membershipCount} county memberships; multi-county and ordinary contexts share the same missing official-source-health problem. Every county has DriveTexas INACTIVE, NWS INACTIVE, reports UNVERIFIED, and current/forecast weather MISSING_CAPABILITY in this repository audit. Road and crossing cohorts change local detail, not the truthfulness of broad calm copy.

## 11. Root Causes

${[...new Set(findings.flatMap(f=>f.rootCauses))].map(x=>`- **${x}**`).join("\n")}

## 12. Priority Findings

${findings.map(f=>`- **${f.priority}:** ${f.finding} (${f.rootCauses.join(", ")})`).join("\n")}

## 13. Recommended LP205.1 Repair Boundary

${audit.recommendation} This audit does **not** implement that repair.

## 14. Files Changed

Only the LP205 audit builder, generated LP205 report/matrix, and LP205 test are changed. Production application/provider files are fingerprinted inputs and remain untouched.

## 15. Tests

Run the LP205 builder in verify mode, its Node test, and LP204 verification as regression. Exact results belong in the change/PR execution record rather than this deterministic generated artifact.

## 16. Merge Recommendation

**Safe to merge as audit evidence.** It is deterministic, audit-only, and does not authorize activation or claim quiet-state truthfulness is fixed. Production release remains blocked on the P0 repair.
`;

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const outputs = {
  "statewide-source-health-and-quiet-state-truthfulness-audit.json": json(audit),
  "source-health-matrix.json": json(sourceMatrix),
  "LP205-STATEWIDE-SOURCE-HEALTH-AND-QUIET-STATE-TRUTHFULNESS-AUDIT.md": markdown
};
if (WRITE) { fs.mkdirSync(OUT, {recursive:true}); for (const [name,value] of Object.entries(outputs)) fs.writeFileSync(path.join(OUT,name),value); }
if (VERIFY) for (const [name,value] of Object.entries(outputs)) { const target=path.join(OUT,name); if (!fs.existsSync(target) || fs.readFileSync(target,"utf8") !== value) throw new Error(`Stale LP205 artifact: ${name}`); }
if (!WRITE && !VERIFY && process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.stdout.write(json(audit));
export { audit, sourceMatrix, sources, quietCopy, counties, outputs };
