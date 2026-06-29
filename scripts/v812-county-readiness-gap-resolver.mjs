import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const V811_PATH = 'assets/county-implementation/county-expansion-framework-v811.json';
const PACKAGE_REGISTRY_PATH = 'assets/package-registry/runtime-package-registry.json';
const RUNTIME_PATH = 'js/app.js';
const OUTPUT_PATH = 'assets/county-implementation/county-readiness-gap-resolver-v812.json';
const REPORT_PATH = 'GRIDLY-COUNTY-READINESS-GAP-RESOLVER-V812.md';

const OPERATIONAL_COUNTIES = new Set(['liberty', 'montgomery', 'san-jacinto', 'chambers', 'jefferson']);
const GEOIDS = Object.freeze({
  liberty: '48291', montgomery: '48339', 'san-jacinto': '48407', chambers: '48071', jefferson: '48245',
  hardin: '48199', polk: '48373', walker: '48471', harris: '48201', orange: '48361', jasper: '48241',
  newton: '48351', tyler: '48457', galveston: '48167', brazoria: '48039', 'fort-bend': '48157',
  waller: '48473', austin: '48015', washington: '48477', brazos: '48041', grimes: '48185',
  wharton: '48481', colorado: '48089', fayette: '48149', lavaca: '48285', jackson: '48239',
  matagorda: '48321', calhoun: '48057'
});

function slugifyCounty(county) {
  return county.toLowerCase().replace(/ county, texas$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function titleFromSlug(slug) {
  return slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function readJsonIfPresent(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function runtimeRegistered(runtimeText, slug) {
  return runtimeText.includes(`"${slug}-tx": Object.freeze`);
}

function packageRegistryEntries(registry, countyName) {
  const packages = Array.isArray(registry?.packages) ? registry.packages : [];
  return packages.filter((entry) => entry.county === countyName);
}

function deriveSupportedCounties(v811, packageRegistry) {
  const v811Counties = Array.isArray(v811?.counties) ? v811.counties : [];
  if (v811Counties.length > 0) {
    return v811Counties.map((entry) => ({
      county: entry.county || entry.countyName || titleFromSlug(entry.countySlug || slugifyCounty(entry.county || entry.countyName)),
      countySlug: entry.countySlug || slugifyCounty(entry.county || entry.countyName),
      geoid: entry.geoid || GEOIDS[entry.countySlug || slugifyCounty(entry.county || entry.countyName)] || null,
      currentPromotionStatus: entry.currentPromotionStatus || entry.promotionStatus || entry.status || null
    }));
  }
  const communityPackages = (packageRegistry?.packages || []).filter((entry) => entry.packageType === 'Community');
  return communityPackages.map((entry) => {
    const countySlug = slugifyCounty(entry.county);
    return {
      county: entry.county,
      countySlug,
      geoid: GEOIDS[countySlug] || null,
      currentPromotionStatus: OPERATIONAL_COUNTIES.has(countySlug) ? 'OPERATIONAL' : 'BLOCKED'
    };
  });
}

function addGap(gaps, category, evidence, action) {
  gaps.push({ category, evidence, action });
}

const v811 = readJsonIfPresent(V811_PATH);
const packageRegistry = readJsonIfPresent(PACKAGE_REGISTRY_PATH);
const runtimeText = existsSync(RUNTIME_PATH) ? readFileSync(RUNTIME_PATH, 'utf8') : '';
const supportedCounties = deriveSupportedCounties(v811, packageRegistry);

const blockedCounties = supportedCounties
  .filter((county) => (county.currentPromotionStatus || '').toUpperCase() === 'BLOCKED' || !OPERATIONAL_COUNTIES.has(county.countySlug))
  .filter((county) => !OPERATIONAL_COUNTIES.has(county.countySlug))
  .sort((a, b) => a.countySlug.localeCompare(b.countySlug));

const counties = blockedCounties.map((county) => {
  const countyName = titleFromSlug(county.countySlug);
  const expectedBoundaryPath = `assets/county-implementation/${county.countySlug}/boundary/${county.countySlug}-county-boundary.geojson`;
  const expectedRoadPath = `assets/county-implementation/${county.countySlug}/runtime-assets/${county.countySlug}-county-road-segments.geojson`;
  const expectedRoadSourceDirectory = `assets/county-implementation/${county.countySlug}/runtime-assets/source`;
  const expectedCrossingPath = `assets/county-implementation/${county.countySlug}/runtime-assets/${county.countySlug}-county-rail-crossings.geojson`;
  const packageEntries = packageRegistryEntries(packageRegistry, countyName);
  const hasCommunityRegistry = packageEntries.some((entry) => entry.packageType === 'Community');
  const hasCrossingRegistry = packageEntries.some((entry) => entry.packageType === 'Crossing');
  const hasRuntimeRegistration = runtimeRegistered(runtimeText, county.countySlug);
  const hasBoundary = existsSync(expectedBoundaryPath);
  const hasRoads = existsSync(expectedRoadPath) || existsSync(expectedRoadSourceDirectory);
  const hasCrossings = existsSync(expectedCrossingPath);
  const gaps = [];

  if (!hasBoundary) addGap(gaps, 'missing_boundary_source', `No canonical boundary asset exists at ${expectedBoundaryPath}.`, `Acquire, extract, validate, and promote a county-owned boundary to ${expectedBoundaryPath} under V809/V810 canonical boundary rules.`);
  if (!hasBoundary || !hasRuntimeRegistration) addGap(gaps, 'missing_runtime_boundary', hasRuntimeRegistration ? `Runtime registration exists, but ${expectedBoundaryPath} is absent.` : `No runtime registration exists for ${county.countySlug}-tx; runtime boundary cannot resolve.`, 'Prepare a runtime boundary registration only after the canonical boundary source is present and validated; do not activate the county.');
  if (!hasRoads) addGap(gaps, 'missing_roads_package', `No road package or road source directory found for ${county.countySlug}.`, 'Place or generate the county road package in the canonical runtime-assets path during a future authorized preparation milestone.');
  if (!hasCrossings) addGap(gaps, 'missing_crossings_package', `No rail crossing package exists at ${expectedCrossingPath}.`, 'Acquire, filter, validate, and place county rail crossings in the canonical runtime-assets path.');
  if (!hasCommunityRegistry || !hasCrossingRegistry) addGap(gaps, 'missing_package_registry_entry', `Community registry present: ${hasCommunityRegistry}; crossing registry present: ${hasCrossingRegistry}.`, 'Add missing package registry entries during a future registry-only milestone without activation.');
  if (!hasRuntimeRegistration) addGap(gaps, 'missing_runtime_registration', `js/app.js does not include ${county.countySlug}-tx in GRIDLY_COUNTY_REGISTRY.`, 'Prepare a non-operational runtime registration after asset prerequisites are complete; keep operational, productionEnabled, selectable, and safeToActivate false until separately authorized.');
  if (![expectedBoundaryPath, expectedRoadPath, expectedCrossingPath].every((p) => p.includes(`/county-implementation/${county.countySlug}/`))) addGap(gaps, 'inconsistent_canonical_path', 'One or more expected paths does not remain county-scoped.', 'Correct canonical paths before preparation.');
  if (gaps.length === 0) addGap(gaps, 'unknown_manual_review_required', 'No deterministic missing asset gap was found, but V811 classified the county as BLOCKED.', 'Perform manual V811/V812 review before any preparation step.');

  return {
    county: countyName,
    countySlug: county.countySlug,
    geoid: county.geoid || GEOIDS[county.countySlug] || null,
    currentPromotionStatus: 'BLOCKED',
    targetPromotionStatus: 'READY',
    gaps,
    requiredActions: gaps.map((gap) => gap.action),
    safeToPrepare: gaps.every((gap) => gap.category !== 'unknown_manual_review_required'),
    safeToActivate: false
  };
});

function countCategory(category) {
  return counties.filter((county) => county.gaps.some((gap) => gap.category === category)).length;
}

const output = {
  milestone: 'V812',
  title: 'County Readiness Gap Resolver',
  mission: 'Know Before You Go — Awareness Platform First, Route Intelligence Second',
  scope: 'Read-only planning and tooling; no county activation and no runtime behavior changes.',
  generatedAt: new Date().toISOString(),
  inputs: { v811FrameworkPath: V811_PATH, v811FrameworkRead: Boolean(v811), packageRegistryPath: PACKAGE_REGISTRY_PATH, runtimeInspectedPath: RUNTIME_PATH },
  protectedSystemsUnchanged: true,
  operationalCountiesUnchanged: ['Liberty', 'Montgomery', 'San Jacinto', 'Chambers', 'Jefferson'],
  blockedCountyCount: counties.length,
  countiesWithMissingBoundarySource: countCategory('missing_boundary_source'),
  countiesWithMissingRuntimeBoundary: countCategory('missing_runtime_boundary'),
  countiesWithMissingRoads: countCategory('missing_roads_package'),
  countiesWithMissingCrossings: countCategory('missing_crossings_package'),
  countiesWithMissingRegistry: countCategory('missing_package_registry_entry'),
  countiesWithMissingRuntimeRegistration: countCategory('missing_runtime_registration'),
  countiesSafeToPrepare: counties.filter((county) => county.safeToPrepare).length,
  countiesSafeToActivate: counties.filter((county) => county.safeToActivate).length,
  overallDetermination: 'READINESS_GAPS_IDENTIFIED',
  counties
};

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);

const categoryRows = [
  ['Missing boundary source', output.countiesWithMissingBoundarySource],
  ['Missing runtime boundary', output.countiesWithMissingRuntimeBoundary],
  ['Missing roads package', output.countiesWithMissingRoads],
  ['Missing crossings package', output.countiesWithMissingCrossings],
  ['Missing package registry entry', output.countiesWithMissingRegistry],
  ['Missing runtime registration', output.countiesWithMissingRuntimeRegistration]
];

const report = `# GRIDLY COUNTY READINESS GAP RESOLVER V812\n\n## Mission\n\nKnow Before You Go. Awareness Platform First. Route Intelligence Second.\n\n## Scope\n\nV812 is a read-only planning and tooling milestone. It reads the V811 county expansion framework when present, inspects current registry/runtime evidence, and writes a deterministic readiness-gap plan for counties that remain BLOCKED.\n\n## Non-goals\n\n- Do not activate new counties.\n- Do not modify runtime behavior.\n- Do not modify protected systems.\n- Do not modify Awareness, Reporting, Route Watch, Alerts, Supabase synchronization, Community Intelligence, or user-facing UI.\n\n## Summary\n\n- Overall determination: **${output.overallDetermination}**.\n- Blocked county count: **${output.blockedCountyCount}**.\n- Counties safe to prepare: **${output.countiesSafeToPrepare}**.\n- Counties safe to activate: **${output.countiesSafeToActivate}**.\n- V811 framework input read: **${output.inputs.v811FrameworkRead}**.\n\n## Gap Categories\n\n| Gap category | County count |\n| --- | ---: |\n${categoryRows.map(([label, count]) => `| ${label} | ${count} |`).join('\n')}\n\n## County-by-county Action Plan\n\n${counties.map((county) => `### ${county.county}\n\n- County slug: \`${county.countySlug}\`\n- GEOID: \`${county.geoid || 'unknown'}\`\n- Current promotion status: \`${county.currentPromotionStatus}\`\n- Target promotion status: \`${county.targetPromotionStatus}\`\n- Safe to prepare: \`${county.safeToPrepare}\`\n- Safe to activate: \`${county.safeToActivate}\`\n- Gaps:\n${county.gaps.map((gap) => `  - \`${gap.category}\`: ${gap.evidence}`).join('\n')}\n- Required actions:\n${county.requiredActions.map((action) => `  - ${action}`).join('\n')}`).join('\n\n')}\n\n## Activation and Operational Confirmation\n\nNo new counties were activated by V812. The operational counties remain unchanged: Liberty, Montgomery, San Jacinto, Chambers, and Jefferson. V812 produced only the resolver script, resolver JSON output, and this report.\n`;

writeFileSync(REPORT_PATH, report);
console.log(`Wrote ${OUTPUT_PATH}`);
console.log(`Wrote ${REPORT_PATH}`);
console.log(`Blocked counties: ${output.blockedCountyCount}`);
console.log(`Overall determination: ${output.overallDetermination}`);
