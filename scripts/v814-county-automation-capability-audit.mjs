import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const V812_PATH = 'assets/county-implementation/county-readiness-gap-resolver-v812.json';
const V813_PATH = 'assets/county-implementation/county-preparation-planner-v813.json';
const OUTPUT_PATH = 'assets/county-implementation/county-automation-capability-audit-v814.json';
const REPORT_PATH = 'GRIDLY-COUNTY-AUTOMATION-CAPABILITY-AUDIT-V814.md';

const OPERATIONAL_COUNTIES = ['Liberty', 'Montgomery', 'San Jacinto', 'Chambers', 'Jefferson'];
const INSPECTED_PATHS = [
  'Gridly-Source-Data',
  'Tools/Build-Scripts',
  'Community-Packages',
  'Crossing-Packages',
  'Gridly-Source-Data/Census',
  'assets/county-implementation'
];

const TOOL_DEFINITIONS = [
  ['Acquire-ArcGISDataset.ps1', 'boundary source acquisition support'],
  ['Add-CountiesToManifest.ps1', 'county manifest update support'],
  ['Build-CommunityPackage.ps1', 'roads/community package build support'],
  ['Build-RegionalExpansion.ps1', 'regional expansion build support'],
  ['Get-BuildInventory.ps1', 'build inventory reporting support'],
  ['Get-CountyInventory.ps1', 'county inventory reporting support'],
  ['Get-FraInventory.ps1', 'FRA inventory reporting support'],
  ['gridly-gis-env.ps1', 'GIS build environment support'],
  ['Test-CommunityPackage.ps1', 'package validation/testing support'],
  ['Update-FraDataset.ps1', 'FRA update support'],
  ['Watch-CommunityPackage.ps1', 'watcher support']
];

function readJsonIfPresent(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function listFiles(dir, depth = 1) {
  if (!existsSync(dir)) return [];
  const out = [];
  function walk(current, remaining) {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (remaining > 0) walk(full, remaining - 1);
      } else {
        out.push(full.replaceAll('\\', '/'));
      }
    }
  }
  walk(dir, depth);
  return out;
}

function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  let count = 0;
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else count += 1;
    }
  }
  walk(dir);
  return count;
}

function pathSummary(dir) {
  return {
    path: dir,
    present: existsSync(dir),
    type: existsSync(dir) ? (statSync(dir).isDirectory() ? 'directory' : 'file') : 'missing',
    fileCount: existsSync(dir) && statSync(dir).isDirectory() ? countFiles(dir) : 0,
    sampleFiles: existsSync(dir) && statSync(dir).isDirectory() ? listFiles(dir, 1).slice(0, 12) : []
  };
}

function scriptPresent(name) {
  return existsSync(path.join('Tools/Build-Scripts', name));
}

const toolInventory = TOOL_DEFINITIONS.map(([script, purpose]) => ({
  script,
  path: `Tools/Build-Scripts/${script}`,
  purpose,
  present: scriptPresent(script)
}));

const hasAnyCommunityPackages = existsSync('Community-Packages') && listFiles('Community-Packages', 1).some((f) => f.endsWith('package-manifest.json'));
const hasAnyCrossingPackages = existsSync('Crossing-Packages') && listFiles('Crossing-Packages', 1).some((f) => f.endsWith('package-manifest.json'));
const hasCensus = existsSync('Gridly-Source-Data/Census') && listFiles('Gridly-Source-Data/Census', 0).some((f) => f.endsWith('.geojson'));
const hasCountyImplementation = existsSync('assets/county-implementation');

const capabilities = [
  {
    key: 'boundarySourcePreparation',
    label: 'Boundary source preparation',
    classification: scriptPresent('Acquire-ArcGISDataset.ps1') && hasCensus ? 'AUTOMATED' : hasCensus || scriptPresent('Acquire-ArcGISDataset.ps1') ? 'PARTIALLY_AUTOMATED' : 'MANUAL_REQUIRED',
    evidence: ['Census source directory present: ' + hasCensus, 'Acquire-ArcGISDataset.ps1 present: ' + scriptPresent('Acquire-ArcGISDataset.ps1')]
  },
  {
    key: 'runtimeBoundaryPreparation',
    label: 'Runtime boundary preparation',
    classification: hasCountyImplementation && hasCensus ? 'PARTIALLY_AUTOMATED' : 'MANUAL_REQUIRED',
    evidence: ['County implementation workspace present: ' + hasCountyImplementation, 'Canonical Census GeoJSON sources present: ' + hasCensus, 'No activation/runtime mutation tool is used by V814.']
  },
  {
    key: 'roadsCommunityPackageBuilding',
    label: 'Roads/community package building',
    classification: scriptPresent('Build-CommunityPackage.ps1') ? 'AUTOMATED' : hasAnyCommunityPackages ? 'PARTIALLY_AUTOMATED' : 'MANUAL_REQUIRED',
    evidence: ['Build-CommunityPackage.ps1 present: ' + scriptPresent('Build-CommunityPackage.ps1'), 'Community packages present: ' + hasAnyCommunityPackages]
  },
  {
    key: 'crossingPackageBuilding',
    label: 'Crossing package building',
    classification: hasAnyCrossingPackages ? 'PARTIALLY_AUTOMATED' : 'MANUAL_REQUIRED',
    evidence: ['Crossing package directory/packages present: ' + hasAnyCrossingPackages, 'No dedicated crossing package builder was listed or found.']
  },
  {
    key: 'fraInventoryUpdateSupport',
    label: 'FRA inventory/update support',
    classification: scriptPresent('Get-FraInventory.ps1') && scriptPresent('Update-FraDataset.ps1') ? 'AUTOMATED' : existsSync('Crossing-Packages/Texas/fra-crossings-tx.geojson') ? 'PARTIALLY_AUTOMATED' : 'UNAVAILABLE',
    evidence: ['Get-FraInventory.ps1 present: ' + scriptPresent('Get-FraInventory.ps1'), 'Update-FraDataset.ps1 present: ' + scriptPresent('Update-FraDataset.ps1'), 'Texas FRA package present: ' + existsSync('Crossing-Packages/Texas/fra-crossings-tx.geojson')]
  },
  {
    key: 'countyManifestUpdates',
    label: 'County manifest updates',
    classification: scriptPresent('Add-CountiesToManifest.ps1') ? 'AUTOMATED' : existsSync('Community-Packages/county-manifest.json') || existsSync('Crossing-Packages/crossing-manifest.json') ? 'PARTIALLY_AUTOMATED' : 'MANUAL_REQUIRED',
    evidence: ['Add-CountiesToManifest.ps1 present: ' + scriptPresent('Add-CountiesToManifest.ps1'), 'Manifest files present: ' + (existsSync('Community-Packages/county-manifest.json') || existsSync('Crossing-Packages/crossing-manifest.json'))]
  },
  {
    key: 'regionalExpansionBuilding',
    label: 'Regional expansion building',
    classification: scriptPresent('Build-RegionalExpansion.ps1') ? 'AUTOMATED' : 'UNAVAILABLE',
    evidence: ['Build-RegionalExpansion.ps1 present: ' + scriptPresent('Build-RegionalExpansion.ps1')]
  },
  {
    key: 'packageValidationTesting',
    label: 'Package validation/testing',
    classification: scriptPresent('Test-CommunityPackage.ps1') ? 'AUTOMATED' : hasAnyCommunityPackages || hasAnyCrossingPackages ? 'PARTIALLY_AUTOMATED' : 'UNKNOWN',
    evidence: ['Test-CommunityPackage.ps1 present: ' + scriptPresent('Test-CommunityPackage.ps1')]
  },
  {
    key: 'buildInventoryReporting',
    label: 'Build inventory reporting',
    classification: scriptPresent('Get-BuildInventory.ps1') && scriptPresent('Get-CountyInventory.ps1') ? 'AUTOMATED' : hasAnyCommunityPackages || hasCountyImplementation ? 'PARTIALLY_AUTOMATED' : 'UNKNOWN',
    evidence: ['Get-BuildInventory.ps1 present: ' + scriptPresent('Get-BuildInventory.ps1'), 'Get-CountyInventory.ps1 present: ' + scriptPresent('Get-CountyInventory.ps1')]
  },
  {
    key: 'watcherSupport',
    label: 'Watcher support',
    classification: scriptPresent('Watch-CommunityPackage.ps1') ? 'AUTOMATED' : 'UNAVAILABLE',
    evidence: ['Watch-CommunityPackage.ps1 present: ' + scriptPresent('Watch-CommunityPackage.ps1')]
  }
];

function actionForGap(gap) {
  const category = gap.category || gap;
  if (category === 'missing_boundary_source') return capabilities.find((c) => c.key === 'boundarySourcePreparation').classification === 'AUTOMATED' || capabilities.find((c) => c.key === 'boundarySourcePreparation').classification === 'PARTIALLY_AUTOMATED' ? 'Use existing source-data/boundary acquisition evidence to acquire or stage canonical boundary source.' : null;
  if (category === 'missing_runtime_boundary' || category === 'missing_runtime_registration') return capabilities.find((c) => c.key === 'runtimeBoundaryPreparation').classification === 'AUTOMATED' || capabilities.find((c) => c.key === 'runtimeBoundaryPreparation').classification === 'PARTIALLY_AUTOMATED' ? 'Prepare non-operational runtime boundary inputs in a future authorized preparation milestone; keep activation false.' : null;
  if (category === 'missing_roads_package') return capabilities.find((c) => c.key === 'roadsCommunityPackageBuilding').classification !== 'MANUAL_REQUIRED' ? 'Build or inventory community/roads package from existing package tooling/assets.' : null;
  if (category === 'missing_crossings_package') return capabilities.find((c) => c.key === 'crossingPackageBuilding').classification === 'PARTIALLY_AUTOMATED' ? 'Derive county crossing package from existing Crossing-Packages/FRA package assets, then validate manually.' : null;
  if (category === 'missing_package_registry_entry') return capabilities.find((c) => c.key === 'countyManifestUpdates').classification !== 'MANUAL_REQUIRED' ? 'Update package manifests in a future non-activation manifest milestone.' : null;
  return null;
}

const v812 = readJsonIfPresent(V812_PATH);
const v813 = readJsonIfPresent(V813_PATH);
const inputCounties = Array.isArray(v813?.counties) ? v813.counties : (Array.isArray(v812?.counties) ? v812.counties : []);

const counties = inputCounties.map((county) => {
  const automatedActionsAvailable = [];
  const manualActionsRequired = [];
  const unknownActions = [];
  for (const gap of county.gaps || []) {
    const action = actionForGap(gap);
    if (action) automatedActionsAvailable.push({ gap: gap.category, action });
    else if ((gap.category || '').includes('unknown') || (gap.category || '').includes('manual')) unknownActions.push({ gap: gap.category, action: gap.action || 'Manual classification required.' });
    else manualActionsRequired.push({ gap: gap.category, action: gap.action || 'Manual work required by current evidence.' });
  }
  return {
    county: county.county,
    countySlug: county.countySlug,
    geoid: county.geoid || null,
    currentGaps: (county.gaps || []).map((gap) => ({ category: gap.category, evidence: gap.evidence || null })),
    automatedActionsAvailable,
    manualActionsRequired,
    unknownActions,
    safeForBulkAutomation: automatedActionsAvailable.length > 0 && manualActionsRequired.length === 0 && unknownActions.length === 0,
    safeToActivate: false
  };
});

function countClassification(classification) {
  return capabilities.filter((capability) => capability.classification === classification).length;
}

const output = {
  milestone: 'V814',
  title: 'County Automation Capability Audit',
  mission: 'Know Before You Go — Awareness Platform First, Route Intelligence Second',
  scope: 'Read-only automation capability audit; no county preparation, activation, runtime behavior changes, or protected-system changes.',
  nonGoals: ['Do not prepare counties.', 'Do not activate counties.', 'Do not modify runtime behavior.', 'Do not modify protected systems.', 'Do not modify Awareness, Reporting, Route Watch, Alerts, Crossings, Supabase synchronization, Community Intelligence, or user-facing UI.'],
  generatedAt: new Date().toISOString(),
  inputs: { v812Path: V812_PATH, v812Read: Boolean(v812), v813Path: V813_PATH, v813Read: Boolean(v813) },
  inspectedPaths: INSPECTED_PATHS.map(pathSummary),
  availableTools: toolInventory,
  capabilities,
  counties,
  supportedCountyCount: counties.length + OPERATIONAL_COUNTIES.length,
  operationalCountyCount: OPERATIONAL_COUNTIES.length,
  blockedCountyCount: counties.length,
  automatedCapabilityCount: countClassification('AUTOMATED'),
  partialCapabilityCount: countClassification('PARTIALLY_AUTOMATED'),
  manualCapabilityCount: countClassification('MANUAL_REQUIRED'),
  unavailableCapabilityCount: countClassification('UNAVAILABLE'),
  countiesSafeForBulkAutomation: counties.filter((county) => county.safeForBulkAutomation).length,
  countiesRequiringManualWork: counties.filter((county) => !county.safeForBulkAutomation).length,
  overallDetermination: 'AUTOMATION_CAPABILITY_AUDIT_COMPLETE'
};

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);

const report = `# GRIDLY COUNTY AUTOMATION CAPABILITY AUDIT V814

## Mission

Know Before You Go. Awareness Platform First. Route Intelligence Second.

## Scope

V814 is a read-only audit/planning milestone. It inventories source-data locations, build-tool locations, prior V812/V813 county gaps, and classifies what appears automatable before any bulk county preparation is attempted.

## Non-goals

${output.nonGoals.map((item) => `- ${item}`).join('\n')}

## Summary

- Overall determination: **${output.overallDetermination}**.
- Supported county count: **${output.supportedCountyCount}**.
- Operational county count: **${output.operationalCountyCount}**.
- Blocked county count: **${output.blockedCountyCount}**.
- Automated capability count: **${output.automatedCapabilityCount}**.
- Partial capability count: **${output.partialCapabilityCount}**.
- Manual capability count: **${output.manualCapabilityCount}**.
- Unavailable capability count: **${output.unavailableCapabilityCount}**.
- Counties safe for bulk automation: **${output.countiesSafeForBulkAutomation}**.
- Counties requiring manual work: **${output.countiesRequiringManualWork}**.

## Available Tools

| Tool | Present | Purpose |
| --- | --- | --- |
${toolInventory.map((tool) => `| \`${tool.path}\` | \`${tool.present}\` | ${tool.purpose} |`).join('\n')}

## Available Source Assets

| Path | Present | Type | File count | Sample files |
| --- | --- | --- | ---: | --- |
${output.inspectedPaths.map((asset) => `| \`${asset.path}\` | \`${asset.present}\` | \`${asset.type}\` | ${asset.fileCount} | ${asset.sampleFiles.map((f) => `\`${f}\``).join('<br>') || 'None'} |`).join('\n')}

## Capability Classification

| Capability | Classification | Evidence |
| --- | --- | --- |
${capabilities.map((capability) => `| ${capability.label} | \`${capability.classification}\` | ${capability.evidence.join('<br>')} |`).join('\n')}

## County-by-county Automation Plan

| County | Current gaps | Automated actions available | Manual actions required | Unknown actions | Safe for bulk automation | Safe to activate |
| --- | --- | --- | --- | --- | --- | --- |
${counties.map((county) => `| ${county.county} | ${county.currentGaps.map((gap) => `\`${gap.category}\``).join('<br>') || 'None'} | ${county.automatedActionsAvailable.map((item) => `${item.gap}: ${item.action}`).join('<br>') || 'None'} | ${county.manualActionsRequired.map((item) => `${item.gap}: ${item.action}`).join('<br>') || 'None'} | ${county.unknownActions.map((item) => `${item.gap}: ${item.action}`).join('<br>') || 'None'} | \`${county.safeForBulkAutomation}\` | \`${county.safeToActivate}\` |`).join('\n')}

## What Can Be Bulk Automated

- Inventorying source-data, package directories, manifests, and prior readiness outputs.
- Planning canonical boundary, runtime-boundary, road/community, crossing, and manifest work where existing assets or tool evidence is present.
- Producing non-activation county-by-county action plans with \`safeToActivate: false\`.

## What Must Remain Manual

- Activation decisions and any runtime behavior change.
- Final validation of crossing package derivation because no dedicated crossing package builder is present in the audited tool path.
- Any county whose gaps cannot be mapped to existing source assets or build tooling.

## Recommendation for the Next Executor Milestone

Proceed with a separate, explicitly authorized bulk-preparation dry-run milestone that consumes this V814 audit and only performs non-runtime, non-activation artifact preparation for counties marked safe for bulk automation. Keep all activation flags false and require manual review for crossing-package derivation and any unavailable tooling path.
`;

writeFileSync(REPORT_PATH, report);
console.log(`Wrote ${OUTPUT_PATH}`);
console.log(`Wrote ${REPORT_PATH}`);
console.log(`Overall determination: ${output.overallDetermination}`);
