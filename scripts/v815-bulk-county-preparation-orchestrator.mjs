import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const V814_PATH = 'assets/county-implementation/county-automation-capability-audit-v814.json';
const V813_PATH = 'assets/county-implementation/county-preparation-planner-v813.json';
const OUTPUT_PATH = 'assets/county-implementation/bulk-county-preparation-plan-v815.json';
const REPORT_PATH = 'GRIDLY-BULK-COUNTY-PREPARATION-ORCHESTRATOR-V815.md';

const args = new Set(process.argv.slice(2));
const whatIf = args.has('--whatif');
const json = args.has('--json');

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function present(filePath) {
  return existsSync(filePath);
}

function safeListFiles(dir, maxDepth = 2) {
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

const toolCatalog = [
  { key: 'boundarySourceInventory', name: 'Census boundary source inventory', command: 'read Gridly-Source-Data/Census/*.geojson', path: 'Gridly-Source-Data/Census', kind: 'source_asset', safe: true, supportsDryRun: true, gapCategories: ['missing_boundary_source'], order: 10, purpose: 'Discover whether a canonical county boundary source is already staged.' },
  { key: 'boundaryValidationHarness', name: 'County boundary validation harness', command: 'node scripts/v802-county-boundary-validation.mjs', path: 'scripts/v802-county-boundary-validation.mjs', kind: 'node_validation_script', safe: true, supportsDryRun: true, gapCategories: ['missing_boundary_source', 'missing_runtime_boundary'], order: 20, purpose: 'Validate county boundary artifacts when they exist; does not activate counties.' },
  { key: 'communityPackageInventory', name: 'Community package inventory', command: 'read Community-Packages/<county>/package-manifest.json', path: 'Community-Packages', kind: 'source_asset', safe: true, supportsDryRun: true, gapCategories: ['missing_roads_package', 'missing_package_registry_entry'], order: 30, purpose: 'Detect existing community package manifests before any build step.' },
  { key: 'crossingPackageInventory', name: 'Crossing package inventory', command: 'read Crossing-Packages/<county>/package-manifest.json and <county>-crossings.geojson', path: 'Crossing-Packages', kind: 'source_asset', safe: true, supportsDryRun: true, gapCategories: ['missing_crossings_package', 'missing_package_registry_entry'], order: 40, purpose: 'Detect existing county crossing packages before any derivation step.' },
  { key: 'fraInventorySource', name: 'FRA Texas inventory source', command: 'read Crossing-Packages/Texas/fra-crossings-tx.geojson', path: 'Crossing-Packages/Texas/fra-crossings-tx.geojson', kind: 'source_asset', safe: true, supportsDryRun: true, gapCategories: ['missing_crossings_package'], order: 45, purpose: 'Use the staged FRA inventory as the source for future county-contained crossing package derivation.' },
  { key: 'countyReadinessResolver', name: 'V812 county readiness gap resolver', command: 'node scripts/v812-county-readiness-gap-resolver.mjs --json', path: 'scripts/v812-county-readiness-gap-resolver.mjs', kind: 'node_planning_script', safe: true, supportsDryRun: true, gapCategories: ['missing_boundary_source', 'missing_runtime_boundary', 'missing_runtime_registration', 'missing_roads_package', 'missing_crossings_package', 'missing_package_registry_entry'], order: 70, purpose: 'Recalculate blocked-county gaps without runtime activation.' },
  { key: 'countyPreparationPlanner', name: 'V813 county preparation planner', command: 'node scripts/v813-county-preparation-planner.mjs --json', path: 'scripts/v813-county-preparation-planner.mjs', kind: 'node_planning_script', safe: true, supportsDryRun: true, gapCategories: ['missing_boundary_source', 'missing_runtime_boundary', 'missing_runtime_registration', 'missing_roads_package', 'missing_crossings_package', 'missing_package_registry_entry'], order: 80, purpose: 'Refresh preparation tiers and manual-action recommendations.' },
  { key: 'automationCapabilityAudit', name: 'V814 automation capability audit', command: 'node scripts/v814-county-automation-capability-audit.mjs --json', path: 'scripts/v814-county-automation-capability-audit.mjs', kind: 'node_planning_script', safe: true, supportsDryRun: true, gapCategories: ['missing_boundary_source', 'missing_runtime_boundary', 'missing_runtime_registration', 'missing_roads_package', 'missing_crossings_package', 'missing_package_registry_entry'], order: 90, purpose: 'Refresh build-tool capability classification.' },
  { key: 'protectedRuntimeRegistration', name: 'Runtime registration mutation', command: 'manual only; no V815 execution', path: 'js/app.js', kind: 'protected_runtime_system', safe: false, supportsDryRun: false, gapCategories: ['missing_runtime_registration', 'missing_runtime_boundary'], order: 999, purpose: 'Protected runtime registration remains blocked by V815.' }
];

function discoveredTool(tool) {
  return { ...tool, present: present(tool.path), availableEvidence: tool.kind === 'source_asset' ? safeListFiles(tool.path, 1).slice(0, 8) : [] };
}

function countyAssetPresence(slug) {
  return {
    boundarySource: safeListFiles('Gridly-Source-Data/Census', 0).find((f) => f.includes(`${slug}-county-`) && f.endsWith('.geojson')) || null,
    implementationBoundary: present(`assets/county-implementation/${slug}/boundary/${slug}-county-boundary.geojson`),
    communityPackage: present(`Community-Packages/${slug}/package-manifest.json`),
    crossingPackage: present(`Crossing-Packages/${slug}/package-manifest.json`),
    crossingGeojson: present(`Crossing-Packages/${slug}/${slug}-crossings.geojson`)
  };
}

function readiness(gaps, tools, assets) {
  const runtimeGap = gaps.some((gap) => ['missing_runtime_registration', 'missing_runtime_boundary'].includes(gap.category));
  const dataGaps = gaps.filter((gap) => !['missing_runtime_registration', 'missing_runtime_boundary'].includes(gap.category));
  const coveredDataGaps = dataGaps.filter((gap) => tools.some((tool) => tool.gapCategories.includes(gap.category) && tool.present && tool.safe)).length;
  if (runtimeGap) return 'PREPARATION_ARTIFACTS_ONLY_RUNTIME_REVIEW_REQUIRED';
  if (dataGaps.length && coveredDataGaps === dataGaps.length && (assets.communityPackage || assets.crossingPackage || assets.boundarySource)) return 'LIKELY_READY_FOR_MANUAL_REVIEW_AFTER_PREPARATION';
  return 'MANUAL_REVIEW_REQUIRED_AFTER_PREPARATION';
}

const v814 = readJson(V814_PATH);
const v813 = readJson(V813_PATH);
const discoveredTools = toolCatalog.map(discoveredTool);
const blockedCounties = v813.counties || [];

const counties = blockedCounties.map((county) => {
  const gaps = county.gaps || [];
  const assets = countyAssetPresence(county.countySlug);
  const candidateTools = discoveredTools
    .filter((tool) => tool.safe && tool.present && gaps.some((gap) => tool.gapCategories.includes(gap.category)))
    .sort((a, b) => a.order - b.order);
  const skippedTools = discoveredTools
    .filter((tool) => gaps.some((gap) => tool.gapCategories.includes(gap.category)) && (!tool.safe || !tool.present))
    .map((tool) => ({ key: tool.key, name: tool.name, command: tool.command, reason: !tool.safe ? 'protected_or_not_safe_for_v815' : 'tool_or_source_path_not_present' }));
  const manual = gaps
    .filter((gap) => ['missing_boundary_source', 'missing_runtime_boundary', 'missing_runtime_registration'].includes(gap.category) || !candidateTools.some((tool) => tool.gapCategories.includes(gap.category)))
    .map((gap) => ({ gap: gap.category, requiredWork: gap.category === 'missing_runtime_registration' ? 'Future separate approval must prepare non-operational runtime registration; V815 never edits runtime registration or activates counties.' : gap.action }));
  return {
    county: county.county,
    countySlug: county.countySlug,
    geoid: county.geoid || null,
    currentStatus: county.currentPromotionStatus || 'BLOCKED',
    preparationTier: county.preparationTier || null,
    safeToActivate: false,
    currentAssetPresence: assets,
    toolsThatWillBeInvoked: candidateTools.map(({ key, name, command, path, purpose, order }) => ({ key, name, command, path, purpose, order, invocationMode: 'dry_run_or_read_only_plan_only' })),
    skippedTools,
    manualWorkStillRequired: manual,
    executionOrder: candidateTools.map((tool, index) => ({ step: index + 1, toolKey: tool.key, command: tool.command, mode: 'whatif_only_no_file_mutation' })),
    estimatedReadinessAfterPreparation: readiness(gaps, candidateTools, assets)
  };
});

const output = {
  milestone: 'V815',
  title: 'Bulk County Preparation Orchestrator',
  mission: 'Know Before You Go — Awareness Platform First, Route Intelligence Second',
  generatedAt: new Date().toISOString(),
  mode: whatIf ? 'WHATIF_DRY_RUN_NO_WRITES' : 'PLAN_ARTIFACT_WRITE_ONLY_NO_PRODUCTION_EXECUTION',
  inputs: { v814Path: V814_PATH, v814Read: true, v813Path: V813_PATH, v813Read: true },
  sourceAuditSummary: { blockedCountyCount: v814.blockedCountyCount, automatedCapabilityCount: v814.automatedCapabilityCount, partialCapabilityCount: v814.partialCapabilityCount, countiesSafeForBulkAutomation: v814.countiesSafeForBulkAutomation },
  guardrails: { noCountyActivation: true, runtimeUnchanged: true, protectedSystemsUnchanged: true, noProductionWriteMode: true, existingToolingReused: true },
  discoveredTools,
  blockedCountyCount: counties.length,
  counties
};

function markdownPlan() {
  return `# GRIDLY BULK COUNTY PREPARATION ORCHESTRATOR V815\n\n## Mission\n\nKnow Before You Go. Awareness Platform First. Route Intelligence Second.\n\n## Scope and Guardrails\n\nV815 is an orchestration milestone. It reads V814/V813 evidence, discovers existing source assets and scripts, and writes a county-by-county preparation plan. It does not execute production build steps, activate counties, edit runtime registration, or modify protected systems.\n\n## Summary\n\n- Mode: **${output.mode}**.\n- Blocked counties planned: **${output.blockedCountyCount}**.\n- Existing tooling reused: **true**.\n- County activation performed: **false**.\n- Runtime registration modified: **false**.\n- Protected systems modified: **false**.\n\n## Discovered Orchestration Inputs\n\n| Tool or asset | Present | Safe for V815 | Command / read action |\n| --- | --- | --- | --- |\n${discoveredTools.map((tool) => `| ${tool.name} | \`${tool.present}\` | \`${tool.safe}\` | \`${tool.command}\` |`).join('\n')}\n\n## County Preparation Plans\n\n${counties.map((county) => `### ${county.county}\n\n- Current status: \`${county.currentStatus}\`.\n- Estimated readiness after preparation: \`${county.estimatedReadinessAfterPreparation}\`.\n- Safe to activate: \`${county.safeToActivate}\`.\n- Tools that will be invoked in dry-run/read-only mode:\n${county.toolsThatWillBeInvoked.map((tool) => `  - ${tool.order}. \`${tool.command}\` — ${tool.purpose}`).join('\n') || '  - None available.'}\n- Skipped tools:\n${county.skippedTools.map((tool) => `  - \`${tool.command}\` — ${tool.reason}`).join('\n') || '  - None.'}\n- Manual work still required:\n${county.manualWorkStillRequired.map((item) => `  - \`${item.gap}\`: ${item.requiredWork}`).join('\n') || '  - None identified by V815.'}`).join('\n\n')}\n\n## Merge Recommendation\n\nMerge V815 as a planning/orchestration layer only. Future milestones may authorize actual non-runtime preparation writes, but this milestone intentionally keeps production write mode unavailable and all county activation blocked.\n`;
}

if (!whatIf) {
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  writeFileSync(REPORT_PATH, markdownPlan());
}

if (json) console.log(JSON.stringify(output, null, 2));
else console.log(`V815 bulk county preparation orchestrator complete. Mode: ${output.mode}. Counties planned: ${output.blockedCountyCount}.`);
