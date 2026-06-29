import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const INPUTS = {
  v815: 'assets/county-implementation/bulk-county-preparation-plan-v815.json',
  v814: 'assets/county-implementation/county-automation-capability-audit-v814.json',
  v813: 'assets/county-implementation/county-preparation-planner-v813.json',
  v812: 'assets/county-implementation/county-readiness-gap-resolver-v812.json',
  v811: 'assets/county-implementation/county-expansion-framework-v811.json'
};
const OUTPUT_PATH = 'assets/county-implementation/bulk-county-preparation-whatif-v816.json';
const REPORT_PATH = 'GRIDLY-BULK-COUNTY-PREPARATION-WHATIF-V816.md';
const PROTECTED_UNCHANGED = [
  'js/app.js',
  'assets/package-registry/runtime-package-registry.json',
  'Awareness',
  'Reporting',
  'Route Watch',
  'Alerts',
  'Crossings runtime',
  'Supabase synchronization',
  'Community Intelligence',
  'user-facing UI'
];

const args = new Set(process.argv.slice(2));
const jsonMode = args.has('--json');

function readJsonIfPresent(filePath) {
  if (!existsSync(filePath)) return { present: false, data: null };
  return { present: true, data: JSON.parse(readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')) };
}

function present(filePath) {
  return existsSync(filePath);
}

function safeListFiles(dir, maxDepth = 1) {
  if (!present(dir)) return [];
  if (!statSync(dir).isDirectory()) return [dir.replaceAll('\\', '/')];
  const files = [];
  function walk(current, depth) {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (depth < maxDepth) walk(full, depth + 1);
      } else {
        files.push(full.replaceAll('\\', '/'));
      }
    }
  }
  walk(dir, 0);
  return files;
}

function classifyGap(gap) {
  switch (gap.category) {
    case 'missing_boundary_source':
      return 'MANUAL_REQUIRED';
    case 'missing_runtime_boundary':
    case 'missing_runtime_registration':
      return 'PROTECTED_SYSTEM_DO_NOT_TOUCH';
    case 'missing_roads_package':
    case 'missing_crossings_package':
    case 'missing_package_registry_entry':
      return 'SAFE_FUTURE_WRITE';
    default:
      return 'BLOCKED';
  }
}

function expectedCreates(slug, gaps) {
  const creates = [];
  for (const gap of gaps) {
    if (gap.category === 'missing_boundary_source') creates.push(`assets/county-implementation/${slug}/boundary/${slug}-county-boundary.geojson`);
    if (gap.category === 'missing_roads_package') creates.push(`assets/county-implementation/${slug}/runtime-assets/source/<county-road-source-files>`);
    if (gap.category === 'missing_crossings_package') creates.push(`assets/county-implementation/${slug}/runtime-assets/${slug}-county-rail-crossings.geojson`);
    if (gap.category === 'missing_package_registry_entry') creates.push(`assets/county-implementation/${slug}/manifests/${slug}-package-manifest.json`);
  }
  return [...new Set(creates)];
}

function existingSourceAssets(slug) {
  const census = safeListFiles('Gridly-Source-Data/Census', 0).filter((f) => f.includes(`${slug}-county-`));
  return {
    boundaryCandidates: census,
    communityPackageManifest: present(`Community-Packages/${slug}/package-manifest.json`) ? `Community-Packages/${slug}/package-manifest.json` : null,
    crossingPackageManifest: present(`Crossing-Packages/${slug}/package-manifest.json`) ? `Crossing-Packages/${slug}/package-manifest.json` : null,
    crossingGeojson: present(`Crossing-Packages/${slug}/${slug}-crossings.geojson`) ? `Crossing-Packages/${slug}/${slug}-crossings.geojson` : null,
    fraTexasInventory: present('Crossing-Packages/Texas/fra-crossings-tx.geojson') ? 'Crossing-Packages/Texas/fra-crossings-tx.geojson' : null
  };
}

const loaded = Object.fromEntries(Object.entries(INPUTS).map(([key, filePath]) => [key, { path: filePath, ...readJsonIfPresent(filePath) }]));
const v815 = loaded.v815.data;
const v813 = loaded.v813.data;
if (!v815 || !v813) throw new Error('V816 requires V815 and V813 input artifacts.');

const counties = (v815.counties || v813.counties || []).map((county) => {
  const sourceCounty = (v813.counties || []).find((item) => item.countySlug === county.countySlug) || county;
  const gaps = sourceCounty.gaps || [];
  const plannedActions = gaps.map((gap) => ({
    gap: gap.category,
    action: gap.action,
    classification: classifyGap(gap),
    whatIfResult: classifyGap(gap) === 'PROTECTED_SYSTEM_DO_NOT_TOUCH'
      ? 'Reported only; V816 will not plan a runtime or protected-system write.'
      : 'Reported as a future candidate only; V816 performs no county preparation writes.'
  }));
  const protectedActions = plannedActions.filter((action) => action.classification === 'PROTECTED_SYSTEM_DO_NOT_TOUCH');
  const blockers = plannedActions
    .filter((action) => ['MANUAL_REQUIRED', 'BLOCKED', 'PROTECTED_SYSTEM_DO_NOT_TOUCH'].includes(action.classification))
    .map((action) => ({ gap: action.gap, classification: action.classification, reason: action.action }));
  const expectedFilesToCreate = expectedCreates(county.countySlug, gaps);
  const sourceAssetsRequired = existingSourceAssets(county.countySlug);
  const missingSourceAssets = [];
  if (gaps.some((gap) => gap.category === 'missing_boundary_source') && sourceAssetsRequired.boundaryCandidates.length === 0) missingSourceAssets.push('canonical_county_boundary_source');
  if (gaps.some((gap) => gap.category === 'missing_crossings_package') && !sourceAssetsRequired.crossingGeojson && !sourceAssetsRequired.fraTexasInventory) missingSourceAssets.push('county_crossings_source_or_fra_texas_inventory');
  return {
    county: county.county,
    countySlug: county.countySlug,
    plannedActions,
    existingToolsRequired: county.toolsThatWillBeInvoked || [],
    sourceAssetsRequired,
    expectedFilesToCreate,
    expectedFilesToModify: [],
    expectedFilesToLeaveUnchanged: PROTECTED_UNCHANGED,
    blockers: [...blockers, ...missingSourceAssets.map((asset) => ({ gap: asset, classification: 'BLOCKED', reason: 'Required source asset is not currently staged.' }))],
    manualReviewRequired: blockers.length > 0 || missingSourceAssets.length > 0,
    safeForFutureWriteMode: protectedActions.length === 0 || expectedFilesToCreate.length > 0,
    safeToActivate: false
  };
});

const expectedCreateCount = counties.reduce((sum, county) => sum + county.expectedFilesToCreate.length, 0);
const expectedModifyCount = counties.reduce((sum, county) => sum + county.expectedFilesToModify.length, 0);
const protectedSystemTouchCount = counties.reduce((sum, county) => sum + county.expectedFilesToModify.filter((file) => PROTECTED_UNCHANGED.includes(file)).length, 0);
const output = {
  milestone: 'V816',
  title: 'Bulk County Preparation WhatIf',
  mission: 'Know Before You Go — Awareness Platform First, Route Intelligence Second',
  generatedAt: new Date().toISOString(),
  mode: 'WHATIF_DRY_RUN_VALIDATION_ONLY_NO_COUNTY_PREPARATION',
  inputs: Object.fromEntries(Object.entries(loaded).map(([key, value]) => [key, { path: value.path, read: value.present }])),
  guardrails: {
    noFilesCreatedExceptV816Artifacts: true,
    noRuntimeFilesModified: true,
    noCountyPrepared: true,
    noCountyActivated: true,
    protectedSystemsUnchanged: true,
    safeToActivateForcedFalse: counties.every((county) => county.safeToActivate === false)
  },
  blockedCountyCount: v815.blockedCountyCount || counties.length,
  countiesSimulated: counties.length,
  countiesSafeForFutureWriteMode: counties.filter((county) => county.safeForFutureWriteMode).length,
  countiesBlocked: counties.filter((county) => county.blockers.some((blocker) => blocker.classification === 'BLOCKED' || blocker.classification === 'PROTECTED_SYSTEM_DO_NOT_TOUCH')).length,
  countiesManualReviewRequired: counties.filter((county) => county.manualReviewRequired).length,
  expectedCreateCount,
  expectedModifyCount,
  protectedSystemTouchCount,
  countiesSafeToActivate: counties.filter((county) => county.safeToActivate).length,
  overallDetermination: 'BULK_PREPARATION_WHATIF_COMPLETE',
  actionClassificationLegend: ['SAFE_DRY_RUN', 'SAFE_FUTURE_WRITE', 'MANUAL_REQUIRED', 'BLOCKED', 'PROTECTED_SYSTEM_DO_NOT_TOUCH'],
  counties
};

function markdownReport() {
  return `# GRIDLY BULK COUNTY PREPARATION WHATIF V816\n\n## Quick Summary\n\nV816 is a dry-run validation milestone. It reads V815, V814, V813, V812, and attempts to read V811, then simulates what future bulk county preparation would do without preparing counties, activating counties, modifying runtime behavior, or touching protected systems.\n\n- Blocked counties: **${output.blockedCountyCount}**\n- Counties simulated: **${output.countiesSimulated}**\n- Counties safe for future write mode: **${output.countiesSafeForFutureWriteMode}**\n- Counties blocked by protected/manual/source prerequisites: **${output.countiesBlocked}**\n- Counties requiring manual review: **${output.countiesManualReviewRequired}**\n- Expected files future write mode would create: **${output.expectedCreateCount}**\n- Expected files V816 would modify: **${output.expectedModifyCount}**\n- Protected system touch count: **${output.protectedSystemTouchCount}**\n- Counties safe to activate: **${output.countiesSafeToActivate}**\n- Overall determination: **${output.overallDetermination}**\n\n## Input Read Status\n\n| Input | Read | Path |\n| --- | --- | --- |\n${Object.entries(output.inputs).map(([key, value]) => `| ${key.toUpperCase()} | \`${value.read}\` | \`${value.path}\` |`).join('\n')}\n\n## Guardrails\n\n- No county assets were prepared.\n- No runtime files were modified.\n- No protected systems were modified.\n- No county was activated.\n- \`safeToActivate\` remains \`false\` for every county.\n- V816 created only the V816 machine-readable JSON and this report.\n\n## County WhatIf Results\n\n${counties.map((county) => `### ${county.county}\n\n- County slug: \`${county.countySlug}\`\n- Safe for future write mode: \`${county.safeForFutureWriteMode}\`\n- Manual review required: \`${county.manualReviewRequired}\`\n- Safe to activate: \`${county.safeToActivate}\`\n- Expected files to create in a future authorized write mode:\n${county.expectedFilesToCreate.map((file) => `  - \`${file}\``).join('\n') || '  - None.'}\n- Expected files to modify: ${county.expectedFilesToModify.length ? county.expectedFilesToModify.map((file) => `\`${file}\``).join(', ') : '`none`'}\n- Protected/runtime files left unchanged: ${county.expectedFilesToLeaveUnchanged.map((file) => `\`${file}\``).join(', ')}\n- Planned action classifications:\n${county.plannedActions.map((action) => `  - \`${action.gap}\`: \`${action.classification}\``).join('\n') || '  - None.'}\n- Blockers:\n${county.blockers.map((blocker) => `  - \`${blocker.gap}\` / \`${blocker.classification}\`: ${blocker.reason}`).join('\n') || '  - None.'}`).join('\n\n')}\n\n## Merge Recommendation\n\nMerge V816 as a dry-run validation artifact only. It documents future write-mode readiness and explicitly keeps activation, runtime registration, protected systems, Awareness, Reporting, Route Watch, Alerts, Crossings runtime behavior, Supabase synchronization, Community Intelligence, and user-facing UI unchanged.\n`;
}

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(REPORT_PATH, markdownReport());

if (jsonMode) console.log(JSON.stringify(output, null, 2));
else console.log(`V816 WhatIf complete. Counties simulated: ${output.countiesSimulated}. Protected system touches: ${output.protectedSystemTouchCount}.`);
