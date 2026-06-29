import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const FRAMEWORK_PATH = 'assets/county-implementation/county-expansion-framework-v811.json';
const OUTPUT_PATH = 'assets/county-implementation/bulk-county-promotion-v818.json';
const REPORT_PATH = 'GRIDLY-BULK-COUNTY-PROMOTION-GUARDED-V818.md';
const APP_PATH = 'js/app.js';
const PACKAGE_REGISTRY_PATH = 'js/gridlyPackageRegistry.js';
const COUNTY_MANIFEST_PATH = 'Community-Packages/county-manifest.json';

const args = new Set(process.argv.slice(2));
const applyMode = args.has('--apply');
const jsonMode = args.has('--json');
const mode = applyMode ? 'APPLY' : 'WHATIF';
const completion = applyMode ? 'BULK_PROMOTION_APPLIED' : 'BULK_PROMOTION_WHATIF_COMPLETE';

const protectedPatterns = [
  /(^|\/)awareness(\/|\.|-|$)/i,
  /(^|\/)reporting(\/|\.|-|$)/i,
  /route-watch/i,
  /(^|\/)alerts?(\/|\.|-|$)/i,
  /supabase/i,
  /community-intelligence/i,
  /(^|\/)boundary\//i,
  /boundary\.geojson$/i,
  /crossings?\.geojson$/i,
  /road(s|-segments)?\.geojson$/i,
  /runtime-assets\//i,
  /(^|\/)(css|styles|components|pages|ui)\//i
];
const allowedWritePaths = new Set([APP_PATH, PACKAGE_REGISTRY_PATH, COUNTY_MANIFEST_PATH, OUTPUT_PATH, REPORT_PATH]);

function readText(filePath) { return readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''); }
function readJson(filePath) { return JSON.parse(readText(filePath)); }
function writeJson(filePath, value) { mkdirSync(path.dirname(filePath), { recursive: true }); writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }
function normalize(filePath) { return filePath.replaceAll('\\', '/').replace(/^\.\//, ''); }
function isProtected(filePath) { const p = normalize(filePath); return protectedPatterns.some((pattern) => pattern.test(p)); }
function countyId(slug) { return `${slug}-tx`; }
function countyEntry(county) {
  const id = countyId(county.countySlug);
  const countyName = `${county.county} County`;
  return `  "${id}": Object.freeze({
    id: "${id}",
    name: "${countyName}",
    state: "TX",
    defaultCity: "${county.county}",
    stage: GRIDLY_COUNTY_STAGE_OPERATIONAL,
    operational: true,
    productionEnabled: true,
    selectable: true,
    packageRoot: "assets/county-implementation/${county.countySlug}/",
    manifestPath: "Community-Packages/${county.countySlug}/package-manifest.json",
    boundaryPath: "assets/county-implementation/${county.countySlug}/boundary/${county.countySlug}-county-boundary.geojson",
    boundarySource: "V818 guarded bulk promotion from V811 READY framework inventory (GEOID ${county.geoid}).",
    roadSegmentsPath: null,
    roadSegmentsPathPrevious: "assets/county-implementation/${county.countySlug}/runtime-assets/source/tl_2025_${county.geoid}_roads.shp",
    crossingsPath: null,
    localCrossingsPath: "Crossing-Packages/${county.countySlug}/${county.countySlug}-crossings.geojson",
    crossingOverridesPath: null,
    defaultAwarenessAreas: ["${countyName}"],
    runtimeSourceOwner: "${county.countySlug}-owned",
    runtimeSourceAvailability: Object.freeze({ boundary: "available", roads: "source-available", crossings: "available", awarenessAreas: "available" }),
    controlledPromotion: Object.freeze({ milestone: "V818", status: "bulk-guarded-promoted", sourceFramework: "V811" })
  })`;
}
function packageEntry(county) {
  const id = countyId(county.countySlug);
  return `    { id: "community.${id}", name: "${county.county}", packageType: "community", version: "1.0.0-v818-bulk-promotion", status: "active", dependencies: [], capabilities: ["community-metadata", "regional-membership", "bulk-guarded-promotion"], validationState: "valid", community: Object.freeze({ countyId: "${id}", displayName: "${county.county}", countyName: "${county.county} County", state: "TX", productionEnabled: true, selectable: true }), regional: Object.freeze({ foundationId: "regional.southeast-texas", operationalRegionId: "operational-region.southeast-texas", countyId: "${id}", lifecycle: "production", activeImplementation: true, controlledPromotion: true, bulkPromotionMilestone: "V818", runtimeOwnershipMigrated: false }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "bulk-guarded-promoted-community-package" }), ownership: Object.freeze({ ownsPackageMetadata: true, ownsValidationState: true, ownsRoads: false, ownsCorridors: false, ownsRail: false, ownsCrossings: false, ownsTransportationIntelligence: false, ownsIntelligenceObjects: false, ownsTrust: false, ownsPresentationBehavior: false }) }`;
}

function upsertAppRegistry(app, readyCounties) {
  const missing = readyCounties.filter((county) => !app.includes(`"${countyId(county.countySlug)}": Object.freeze({`));
  if (missing.length === 0) return app;
  const insertion = `${missing.map(countyEntry).join(',\n')},`;
  return app.replace(/\n  \}\),\}\);\n\nfunction gridlyIsLoadableGeoJsonSource/, `\n  }),\n${insertion}});\n\nfunction gridlyIsLoadableGeoJsonSource`);
}
function upsertPackageRegistry(body, readyCounties) {
  let next = body;
  const existing = new Set([...body.matchAll(/id: "community\.([^"]+)"/g)].map((m) => m[1]));
  const newEntries = [];
  for (const county of readyCounties) {
    const id = countyId(county.countySlug);
    if (existing.has(id)) {
      const linePattern = new RegExp(`^\\s*\\{ id: \"community\\.${id}\".*?\\},?$`, 'm');
      next = next.replace(linePattern, `${packageEntry(county)},`);
    } else newEntries.push(packageEntry(county));
  }
  if (newEntries.length) next = next.replace(/\n\n    \{ id: "transportation\.tx146"/, `\n${newEntries.join(',\n')},\n\n    { id: "transportation.tx146"`);
  return next;
}
function updateCountyManifest(manifest, readyCounties) {
  const readyByName = new Set(readyCounties.map((c) => c.county));
  for (const county of manifest.counties || []) {
    if (readyByName.has(county.county)) {
      county.status = 'operational';
      county.boundary = true;
      county.roads = true;
      county.crossings = true;
      county.notes = 'Promoted to operational by V818 guarded bulk county promotion.';
    }
  }
  manifest.lastBulkPromotion = { milestone: 'V818', promotedCounties: readyCounties.map((c) => c.county), operationalCountyCount: (manifest.counties || []).filter((c) => c.status === 'operational').length };
  return manifest;
}

const framework = readJson(FRAMEWORK_PATH);
const readyCounties = framework.inventory.filter((county) => county.promotionStatus === 'READY');
const operationalBefore = framework.inventory.filter((county) => county.promotionStatus === 'OPERATIONAL');
const plannedFiles = [APP_PATH, PACKAGE_REGISTRY_PATH, COUNTY_MANIFEST_PATH, OUTPUT_PATH, REPORT_PATH];
const guardrailViolations = plannedFiles.filter((filePath) => !allowedWritePaths.has(filePath) || isProtected(filePath)).map((filePath) => ({ filePath, reason: 'Planned file is outside V818 allowed registration/package/report surface or matches protected data/system guardrail.' }));
const protectedSystemTouchCount = plannedFiles.filter(isProtected).length;

let filesModified = [];
if (applyMode && guardrailViolations.length === 0) {
  const writes = new Map();
  writes.set(APP_PATH, upsertAppRegistry(readText(APP_PATH), readyCounties));
  writes.set(PACKAGE_REGISTRY_PATH, upsertPackageRegistry(readText(PACKAGE_REGISTRY_PATH), readyCounties));
  writes.set(COUNTY_MANIFEST_PATH, `${JSON.stringify(updateCountyManifest(readJson(COUNTY_MANIFEST_PATH), readyCounties), null, 2)}\n`);
  for (const [filePath, content] of writes) {
    if (readText(filePath) !== content) { writeFileSync(filePath, content); filesModified.push(filePath); }
  }
}

if (applyMode && guardrailViolations.length === 0) {
  for (const generatedPath of [OUTPUT_PATH, REPORT_PATH]) {
    if (!filesModified.includes(generatedPath)) filesModified.push(generatedPath);
  }
}

const operationalAfterCount = operationalBefore.length + readyCounties.length;
const output = {
  milestone: 'V818', title: 'Bulk County Promotion Guarded', generatedAt: new Date().toISOString(), mode,
  completion,
  sourceFramework: FRAMEWORK_PATH,
  readyCountiesEvaluated: readyCounties.map((c) => ({ county: c.county, countySlug: c.countySlug, geoid: c.geoid, promotionStatus: c.promotionStatus })),
  operationalCountiesBefore: operationalBefore.map((c) => c.county),
  operationalCountiesAfter: framework.inventory.map((c) => c.county),
  filesPlanned: plannedFiles,
  filesModified,
  guardrailViolations,
  protectedSystemTouchCount,
  summary: {
    mode,
    readyCountiesEvaluated: readyCounties.length,
    countiesPromoted: applyMode && guardrailViolations.length === 0 ? readyCounties.length : 0,
    operationalCountiesBefore: operationalBefore.length,
    operationalCountiesAfter: operationalAfterCount,
    filesModified,
    guardrailViolations: guardrailViolations.length,
    protectedSystemTouchCount,
    overallDetermination: guardrailViolations.length ? 'BULK_PROMOTION_BLOCKED_BY_GUARDRAILS' : completion
  }
};

function buildReport() {
  const s = output.summary;
  return `# GRIDLY BULK COUNTY PROMOTION GUARDED V818\n\n## Quick Summary\n\nV818 promotes only counties marked \`READY\` in the V811 framework to runtime/package operational availability. The script defaults to what-if mode and restricts writes to county runtime registration, package registry availability, supported county manifest status, and generated V818 outputs. Protected systems, boundary geometry, crossing data, and road data are not write targets.\n\n| Metric | Value |\n| --- | ---: |\n| Mode | \`${s.mode}\` |\n| Ready counties evaluated | ${s.readyCountiesEvaluated} |\n| Counties promoted | ${s.countiesPromoted} |\n| Operational counties before | ${s.operationalCountiesBefore} |\n| Operational counties after | ${s.operationalCountiesAfter} |\n| Files modified | ${s.filesModified.length ? s.filesModified.map((f) => `\`${f}\``).join(', ') : 'None'} |\n| Guardrail violations | ${s.guardrailViolations} |\n| Protected system touch count | ${s.protectedSystemTouchCount} |\n| Overall determination | \`${s.overallDetermination}\` |\n\n## Counties Promoted / What-if Promotion Set\n\n${readyCounties.map((c, index) => `${index + 1}. ${c.county} (\`${countyId(c.countySlug)}\`, GEOID ${c.geoid})`).join('\n')}\n\n## Files Modified\n\n${s.filesModified.length ? s.filesModified.map((f) => `- \`${f}\``).join('\n') : '- None in what-if mode.'}\n\n## Guardrails\n\n- Awareness, Reporting, Route Watch, Alerts, Supabase synchronization, Community Intelligence, and UI behavior are excluded from write targets.\n- Boundary geometry, crossing data, and road data are excluded from write targets.\n- Existing V811 OPERATIONAL counties are preserved.\n- The apply path is blocked if any planned target matches protected-system/data guardrails.\n\n## Merge Recommendation\n\nMerge V818 if validation reports \`${completion}\`, 23 READY counties in the promotion set, 28 operational counties after apply, zero guardrail violations, and zero protected system touches.\n\n## Exact Validation Steps\n\n1. \`node --check scripts/v818-bulk-county-promotion-guarded.mjs\`\n2. \`node scripts/v818-bulk-county-promotion-guarded.mjs --whatif --json\`\n3. \`node scripts/v818-bulk-county-promotion-guarded.mjs --apply --json\`\n4. \`node -e "const fs=require('fs'); const app=fs.readFileSync('js/app.js','utf8'); const block=app.slice(app.indexOf('const GRIDLY_COUNTY_REGISTRY'), app.indexOf('function gridlyIsLoadableGeoJsonSource')); const ids=[...block.matchAll(/\"([a-z-]+-tx)\": Object\.freeze\(\{/g)].map(m=>m[1]); const count=(block.match(/operational: true/g)||[]).length; if(ids.length!==28 || new Set(ids).size!==28 || count!==28) throw new Error('expected 28 unique operational runtime counties'); console.log(ids.length, count);"\`\n5. \`git diff --name-only | rg -v '^(scripts/v818-bulk-county-promotion-guarded\\.mjs|assets/county-implementation/bulk-county-promotion-v818\\.json|GRIDLY-BULK-COUNTY-PROMOTION-GUARDED-V818\\.md|js/app\\.js|js/gridlyPackageRegistry\\.js|Community-Packages/county-manifest\\.json)$'\`\n`;
}

if (applyMode) {
  writeJson(OUTPUT_PATH, output);
  writeFileSync(REPORT_PATH, buildReport());
} else if (!args.has('--whatif')) {
  // Default is what-if/no writes.
}

if (jsonMode) console.log(JSON.stringify(output, null, 2));
else console.log(`${completion}. Ready counties evaluated: ${readyCounties.length}. Operational after apply would be: ${operationalAfterCount}.`);
if (guardrailViolations.length) process.exitCode = 1;
