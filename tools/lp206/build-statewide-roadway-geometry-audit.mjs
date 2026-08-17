#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const WRITE = process.argv.includes('--write');
const VERIFY = process.argv.includes('--verify');
const GENERATED_AT = '2026-08-17T00:00:00.000Z';

const authority = read('data/lp104/texas-counties.json').counties;
const manifest = read('data/roadway-runtime-manifest.json');
const byId = new Map(authority.map(c => [`${c.countyId}-tx`, c]));
const extractedTiger = new Set(['48071', '48201', '48245', '48339', '48373', '48407']);
const tigerZips = new Set(['48287', '48331', '48395']);
// The owner supplied the reconciled count and zero unmatched slugs; the raw identities are
// historical evidence only, so they intentionally do not participate in cohort membership.

if (authority.length !== 254 || new Set(authority.map(c => c.fips)).size !== 254) throw new Error('Texas authority must contain 254 unique FIPS');
const existingRuntimeCounties = Object.entries(manifest.counties).map(([countyId, entry]) => {
  const county = byId.get(countyId);
  if (!county) throw new Error(`Unknown runtime county: ${countyId}`);
  const remote = Boolean(entry.url?.startsWith('http') || entry.manifestUrl?.startsWith('http'));
  return { countyFips: county.fips, countyId, countyName: county.countyName, countySlug: county.countyId,
    runtimePackageMode: entry.manifestUrl ? 'PARTITIONED' : 'SINGLE_COUNTY', runtimeSourcePath: entry.manifestUrl || entry.url,
    transportMode: remote ? 'REMOTE_PUBLIC_SUPABASE' : 'LOCAL_RUNTIME', runtimeStatus: entry.status };
}).sort((a, b) => a.countyFips.localeCompare(b.countyFips));
const existingFips = new Set(existingRuntimeCounties.map(c => c.countyFips));
const missingCounties = authority.filter(c => !existingFips.has(c.fips)).map(c => ({
  countyFips: c.fips, countyId: `${c.countyId}-tx`, countyName: c.countyName, countySlug: c.countyId,
  currentRuntimeRoadway: false, requiredAction: 'MANUFACTURE_AND_CERTIFY',
  ownerOsmRawExists: false, extractedTiger2025Exists: extractedTiger.has(c.fips), tiger2025ZipExists: tigerZips.has(c.fips), productionRemoteRoadwayExists: false
})).sort((a, b) => a.countyFips.localeCompare(b.countyFips));
const union = new Set([...existingFips, ...missingCounties.map(c => c.countyFips)]);
if (existingRuntimeCounties.length !== 28 || missingCounties.length !== 226 || union.size !== 254 || missingCounties.some(c => existingFips.has(c.countyFips))) throw new Error('Roadway cohort conservation failed');

const cohort = { schemaVersion: 'gridly.lp206.statewide-roadway-missing-build-cohort.v1', generatedAt: GENERATED_AT,
  totalTexasCounties: 254, existingRuntimeRoadwayCountyCount: 28, missingRoadwayCountyCount: 226,
  existingRuntimeCounties, missingCounties,
  conservation: { existingCount: 28, missingCount: 226, intersectionCount: 0, unionCount: 254, duplicateFipsCount: 0, unknownFipsCount: 0, missingTexasCountyCount: 0, extraNonTexasIdentityCount: 0 }
};

const audit = {
  schemaVersion: 'gridly.lp206.statewide-roadway-audit.v2', generatedAt: GENERATED_AT, auditOnly: true,
  controls: { productionRuntimeFilesModified: false, roadwayPackagesManufactured: false, sourceFilesDownloaded: false, supabaseWritesPerformed: false },
  decisions: { roadwayRuntimeGap: 'MISSING_COHORT_MANUFACTURING_REQUIRED', sourceAcquisition: 'NO_EXISTING_ACQUISITION_TOOLING', lp207Readiness: 'READY_FOR_LP207_PILOT' },
  accounting: { texasCounties: 254, governedRuntimeRoadwayCounties: 28, missingRuntimeRoadwayCounties: 226 },
  cohortArtifact: 'reports/lp206/statewide-roadway-missing-build-cohort.json',
  ownerEvidence: {
    lp1883: { communityIdentityPackageCount: 254, expectedPlaces: 1863, expectedMemberships: 2062, expectedMultiCountyPlaces: 163, roadwayRelatedFileCount: 0, classifiedAsRoadwayPackages: false },
    osmRaw: { fileCount: 26, uniqueCountyCount: 26, absentArtifactCount: 228, unmatchedSlugCount: 0, cohortAuthority: false },
    extractedTiger2025: { shapefileCount: 6, fips: [...extractedTiger], statewideCollection: false },
    newerTiger2025Zips: { zipCount: 3, fips: [...tigerZips], statewideCollection: false },
    productionSupabase: { projectRef: 'nhwhkbkludzkuyxmkkcj', bucket: 'gridly-roadways', public: true, totalObjectCount: 29, singleCountyLp030Objects: 24, harrisManifestCount: 1, harrisPartitionCount: 4, placeholderCount: 1, hiddenStatewideInventory: false }
  },
  sourceContract: {
    authority: 'U.S. Census Bureau TIGER/Line', vintage: 2025, product: 'All Roads by county', oneZipPerCounty: true,
    filenameConvention: 'tl_2025_<FIPS>_roads.zip', urlConvention: 'https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_<FIPS>_roads.zip',
    requiredMembers: ['.shp', '.shx', '.dbf', '.prj', '.cpg'], documentationMembersObserved: ['.shp.ea.iso.xml', '.shp.iso.xml'],
    governedToday: { httpStatusChecked: false, zipIntegrityCheckedByAcquisition: false, sourceBytesHashedByLp118: true, extractedOutputHashedByLp118: true, extractedCountyIdentityChecked: true },
    repositoryEvidence: ['docs/doccleanup/GRIDLY-MANUAL-MULTI-COUNTY-ASSET-ACQUISITION-INSTRUCTIONS-V601.md', 'assets/county-implementation/harris/runtime-assets/source/tl_2025_48201_roads.shp.iso.xml']
  },
  acquisitionTooling: {
    classification: 'NO_EXISTING_ACQUISITION_TOOLING', reusableDownloaderExists: false,
    finding: 'Repository documentation governs the official URL, but no reusable road-ZIP downloader exists. LP118 only discovers owner-supplied .zip/.shp/.geojson and invokes ogr2ogr; curl examples are manual probes and LP030 scripts upload runtime output.',
    inspected: ['tools/lp118/extract-tiger-roadways.mjs', 'docs/doccleanup/GRIDLY-MANUAL-MULTI-COUNTY-ASSET-ACQUISITION-INSTRUCTIONS-V601.md', 'scripts/Deploy-Lp030RoadwayAssets.ps1']
  },
  manufacturingTooling: {
    identified: true, scripts: ['tools/lp118/extract-tiger-roadways.mjs', 'tools/lp116/manufacture-candidate-roadways.mjs'],
    input: 'TIGER .zip/.shp or controlled GeoJSON -> normalized candidate GeoJSON', arbitraryTexasFips: true, batchFips: true,
    output: 'reports/lp118 and reports/lp116 candidate-only artifacts', schema: 'RFC 7946 FeatureCollection; LineString/MultiLineString; countyFips/countyId/stableSegmentId',
    normalization: 'EPSG:4269 to EPSG:4326, seven-decimal coordinates, geometry/containment/deduplication checks and stable sorting',
    roadNameHandling: 'TIGER properties including FULLNAME are retained; LP116 does not unify OSM and TIGER name semantics',
    partitioning: { targetFeatureCount: 35000, hardFeatureCount: 45000, targetBytes: 10485760, hardBytes: 20971520, harrisExistingStructureProtected: true },
    manifestsAndCertification: 'LP116 creates candidate manifest, per-package SHA-256, source SHA-256 and certification; no production apply or upload mode',
    modes: { whatIfCandidateOnly: true, verify: 'checkpoint/hash checks on resume plus certification checks', applyWriteProduction: false }
  },
  sourceConsistency: {
    conclusion: 'PILOT_ONLY_SOURCE_GOVERNANCE_REVIEW_REQUIRED',
    currentLp030Source: 'Historical LP030 packages were manufactured from county-scoped raw OSM GeoJSON; six retained TIGER shapefiles supported later/historical county workflows and Harris partitioning, not proof that all LP030 objects share TIGER semantics.',
    osmRole: 'Raw input for the 26 historical roadway artifacts and LP030 normalization.', tigerRole: 'Official intended source for new county candidates and existing later county/Harris workflows.',
    tiger2025IntendedForMissingCohort: true, runtimeShapeCompatible: true,
    mismatchRisk: 'TIGER and OSM differ in attributes, classification and naming semantics. Geometry normalizes to the same line FeatureCollection envelope, but source semantics are not unified. LP207 must certify a source-vintage/name/class mapping and explicitly grandfather the protected 28 before statewide execution.'
  },
  zipControls: [...tigerZips].map(fips => ({ fips, county: authority.find(c => c.fips === fips).countyName, zipOpens: true, expectedMembersPresent: true, filenameIdentityAgrees: true, schemaReadableByLp118: true, consumableByLp116AfterLp118: true, evidence: 'LP120 owner rerun technical manufacturing/certification PASS', pilotSuitable: true })),
  pilot: { recommendedFips: [...tigerZips], laterScaleValidation: { countyFips: '48113', countyName: 'Dallas', acquireOrBuildNow: false } },
  transportContract: { certifyLocalCandidateFirst: true, publishRemoteAfterCertificationOnly: true, lazyPerCountyRetrieval: true, partitionOnlyAboveEstablishedLp116Limits: true, architectureChange: false },
  existing28Protection: { enforcedByCohortSubtraction: true, excludedFips: [...existingFips].sort(), preservePackageIdentities: true, preserveHarrisPartitions: true, preserveLibertySanJacintoLocalBehavior: true, overwriteAllowed: false }
};

const md = `# LP206 — Statewide Roadway Geometry Source and Coverage Audit\n\n## Closure decision\n\nLP206 freezes **28 existing governed/runtime counties** and the exact **226-county missing-cohort roadway manufacturing** boundary. Statewide roadway geometry was not previously manufactured.\n\n- **ROADWAY_RUNTIME_GAP:** \`MISSING_COHORT_MANUFACTURING_REQUIRED\`\n- **SOURCE_ACQUISITION:** \`NO_EXISTING_ACQUISITION_TOOLING\`\n- **LP207_READINESS:** \`READY_FOR_LP207_PILOT\`\n\nFull statewide execution is not ready: a fail-closed downloader and a governed TIGER-to-runtime name/class/source-vintage contract remain required.\n\n## Exact existing 28 / missing 226\n\nThe builder derives both sets from \`data/lp104/texas-counties.json\` minus the keys of \`data/roadway-runtime-manifest.json\`; no county list is hardcoded. Conservation passes: existing 28, missing 226, intersection 0, union 254, duplicates 0, unknowns 0, omitted Texas counties 0, and non-Texas identities 0. The complete ordered records, including package/transport paths for the 28, are frozen in \`statewide-roadway-missing-build-cohort.json\`.\n\n## Prior-work reconciliation\n\nLP188.3's 254 files are community identity packages (1,863 places, 2,062 memberships, 163 multi-county places), with zero road-related files. The owner's 26 OSM raw artifacts are historical source inputs; their 228 complement is not this cohort. The six extracted TIGER shapefiles and three newer ZIPs are partial source holdings. Production Supabase contains 29 objects: 24 LP030 county objects, Harris's manifest and four partitions, plus a placeholder. None is a hidden statewide inventory.\n\n## Official source and acquisition\n\nThe repository governs U.S. Census Bureau TIGER/Line 2025 All Roads, one ZIP per county: \`https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_<FIPS>_roads.zip\`. Required shapefile data members are SHP, SHX, DBF, PRJ and CPG. LP118 hashes supplied bytes/output and validates identity/geometry, but it does **not download**, check HTTP status, or independently test ZIP integrity. No reusable acquisition script exists; manual curl examples and upload tooling are not download automation.\n\n## Manufacturing and certification\n\nLP118 accepts arbitrary/batched Texas FIPS and owner-supplied ZIP/SHP/GeoJSON, runs GDAL, checks containment and line geometry, rounds coordinates, deduplicates and sorts. LP116 creates inactive candidate packages, adaptive deterministic partitions, manifests, hashes and certification. It has no production apply/upload mode. Existing partition thresholds are 35,000 target/45,000 hard features and 10/20 MiB target/hard bytes.\n\n## Source consistency closure\n\nHistorical LP030 work used county OSM raw GeoJSON, while later retained TIGER sources and Harris workflows establish TIGER2025 as the intended missing-cohort source. Both normalize to the runtime line-FeatureCollection envelope, but OSM/TIGER naming and classification semantics are materially different. LP207 may pilot TIGER, but must govern the source-vintage/name/class mapping and grandfather the untouched 28 before statewide execution.\n\n## ZIP controls and pilot\n\nLP120 owner rerun evidence shows Lee (48287), Milam (48331), and Robertson (48395) ZIP identity/preflight and candidate roadway manufacturing/certification passed. They are the recommended LP207 pilot controls. Dallas (48113), which is missing from runtime, is the later scale control; do not acquire it yet.\n\n## Transport and protection\n\nLP207 should manufacture and certify local candidates first, publish remotely only after certification, and preserve lazy per-county retrieval. Partition only above established thresholds. The cohort subtraction excludes all current 28, forbids overwrite, and preserves their identities, Harris's four-part structure, and Liberty/San Jacinto local behavior.\n\n## Audit-only attestation\n\nNo production runtime file was modified; no roadway package was manufactured; no source file was downloaded; and no Supabase write occurred. Statewide roadway coverage remains incomplete.\n`;

const outputs = {
  'reports/lp206/statewide-roadway-missing-build-cohort.json': json(cohort),
  'reports/lp206/statewide-roadway-geometry-source-and-coverage-audit.json': json(audit),
  'reports/lp206/LP206-STATEWIDE-ROADWAY-GEOMETRY-SOURCE-AND-COVERAGE-AUDIT.md': md
};
if (WRITE) for (const [p, body] of Object.entries(outputs)) { fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true }); fs.writeFileSync(path.join(ROOT, p), body); }
if (VERIFY) for (const [p, body] of Object.entries(outputs)) if (!fs.existsSync(path.join(ROOT, p)) || fs.readFileSync(path.join(ROOT, p), 'utf8') !== body) throw new Error(`Stale LP206 artifact: ${p}`);
console.log(JSON.stringify({ mode: WRITE ? 'write' : VERIFY ? 'verify' : 'whatif', existing: 28, missing: 226, acquisition: audit.decisions.sourceAcquisition, readiness: audit.decisions.lp207Readiness }, null, 2));
