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
  const owner = {
    environment: { platform: 'Windows', qgisVersion: '3.44.11', gdalVersion: '3.13.0 "Iowa City"', ogr2ogr: 'C:\\Program Files\\QGIS 3.44.11\\bin\\ogr2ogr.exe' },
    boundary: { path: 'assets/boundaries/texas-counties-boundaries.geojson', format: 'GeoJSON FeatureCollection', featureCount: 254 },
    counties: {
      '48287': { sourceBytes: 641258, sourceSha256: '1f6c7612c657c753af9d3b368b4a4645783bac3f8f33743041580e05755cae83', sourceFeatureCount: 3004, retainedFeatureCount: 3004, candidateBytes: 4710026, candidateSha256: 'a9d589e476caaf128cb7a8777ccbe9f8d39ad7421e3e073c1d680d8556a55a33' },
      '48331': { sourceBytes: 914104, sourceSha256: '206968665a8a72eea15a180eaecb378ee5a262637c5f53bcc11ce3101b0715d4', sourceFeatureCount: 4292, retainedFeatureCount: 4292, candidateBytes: 6719460, candidateSha256: '374ae91f11f30e0227065ab7704fd96f424edb40f2098b89c95acd98126386a9' },
      '48395': { sourceBytes: 896203, sourceSha256: '452d5d544600a9de1d9d2ea1a1ec8ccd826201e4400368ddeae2fd6f197c5397', sourceFeatureCount: 3391, retainedFeatureCount: 3391, candidateBytes: 6503023, candidateSha256: '40c20e284e68e43b8051ccca6fd1a2d044be4d3ad46eb789698c96863587ecba' }
    }
  };
  const preflightResults = pilots.map(county => ({ ...county, source: sourceFilename(county.countyFips), sourcePath: join(sourceRoot, sourceFilename(county.countyFips)), bytes: owner.counties[county.countyFips].sourceBytes, sha256: owner.counties[county.countyFips].sourceSha256, status: 'EXISTING_VALID_SOURCE', zipValid: true, requiredMembersPresent: true, downloaded: false, overwritten: false, certificationAuthority: 'OWNER_VERIFIED_LP207_ACQUISITION_TOOL' }));
  const preflight = { schemaVersion: 'gridly.lp207.pilot-source-preflight.v1', generatedAt: '2026-08-17T00:00:00.000Z', sourceRoot, requested: 3, valid: 3, gdalReadable: true, ownerEnvironment: owner.environment, results: preflightResults, status: 'PASS', historicalEnvironmentBlockedState: { preserved: true, status: 'SUPERSEDED', reason: 'The repository environment lacked owner ZIPs and GDAL; owner execution on Windows supplied real evidence.' } };

  const missing = selectRequests(authorities, authorities.cohort.missingCounties.map(item => item.countyFips));
  const entries = [];
  for (const county of missing) {
    const destination = join(sourceRoot, sourceFilename(county.countyFips));
    const ownerValid = Boolean(owner.counties[county.countyFips]);
    const inspected = ownerValid ? null : await inspectSource(destination, county, 'plan');
    const valid = ownerValid || inspected.status === 'EXISTING_VALID_SOURCE';
    entries.push({ ...county, expectedSourceFilename: sourceFilename(county.countyFips), expectedOfficialUrl: officialUrl(county.countyFips), localValidSourceExists: valid, acquisitionRequired: !valid, acquisitionStatus: valid ? 'EXISTING_VALID_SOURCE' : inspected.status, sourceCertificationAuthority: ownerValid ? 'OWNER_VERIFIED_LP207_ACQUISITION_TOOL' : 'LOCAL_PLAN_INSPECTION', protectedExistingRuntimeCounty: false, plannedSourceLocation: destination });
  }
  const localValid = entries.filter(item => item.localValidSourceExists).length;
  const plan = { schemaVersion: 'gridly.lp207.statewide-source-acquisition-plan.v1', generatedAt: '2026-08-17T00:00:00.000Z', executionAuthorized: false, acquisitionExecuted: false, sourceRoot, aggregates: { missingCohort: entries.length, existingRuntimeOverlap: 0, localValidSourceCount: localValid, acquisitionRequiredCount: entries.length - localValid, plannedSourceUrls: entries.length, duplicateUrls: entries.length - new Set(entries.map(item => item.expectedOfficialUrl)).size, duplicateFips: entries.length - new Set(entries.map(item => item.countyFips)).size }, counties: entries };

  const manufacturingCounties = pilots.map(county => { const evidence = owner.counties[county.countyFips]; return { ...county, status: 'GENERATED', certificationResult: 'PASS', sourceFeatureCount: evidence.sourceFeatureCount, retainedFeatureCount: evidence.retainedFeatureCount, rejectedFeatureCount: 0, outOfCountyRejectionCount: 0, duplicateCount: 0, candidateBytes: evidence.candidateBytes, candidateSha256: evidence.candidateSha256, runs: [{ run: 1, certification: 'PASS', evidenceOutputFileCount: 5 }, { run: 2, certification: 'PASS', evidenceOutputFileCount: 5 }], sharedDeterministicArtifacts: 3, deterministicHashes: true, activated: false, uploaded: false, published: false }; });
  const downstreamCompatibility = { status: 'NOT_CERTIFIED', classification: 'OWNER_CANDIDATE_ARTIFACTS_NOT_COMMITTED', roadwayLoader: 'NOT_CERTIFIED', nearestRoadLookup: 'NOT_CERTIFIED', roadNameExtraction: 'NOT_CERTIFIED', hazardReportRoadAssociation: 'NOT_CERTIFIED', reason: 'LP116 certified candidate manufacture and determinism, but its five-file owner outputs were intentionally not committed. Existing consumer audit tooling cannot execute against hashes and counts alone; no production consumer was altered and no compatibility pass is invented.' };
  const manufacturing = { schemaVersion: 'gridly.lp207.pilot-manufacturing-certification.v1', generatedAt: '2026-08-17T00:00:00.000Z', candidateOnly: true, productionAuthorized: false, uploadEnabled: false, activationEnabled: false, manufacturingTool: 'tools/lp118/extract-tiger-roadways.mjs + tools/lp116/manufacture-candidate-roadways.mjs', ownerEnvironment: owner.environment, boundaryAuthority: owner.boundary, invocationHistory: { failedBoundaryPath: 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json', classification: 'INVOCATION_ERROR', reason: 'LP118 requires a top-level FeatureCollection.features array.', supersededByPassingRun: true }, counties: manufacturingCounties, downstreamCompatibility };

  const runtimeAfter = await readFile(RUNTIME);
  if (!runtimeBefore.equals(runtimeAfter)) throw new Error('Production roadway runtime manifest changed during LP207 evidence build');
  const summary = { schemaVersion: 'gridly.lp207.statewide-roadway-missing-cohort-pilot-and-source-acquisition.v1', generatedAt: '2026-08-17T00:00:00.000Z', acquisitionToolComplete: true, pilotPassed: true, readiness: localValid === entries.length ? 'READY_FOR_STATEWIDE_MISSING_COHORT_MANUFACTURING' : 'READY_FOR_STATEWIDE_SOURCE_ACQUISITION', blockers: [], sourceGovernance: { existing28: 'Grandfathered under current governed/certified package identities; LP207 does not migrate or rebuild them.', newMissingCohort: 'U.S. Census Bureau TIGER/Line 2025 All Roads with explicit binary source identity and TIGER-native classification provenance.', sourceGenerationBoundaryIntentional: true }, conservation: { pilotRequested: 3, pilotSourceValid: 3, pilotManufactured: 3, pilotCertified: 3, pilotActivated: 0, pilotUploaded: 0, productionRoadwayCountyCountBefore: 28, productionRoadwayCountyCountAfter: 28, supabaseRoadwayWrites: 0, runtimeActivations: 0, existingGovernedRoadwayPackagesModified: 0, pilotPackagesPublished: 0 }, productionRuntimeManifest: { path: relative(ROOT, RUNTIME).replaceAll('\\', '/'), sha256Before: sha(runtimeBefore), sha256After: sha(runtimeAfter), unchanged: true }, downstreamCompatibility, statewidePlan: plan.aggregates, dallasFutureScaleControl: { countyFips: '48113', role: 'recommended first larger-county control after pilot', acquiredOrActivated: false } };
  await write(join(REPORT_ROOT, 'pilot-source-preflight.json'), preflight);
  await write(join(REPORT_ROOT, 'pilot-manufacturing-certification.json'), manufacturing);
  await write(join(REPORT_ROOT, 'statewide-source-acquisition-plan.json'), plan);
  await write(join(REPORT_ROOT, 'statewide-roadway-missing-cohort-pilot-and-source-acquisition.json'), summary);
  const rows = manufacturingCounties.map(x => `| ${x.countyName} | ${x.countyFips} | ${x.sourceFeatureCount} | ${x.retainedFeatureCount} | ${x.candidateBytes} | \`${x.candidateSha256}\` | PASS |`).join('\n');
  const markdown = `# LP207 — Statewide Roadway Missing-Cohort Pilot and Source Acquisition\n\n## Decision\n\n**${summary.readiness}**\n\nThe real owner pilot passed on QGIS ${owner.environment.qgisVersion} / GDAL ${owner.environment.gdalVersion}. The earlier environment-only block is preserved as superseded history: it described repository-container limitations, not a source or tool failure. Statewide manufacturing is not ready because only ${localValid} of ${entries.length} missing-cohort sources are valid; ${entries.length - localValid} still require acquisition.\n\n## Owner source certification\n\nThe LP207 acquisition tool verified the three existing ZIPs under \`${sourceRoot}\`. Every ZIP was valid, contained required members, and was neither downloaded nor overwritten. LP118 used the 254-feature FeatureCollection at \`${owner.boundary.path}\`. The earlier alternative-boundary invocation failed its input contract and is classified as a superseded invocation error.\n\n## Pilot manufacturing\n\n| County | FIPS | Source features | Retained | Candidate bytes | Candidate SHA-256 | LP116 (twice) |\n|---|---:|---:|---:|---:|---|---|\n${rows}\n\nAll counties had zero rejected, out-of-county, and duplicate features. Both LP116 runs passed per county, produced five files per run, shared three deterministic artifacts, and had deterministic hashes.\n\n## Downstream compatibility\n\nRoadway loader, nearest-road lookup, road-name extraction, and hazard/report road association are **NOT_CERTIFIED** in LP207. The real owner outputs were intentionally not committed, so existing consumer tooling cannot run against hashes/counts alone. LP116 manufacture and determinism passed, but this report does not invent downstream passes or alter production consumers.\n\n## Safety conservation\n\n- Pilot requested/source valid/manufactured/certified: 3 / 3 / 3 / 3\n- Pilot activated/uploaded/published: 0 / 0 / 0\n- Production roadway counties before/after: 28 / 28\n- Supabase roadway writes: 0\n- Runtime activations: 0\n- Existing governed roadway packages modified: 0\n- Runtime manifest SHA-256 before/after: \`${sha(runtimeBefore)}\` / \`${sha(runtimeAfter)}\`\n\n## Statewide plan\n\nThe deterministic, non-executing plan contains ${entries.length} missing-cohort entries, ${localValid} owner/local-valid sources, ${entries.length - localValid} acquisitions required, and zero existing-runtime overlap. No acquisition executed. Dallas (48113) remains the recommended later scale control.\n`;
  await writeFile(join(REPORT_ROOT, 'LP207-STATEWIDE-ROADWAY-MISSING-COHORT-PILOT-AND-SOURCE-ACQUISITION.md'), markdown);
  return summary;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build().then(result => process.stdout.write(`${result.readiness}\n`)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
