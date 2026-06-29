import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = 'js/app.js';
const COMMUNITY_MANIFEST = 'Community-Packages/county-manifest.json';
const PACKAGE_REGISTRY = 'js/gridlyPackageRegistry.js';
const OUTPUT_JSON = 'assets/county-implementation/regional-runtime-certification-v820.json';
const OUTPUT_MD = 'GRIDLY-REGIONAL-RUNTIME-CERTIFICATION-V820.md';
const EXPECTED_OPERATIONAL_COUNT = 28;
const writeOutputs = !process.argv.includes('--no-write');
const jsonOnly = process.argv.includes('--json');

function readText(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/^\uFEFF/, ''); }
function parseJsonFile(file) { return JSON.parse(readText(file)); }
function exists(file) { return Boolean(file) && fs.existsSync(path.join(ROOT, file)); }
function slugCounty(name = '') { return String(name).trim().toLowerCase().replace(/\s+/g, '-'); }
function countyIdFromName(name = '') { return `${slugCounty(name)}-tx`; }
function countCoordinates(value) {
  if (!Array.isArray(value)) return 0;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') return 1;
  return value.reduce((sum, child) => sum + countCoordinates(child), 0);
}
function geojsonFeatureCount(geojson) {
  if (geojson?.type === 'FeatureCollection') return Array.isArray(geojson.features) ? geojson.features.length : 0;
  if (geojson?.type === 'Feature') return 1;
  return geojson?.type ? 1 : 0;
}
function addIssue(target, countyId, check, message) { target.push({ countyId, check, message }); }

const app = readText(APP);
const registryBlock = app.slice(app.indexOf('const GRIDLY_COUNTY_REGISTRY'), app.indexOf('function gridlyIsLoadableGeoJsonSource'));
const operationalIds = [...registryBlock.matchAll(/"([a-z-]+-tx)": Object\.freeze\(\{([\s\S]*?)\n  \}\)/g)]
  .filter(([, , body]) => /operational:\s*true/.test(body))
  .map(([full, id, body]) => {
    const field = (name) => body.match(new RegExp(`${name}:\\s*(?:"([^"]*)"|null)`))?.[1] ?? (new RegExp(`${name}:\\s*null`).test(body) ? null : undefined);
    const availabilityMatch = body.match(/runtimeSourceAvailability:\s*Object\.freeze\(\{([^}]*)\}\)/);
    const availability = {};
    if (availabilityMatch) [...availabilityMatch[1].matchAll(/(boundary|roads|crossings|awarenessAreas):\s*"([^"]+)"/g)].forEach((m) => { availability[m[1]] = m[2]; });
    const geoid = (body.match(/GEOID\s*([0-9]{5})/i) || body.match(/tl_\d{4}_(48\d{3})_roads/i))?.[1] || null;
    return { id, body, name: field('name'), boundaryPath: field('boundaryPath'), roadSegmentsPath: field('roadSegmentsPath'), roadSegmentsPathPrevious: field('roadSegmentsPathPrevious'), localCrossingsPath: field('localCrossingsPath'), crossingsPath: field('crossingsPath'), manifestPath: field('manifestPath'), availability, geoid };
  });
const duplicateCountyIds = operationalIds.map((c) => c.id).filter((id, index, ids) => ids.indexOf(id) !== index);
const communityManifest = parseJsonFile(COMMUNITY_MANIFEST);
const packageRegistry = readText(PACKAGE_REGISTRY);
const communityPackages = [...packageRegistry.matchAll(/id: "community\.([^"]+)"[\s\S]*?status: "([^"]+)"/g)].map((m) => ({ countyId: m[1], status: m[2] }));
const packageByCounty = new Map(communityPackages.map((pkg) => [pkg.countyId, pkg]));
const manifestByCounty = new Map((communityManifest.counties || []).map((county) => [countyIdFromName(county.county), county]));

const results = operationalIds.map((county) => {
  const warnings = [];
  const failures = [];
  const manifestCounty = manifestByCounty.get(county.id) || null;
  const communityPackage = packageByCounty.get(county.id) || null;
  const boundaryExists = exists(county.boundaryPath);
  let boundaryParseable = false;
  let boundaryFeatureCount = 0;
  let boundaryCoordinateCount = 0;
  let boundaryGeoid = null;
  if (boundaryExists) {
    try {
      const boundary = parseJsonFile(county.boundaryPath);
      boundaryParseable = true;
      boundaryFeatureCount = geojsonFeatureCount(boundary);
      boundaryCoordinateCount = boundary.type === 'FeatureCollection'
        ? boundary.features.reduce((sum, feature) => sum + countCoordinates(feature.geometry?.coordinates), 0)
        : countCoordinates(boundary.geometry?.coordinates || boundary.coordinates);
      const props = boundary.type === 'FeatureCollection' ? boundary.features[0]?.properties : boundary.properties;
      boundaryGeoid = props?.GEOID || props?.GEOIDFQ?.slice(-5) || null;
    } catch (error) { addIssue(failures, county.id, 'boundaryParseable', error.message); }
  } else addIssue(failures, county.id, 'boundarySourceExists', `Missing boundary file: ${county.boundaryPath}`);
  if (boundaryExists && boundaryParseable && boundaryFeatureCount < 1) addIssue(failures, county.id, 'boundaryRenders', 'Boundary GeoJSON has no features.');
  if (boundaryExists && boundaryParseable && boundaryCoordinateCount > 0 && boundaryCoordinateCount < 4) addIssue(failures, county.id, 'coordinateCountReasonable', `Boundary coordinate count is ${boundaryCoordinateCount}.`);
  if (county.geoid && boundaryGeoid && county.geoid !== boundaryGeoid) addIssue(failures, county.id, 'geoidMatches', `Runtime GEOID ${county.geoid} does not match boundary GEOID ${boundaryGeoid}.`);

  const roadsExpected = manifestCounty?.roads === true || ['available', 'source-available'].includes(county.availability.roads);
  const roadSource = county.roadSegmentsPath || county.roadSegmentsPathPrevious || null;
  const roadFilePresent = exists(roadSource);
  if (roadsExpected && !roadFilePresent) addIssue(warnings, county.id, 'roadSourcePresentWhenExpected', `Roads are expected but no local road source file exists at ${roadSource || 'null'}.`);
  if (county.roadSegmentsPath && /\.geojson$/i.test(county.roadSegmentsPath)) {
    try { parseJsonFile(county.roadSegmentsPath); } catch (error) { addIssue(failures, county.id, 'roadGeojsonParseable', error.message); }
  }

  const crossingsUnavailable = county.availability.crossings === 'unavailable' || manifestCounty?.crossings === false;
  const crossingSource = county.localCrossingsPath || county.crossingsPath || null;
  const localCrossingExpected = Boolean(county.localCrossingsPath);
  const crossingFilePresent = localCrossingExpected ? exists(county.localCrossingsPath) : Boolean(county.crossingsPath);
  if (!crossingFilePresent && !crossingsUnavailable) addIssue(failures, county.id, 'crossingSourcePresent', `Missing crossing source: ${crossingSource || 'null'}.`);
  if (localCrossingExpected && crossingFilePresent) {
    try {
      const crossingGeojson = parseJsonFile(county.localCrossingsPath);
      const crossingCount = geojsonFeatureCount(crossingGeojson);
      if (crossingCount < 0) addIssue(failures, county.id, 'crossingCountNonNegative', `Crossing count ${crossingCount}.`);
    } catch (error) { addIssue(failures, county.id, 'crossingGeojsonParseable', error.message); }
  }

  if (!manifestCounty) addIssue(failures, county.id, 'countyExistsInCommunityManifest', 'County missing from Community-Packages/county-manifest.json.');
  if (!communityPackage) addIssue(failures, county.id, 'countyExistsInRuntimePackageRegistry', 'County missing from js/gridlyPackageRegistry.js community packages.');
  if (communityPackage && !['active', 'operational', 'operational-maintenance'].includes(communityPackage.status)) addIssue(failures, county.id, 'communityPackageStatusOperational', `Package status is ${communityPackage.status}.`);
  if (duplicateCountyIds.length) addIssue(failures, county.id, 'noDuplicateCountyIds', `Duplicate IDs: ${duplicateCountyIds.join(', ')}`);

  return { countyId: county.id, countyName: county.name, runtime: { operational: true, selectable: /selectable:\s*true/.test(county.body), productionEnabled: /productionEnabled:\s*true/.test(county.body) }, boundary: { path: county.boundaryPath, exists: boundaryExists, parseable: boundaryParseable, featureCount: boundaryFeatureCount, coordinateCount: boundaryCoordinateCount, runtimeGeoid: county.geoid, boundaryGeoid }, roads: { expected: roadsExpected, source: roadSource, present: roadFilePresent }, crossings: { source: crossingSource, present: crossingFilePresent, unavailable: crossingsUnavailable }, package: { manifestStatus: manifestCounty?.status || null, registryStatus: communityPackage?.status || null }, passed: failures.length === 0, warned: warnings.length > 0, warnings, failures };
});

const warnings = results.flatMap((r) => r.warnings);
const failures = results.flatMap((r) => r.failures);
if (operationalIds.length !== EXPECTED_OPERATIONAL_COUNT) addIssue(failures, 'regional', 'runtimeRegistryCount', `Expected ${EXPECTED_OPERATIONAL_COUNT}, found ${operationalIds.length}.`);
if ((communityManifest.counties || []).length !== EXPECTED_OPERATIONAL_COUNT) addIssue(failures, 'regional', 'supportedCountyManifestCount', `Expected ${EXPECTED_OPERATIONAL_COUNT}, found ${(communityManifest.counties || []).length}.`);

const countiesFailed = [...new Set(failures.filter((f) => f.countyId !== 'regional').map((f) => f.countyId))];
const countiesPassed = results.filter((r) => r.passed).map((r) => r.countyId);
const countiesWarned = results.filter((r) => r.passed && r.warned).map((r) => r.countyId);
const overallDetermination = failures.length > 0 ? 'REGIONAL_RUNTIME_BLOCKED' : (warnings.length > 0 ? 'REGIONAL_RUNTIME_CERTIFIED_WITH_WARNINGS' : 'REGIONAL_RUNTIME_CERTIFIED');
const output = { audit: 'V820 Regional Runtime Certification', generatedAt: new Date().toISOString(), operationalCountyCount: operationalIds.length, countiesPassed, countiesWarned, countiesFailed, warnings, failures, results, overallDetermination };

const md = `# GRIDLY REGIONAL RUNTIME CERTIFICATION V820\n\n## Summary\n\n- Audit: **${output.audit}**\n- Generated at: **${output.generatedAt}**\n- Operational county count: **${output.operationalCountyCount}**\n- Counties passed: **${output.countiesPassed.length}**\n- Counties warned: **${output.countiesWarned.length}**\n- Counties failed: **${output.countiesFailed.length}**\n- Overall determination: **${output.overallDetermination}**\n\n## Scope\n\nV820 is certification-only tooling. It does not activate new counties and does not modify Awareness, Reporting, Route Watch, Alerts, Supabase sync, Community Intelligence, or user-facing UI logic. The operational county registry remains the source of truth.\n\n## Warnings\n\n${warnings.length ? warnings.map((w) => `- ${w.countyId}: \`${w.check}\` — ${w.message}`).join('\n') : '- None.'}\n\n## Failures\n\n${failures.length ? failures.map((f) => `- ${f.countyId}: \`${f.check}\` — ${f.message}`).join('\n') : '- None.'}\n\n## County Results\n\n| County | Boundary | Roads | Crossings | Package | Result |\n| --- | --- | --- | --- | --- | --- |\n${results.map((r) => `| ${r.countyName} (\`${r.countyId}\`) | ${r.boundary.exists && r.boundary.parseable ? 'pass' : 'fail'} | ${r.roads.present ? 'present' : (r.roads.expected ? 'warning' : 'not expected')} | ${r.crossings.present ? 'present' : (r.crossings.unavailable ? 'unavailable' : 'missing')} | ${r.package.registryStatus || 'missing'} | ${r.passed ? (r.warned ? 'pass with warnings' : 'pass') : 'fail'} |`).join('\n')}\n\n## Validation\n\n1. \`node --check js/app.js\`\n2. \`node --check scripts/v820-regional-runtime-certification.mjs\`\n3. \`node scripts/v820-regional-runtime-certification.mjs --json\`\n4. Browser helper: \`window.gridlyRegionalRuntimeCertification?.()\`\n`;

if (writeOutputs) {
  fs.mkdirSync(path.dirname(path.join(ROOT, OUTPUT_JSON)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, OUTPUT_JSON), `${JSON.stringify(output, null, 2)}\n`);
  fs.writeFileSync(path.join(ROOT, OUTPUT_MD), md);
}
if (jsonOnly) console.log(JSON.stringify(output, null, 2));
else console.log(`${overallDetermination}: ${operationalIds.length} operational counties, ${warnings.length} warnings, ${failures.length} failures.`);
if (failures.length > 0) process.exitCode = 1;
