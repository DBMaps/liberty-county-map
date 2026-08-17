#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAuthorities, officialUrl, PILOT_FIPS, selectRequests, sourceFilename, inspectSource } from './acquire-tiger2025-roadway-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT_ROOT = join(ROOT, 'reports/lp207');
const DEFAULT_OWNER_SOURCE = process.env.GRIDLY_TIGER2025_ROADS_ROOT || 'C:\\GitHub\\Gridly-Source-Data\\Census\\TIGER2025\\ROADS';
const RUNTIME = join(ROOT, 'data/roadway-runtime-manifest.json');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const sha = body => createHash('sha256').update(body).digest('hex');
const exists = path => access(path).then(() => true, () => false);
async function write(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, json(value)); }

export async function build(options = {}) {
  const sourceRoot = options.sourceRoot || DEFAULT_OWNER_SOURCE;
  const authorities = await loadAuthorities(options);
  const pilots = selectRequests(authorities, PILOT_FIPS);
  const runtimeBefore = await readFile(RUNTIME);
  const preflightResults = [];
  for (const county of pilots) preflightResults.push(await inspectSource(join(sourceRoot, sourceFilename(county.countyFips)), county, 'verify'));
  const validPilotCount = preflightResults.filter(item => item.status === 'EXISTING_VALID_SOURCE').length;
  const preflight = { schemaVersion: 'gridly.lp207.pilot-source-preflight.v1', generatedAt: '2026-08-17T00:00:00.000Z', sourceRoot, requested: 3, valid: validPilotCount, gdalReadable: false, results: preflightResults, status: validPilotCount === 3 ? 'REQUIRES_GDAL_MANUFACTURING' : 'BLOCKED_MISSING_OWNER_SOURCES' };

  const missing = selectRequests(authorities, authorities.cohort.missingCounties.map(item => item.countyFips));
  const entries = [];
  for (const county of missing) {
    const destination = join(sourceRoot, sourceFilename(county.countyFips));
    const inspected = await inspectSource(destination, county, 'plan');
    const valid = inspected.status === 'EXISTING_VALID_SOURCE';
    entries.push({ ...county, expectedSourceFilename: sourceFilename(county.countyFips), expectedOfficialUrl: officialUrl(county.countyFips), localValidSourceExists: valid, acquisitionRequired: !valid, acquisitionStatus: valid ? 'EXISTING_VALID_SOURCE' : inspected.status, protectedExistingRuntimeCounty: false, plannedSourceLocation: destination });
  }
  const localValid = entries.filter(item => item.localValidSourceExists).length;
  const plan = { schemaVersion: 'gridly.lp207.statewide-source-acquisition-plan.v1', generatedAt: '2026-08-17T00:00:00.000Z', executionAuthorized: false, sourceRoot, aggregates: { missingCohort: entries.length, existingRuntimeOverlap: 0, localValidSourceCount: localValid, acquisitionRequiredCount: entries.length - localValid, plannedSourceUrls: entries.length, duplicateUrls: entries.length - new Set(entries.map(item => item.expectedOfficialUrl)).size, duplicateFips: entries.length - new Set(entries.map(item => item.countyFips)).size }, counties: entries };

  const manufacturing = { schemaVersion: 'gridly.lp207.pilot-manufacturing-certification.v1', generatedAt: '2026-08-17T00:00:00.000Z', candidateOnly: true, productionAuthorized: false, uploadEnabled: false, activationEnabled: false, manufacturingTool: 'tools/lp118/extract-tiger-roadways.mjs + tools/lp116/manufacture-candidate-roadways.mjs', partitionLimits: { targetFeatures: 35000, hardFeatures: 45000, targetBytes: 10485760, hardBytes: 20971520 }, contract: { format: 'GeoJSON FeatureCollection', geometryTypes: ['LineString', 'MultiLineString'], crs: 'EPSG:4326', coordinatePrecisionDecimals: 7, featureOrder: 'stable source identity then normalized geometry', primaryRoadName: 'FULLNAME', fallbackRoadName: null, unnamedRoadBehavior: 'preserve null/empty; never fabricate', casing: 'preserved', aliases: 'not synthesized', classificationFields: ['MTFCC', 'RTTYP'], classificationSemantics: 'TIGER-native provenance; no OSM taxonomy equivalence', ownershipPolicy: 'LP118 retains only features whose every coordinate is contained by the authoritative county polygon; unexplained drops are counted', canonicalIdentity: 'UTF-8 JSON emitted with LF; source ZIP SHA-256 hashes exact binary bytes' }, counties: pilots.map(county => ({ ...county, status: 'NOT_RUN', certificationResult: 'BLOCKED', reason: preflightResults.find(item => item.countyFips === county.countyFips)?.failureReason || 'Owner source unavailable; GDAL manufacturing not run', activated: false, uploaded: false })), downstreamCompatibility: { status: 'NOT_TESTED', roadwayLoader: 'NOT_TESTED', nearestRoadLookup: 'NOT_TESTED', roadNameExtraction: 'NOT_TESTED', hazardReportRoadAssociation: 'NOT_TESTED' } };

  const runtimeAfter = await readFile(RUNTIME);
  if (!runtimeBefore.equals(runtimeAfter)) throw new Error('Production roadway runtime manifest changed during LP207 evidence build');
  const summary = { schemaVersion: 'gridly.lp207.statewide-roadway-missing-cohort-pilot-and-source-acquisition.v1', generatedAt: '2026-08-17T00:00:00.000Z', acquisitionToolComplete: true, pilotPassed: false, readiness: 'BLOCKED_FOR_STATEWIDE_ROADWAY', blockers: ['The three required owner TIGER2025 ZIPs are not materialized in this environment, so ZIP authentication and the real pilot cannot be certified.', 'ogr2ogr/GDAL is not installed in this environment, so LP118 cannot read or transform shapefiles.'], sourceGovernance: { existing28: 'Grandfathered under current governed/certified package identities; LP207 does not migrate or rebuild them.', newMissingCohort: 'U.S. Census Bureau TIGER/Line 2025 All Roads with explicit binary source identity and TIGER-native classification provenance.', sourceGenerationBoundaryIntentional: true }, conservation: { pilotRequested: 3, pilotSourceValid: validPilotCount, pilotManufactured: 0, pilotCertified: 0, pilotActivated: 0, pilotUploaded: 0, productionRoadwayCountyCountBefore: 28, productionRoadwayCountyCountAfter: 28, supabaseRoadwayWrites: 0, runtimeActivations: 0, existingGovernedRoadwayPackagesModified: 0, pilotPackagesPublished: 0 }, productionRuntimeManifest: { path: relative(ROOT, RUNTIME).replaceAll('\\', '/'), sha256Before: sha(runtimeBefore), sha256After: sha(runtimeAfter), unchanged: true }, statewidePlan: plan.aggregates, dallasFutureScaleControl: { countyFips: '48113', role: 'recommended first larger-county control after pilot', acquiredOrActivated: false } };
  await write(join(REPORT_ROOT, 'pilot-source-preflight.json'), preflight);
  await write(join(REPORT_ROOT, 'pilot-manufacturing-certification.json'), manufacturing);
  await write(join(REPORT_ROOT, 'statewide-source-acquisition-plan.json'), plan);
  await write(join(REPORT_ROOT, 'statewide-roadway-missing-cohort-pilot-and-source-acquisition.json'), summary);
  const markdown = `# LP207 — Statewide Roadway Missing-Cohort Pilot and Source Acquisition\n\n## Decision\n\n**BLOCKED_FOR_STATEWIDE_ROADWAY**\n\nThe governed acquisition mechanism is implemented and fail-closed. The pilot is not certified: this execution environment does not contain the three owner-controlled TIGER ZIPs and does not provide GDAL. LP207 therefore does not claim pilot success or statewide readiness.\n\n## Governed source contract\n\nNew missing-cohort roadways use **U.S. Census Bureau, TIGER/Line 2025 All Roads** at \`https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_<FIPS>_roads.zip\`. Exact ZIP bytes receive a Gridly-observed SHA-256. Existing 28 roadway counties remain grandfathered without migration or rebuild. This is an intentional source-generation boundary, not a fallback or a claim that TIGER and OSM classifications are equivalent.\n\nRoad names preserve \`FULLNAME\` as supplied. Empty names remain unnamed; no names, aliases, or casing transformations are fabricated. \`MTFCC\` and \`RTTYP\` remain TIGER-native classifications.\n\n## Safety conservation\n\n- Production roadway counties before: 28\n- Production roadway counties after: 28\n- Supabase roadway writes: 0\n- Runtime activations: 0\n- Existing governed roadway packages modified: 0\n- Pilot counties activated: 0\n- Pilot packages published: 0\n\n## Pilot\n\nLee (48287), Milam (48331), and Robertson (48395) are confirmed members of the frozen LP206 cohort. Their source and manufacturing results are explicitly \`NOT_RUN/BLOCKED\`, not synthetic passes. Supply the three ZIPs through \`GRIDLY_TIGER2025_ROADS_ROOT\` and install GDAL before rerunning the pilot.\n\n## Statewide plan\n\nThe plan contains ${entries.length} deterministic, non-executed entries: ${localValid} locally valid and ${entries.length - localValid} requiring acquisition in this environment. Dallas (48113) is the recommended later scale control. No all-226 apply mode exists in LP207.\n`;
  await writeFile(join(REPORT_ROOT, 'LP207-STATEWIDE-ROADWAY-MISSING-COHORT-PILOT-AND-SOURCE-ACQUISITION.md'), markdown);
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build().then(result => process.stdout.write(`${result.readiness}\n`)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
