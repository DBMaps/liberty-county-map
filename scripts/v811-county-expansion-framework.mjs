import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const readText = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/^\uFEFF/, '');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const readJson = (p) => JSON.parse(readText(p));
const slugify = (county) => county.toLowerCase().replace(/\s+/g, '-');

const registry = readJson('assets/package-registry/runtime-package-registry.json');
const appJs = readText('js/app.js');
const runtimeCountyIds = new Map();
for (const match of appJs.matchAll(/"([a-z-]+-tx)"\s*:\s*Object\.freeze\(\{([\s\S]*?)\n\s*\}\),/g)) {
  const [, id, body] = match;
  const name = (body.match(/name:\s*"([^"]+)"/) || [])[1] || '';
  const operational = /operational:\s*true/.test(body);
  if (name) runtimeCountyIds.set(name.replace(/ County$/, ''), { id, operational });
}

const communityEntries = registry.packages.filter((p) => String(p.packageType).toLowerCase() === 'community');
const crossingEntriesByCounty = new Map(registry.packages
  .filter((p) => String(p.packageType).toLowerCase() === 'crossing')
  .map((p) => [p.county, p]));

function geoidFromBoundarySource(sourcePath) {
  if (!exists(sourcePath)) return null;
  const geojson = readJson(sourcePath);
  const props = geojson.features?.[0]?.properties || geojson.properties || {};
  return props.GEOID || props.GEOIDFQ?.replace(/^.*US/, '') || ((props.COUNTYFP && props.STATEFP) ? `${props.STATEFP}${props.COUNTYFP}` : null);
}

function crossingAssetPresent(slug) {
  const manifest = `Crossing-Packages/${slug}/package-manifest.json`;
  return exists(manifest) && fs.readdirSync(path.join(ROOT, `Crossing-Packages/${slug}`)).some((file) => file.endsWith('.geojson'));
}

const inventory = communityEntries.map((entry) => {
  const county = entry.county;
  const slug = slugify(county);
  const sourcePath = `Gridly-Source-Data/Census/${slug}-county-2025-wgs84.geojson`;
  const runtimeBoundaryPath = `assets/county-implementation/${slug}/boundary/${slug}-county-boundary.geojson`;
  const communityManifest = exists(entry.manifest) ? readJson(entry.manifest) : null;
  const boundarySourcePresent = exists(sourcePath);
  const runtimeBoundaryPresent = exists(runtimeBoundaryPath);
  const roadsPackagePresent = Boolean(communityManifest?.roads === true);
  const crossingsPackagePresent = crossingAssetPresent(slug);
  const registryHasCommunity = Boolean(entry);
  const registryHasCrossing = crossingEntriesByCounty.has(county);
  const packageRegistryEntryPresent = registryHasCommunity && registryHasCrossing;
  const runtimeRegistration = runtimeCountyIds.get(county);
  const runtimeRegistrationPresent = Boolean(runtimeRegistration);
  const operational = Boolean(runtimeRegistration?.operational === true);
  const blockers = [];
  if (!boundarySourcePresent) blockers.push(`Missing authoritative boundary source: ${sourcePath}`);
  if (!runtimeBoundaryPresent) blockers.push(`Missing canonical runtime boundary: ${runtimeBoundaryPath}`);
  if (!roadsPackagePresent) blockers.push(`Missing roads package or roads=true in ${entry.manifest}`);
  if (!crossingsPackagePresent) blockers.push(`Missing crossings package manifest/GeoJSON under Crossing-Packages/${slug}/`);
  if (!packageRegistryEntryPresent) blockers.push(`Missing package registry entry: community=${registryHasCommunity}, crossing=${registryHasCrossing}`);

  const promotionStatus = operational ? 'OPERATIONAL' : (blockers.length === 0 ? 'READY' : 'BLOCKED');
  return {
    county,
    countySlug: slug,
    geoid: geoidFromBoundarySource(sourcePath),
    boundarySourcePresent,
    runtimeBoundaryPresent,
    roadsPackagePresent,
    crossingsPackagePresent,
    packageRegistryEntryPresent,
    runtimeRegistrationPresent,
    promotionStatus,
    blockers
  };
});

const count = (predicate) => inventory.filter(predicate).length;
const summary = {
  supportedCounties: inventory.length,
  operationalCounties: count((c) => c.promotionStatus === 'OPERATIONAL'),
  readyCounties: count((c) => c.promotionStatus === 'READY'),
  blockedCounties: count((c) => c.promotionStatus === 'BLOCKED'),
  missingBoundaries: inventory.filter((c) => !c.boundarySourcePresent || !c.runtimeBoundaryPresent).map((c) => c.county),
  missingRoads: inventory.filter((c) => !c.roadsPackagePresent).map((c) => c.county),
  missingCrossings: inventory.filter((c) => !c.crossingsPackagePresent).map((c) => c.county),
  missingRegistryEntries: inventory.filter((c) => !c.packageRegistryEntryPresent).map((c) => c.county),
  overallDetermination: inventory.some((c) => c.promotionStatus === 'READY')
    ? 'FRAMEWORK_READY_WITH_PROMOTION_CANDIDATES_HELD_READ_ONLY'
    : 'FRAMEWORK_READY_NO_NON_OPERATIONAL_COUNTY_READY_FOR_PROMOTION'
};

const output = {
  milestone: 'V811',
  title: 'County Expansion Framework',
  generatedAt: new Date().toISOString(),
  readOnly: true,
  readinessRules: {
    OPERATIONAL: 'County is already enabled in runtime with operational=true; readiness does not promote or modify runtime behavior.',
    READY: 'County is not operational and has authoritative boundary source, canonical runtime boundary, roads package, crossings package, and package registry entries.',
    BLOCKED: 'County is not operational and one or more required assets or registry entries are missing.'
  },
  summary,
  inventory
};

fs.writeFileSync(path.join(ROOT, 'assets/county-implementation/county-expansion-framework-v811.json'), `${JSON.stringify(output, null, 2)}\n`);

const yn = (v) => v ? 'yes' : 'no';
const rows = inventory.map((c) => `| ${c.county} | ${c.countySlug} | ${c.geoid || 'unknown'} | ${yn(c.boundarySourcePresent)} | ${yn(c.runtimeBoundaryPresent)} | ${yn(c.roadsPackagePresent)} | ${yn(c.crossingsPackagePresent)} | ${yn(c.packageRegistryEntryPresent)} | ${yn(c.runtimeRegistrationPresent)} | ${c.promotionStatus} | ${c.blockers.length ? c.blockers.join('<br>') : 'None'} |`).join('\n');
const md = `# V811 County Expansion Framework\n\nThis inventory is read-only. It does not promote counties, alter runtime ownership, enable runtime registrations, or modify protected systems.\n\n## Readiness Rules\n\n- **OPERATIONAL**: County is already enabled in runtime with \`operational=true\`.\n- **READY**: County is not operational and has all required assets: authoritative boundary source, canonical runtime boundary, roads package, crossings package, and package registry entries.\n- **BLOCKED**: County is not operational and one or more required assets or registry entries are missing.\n\n## Framework Summary\n\n- Supported counties: ${summary.supportedCounties}\n- Operational counties: ${summary.operationalCounties}\n- Ready counties: ${summary.readyCounties}\n- Blocked counties: ${summary.blockedCounties}\n- Missing boundaries: ${summary.missingBoundaries.length ? summary.missingBoundaries.join(', ') : 'None'}\n- Missing roads: ${summary.missingRoads.length ? summary.missingRoads.join(', ') : 'None'}\n- Missing crossings: ${summary.missingCrossings.length ? summary.missingCrossings.join(', ') : 'None'}\n- Missing registry entries: ${summary.missingRegistryEntries.length ? summary.missingRegistryEntries.join(', ') : 'None'}\n- Overall determination: ${summary.overallDetermination}\n\n## County Inventory\n\n| County | County slug | GEOID | Boundary source present | Runtime boundary present | Roads package present | Crossings package present | Package registry entry present | Runtime registration present | Promotion status | Blockers |\n|---|---|---:|---|---|---|---|---|---|---|---|\n${rows}\n\n## Quick Summary\n\nV811 adds a deterministic, read-only county expansion inventory for the current ${summary.supportedCounties} Gridly-supported counties. The framework confirms Liberty, Montgomery, San Jacinto, Chambers, and Jefferson remain the only operational counties, identifies ${summary.readyCounties} non-operational counties as READY, and blocks ${summary.blockedCounties} future counties because canonical V809/V810 boundary requirements are incomplete.\n\n## Files Modified\n\n- \`scripts/v811-county-expansion-framework.mjs\` — deterministic read-only inventory generator.\n- \`assets/county-implementation/county-expansion-framework-v811.json\` — machine-readable V811 framework output.\n- \`GRIDLY-COUNTY-EXPANSION-FRAMEWORK-V811.md\` — human-readable V811 framework report.\n\n## Merge Recommendation\n\nMerge V811 as infrastructure/tooling only. Do not activate additional counties and do not modify runtime ownership, protected systems, Awareness, Reporting, Route Watch, Alerts, Crossings, Supabase synchronization, or Community Intelligence.\n\n## Exact Validation Steps\n\n1. \`node --check scripts/v811-county-expansion-framework.mjs\`\n2. \`node scripts/v811-county-expansion-framework.mjs\`\n3. \`jq -e '.summary.operationalCounties == 5 and ([.inventory[] | select(.promotionStatus=="OPERATIONAL") | .county] == ["Liberty","Montgomery","San Jacinto","Chambers","Jefferson"]) and .summary.readyCounties == 0 and .summary.blockedCounties == 23' assets/county-implementation/county-expansion-framework-v811.json\`\n`;
fs.writeFileSync(path.join(ROOT, 'GRIDLY-COUNTY-EXPANSION-FRAMEWORK-V811.md'), md);
console.log(JSON.stringify(summary, null, 2));
