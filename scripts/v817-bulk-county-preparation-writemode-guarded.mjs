import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const INPUTS = {
  v816: 'assets/county-implementation/bulk-county-preparation-whatif-v816.json',
  v815: 'assets/county-implementation/bulk-county-preparation-plan-v815.json',
  v814: 'assets/county-implementation/county-automation-capability-audit-v814.json'
};
const OUTPUT_PATH = 'assets/county-implementation/bulk-county-preparation-writemode-v817.json';
const REPORT_PATH = 'GRIDLY-BULK-COUNTY-PREPARATION-WRITEMODE-V817.md';
const args = new Set(process.argv.slice(2));
const jsonMode = args.has('--json');
const applyMode = args.has('--apply');
const whatIfMode = args.has('--whatif');
const mode = applyMode ? 'APPLY_GUARDED_WRITE_MODE_NO_ACTIVATION' : whatIfMode ? 'WHATIF_NO_ARTIFACT_WRITE_NO_COUNTY_PREPARATION' : 'DRY_RUN_ARTIFACT_WRITE_NO_COUNTY_PREPARATION';

const protectedPatterns = [
  /^js\/app\.js$/,
  /^js\/gridlyPackageRegistry\.js$/,
  /^assets\/package-registry\//,
  /(^|\/)runtime-assets\//,
  /supabase/i,
  /(^|\/)(ui|components|pages|styles|css)\//i,
  /protected-system/i,
  /awareness/i,
  /reporting/i,
  /route-watch/i,
  /alerts/i,
  /community-intelligence/i
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}
function normalize(filePath) { return filePath.replaceAll('\\', '/').replace(/^\.\//, ''); }
function isProtected(filePath) { const p = normalize(filePath); return protectedPatterns.some((pattern) => pattern.test(p)); }
function canonicalBoundaryPath(slug) { return `assets/county-implementation/${slug}/boundary/${slug}-county-boundary.geojson`; }
function boundaryDir(slug) { return `assets/county-implementation/${slug}/boundary`; }
function sourceBoundaryPath(slug) { return `Gridly-Source-Data/Census/${slug}-county-2025-wgs84.geojson`; }
function sameBytes(a, b) { return existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b)); }

const loaded = Object.fromEntries(Object.entries(INPUTS).map(([key, filePath]) => [key, { path: filePath, read: existsSync(filePath), data: existsSync(filePath) ? readJson(filePath) : null }]));
if (!loaded.v816.data || !loaded.v815.data || !loaded.v814.data) throw new Error('V817 requires V816, V815, and V814 input artifacts.');
const v816 = loaded.v816.data;
const counties = v816.counties || [];

const guardrailViolations = [];
for (const county of counties) {
  if (county.safeToActivate === true) guardrailViolations.push({ county: county.countySlug, target: null, reason: 'safeToActivate true is forbidden in V817.' });
}

const countyResults = counties.map((county) => {
  const slug = county.countySlug;
  const targetDir = boundaryDir(slug);
  const targetFile = canonicalBoundaryPath(slug);
  const sourceFile = sourceBoundaryPath(slug);
  const plannedAction = (county.plannedActions || []).find((action) => action.gap === 'missing_boundary_source');
  const expectedByV816 = (county.expectedFilesToCreate || []).includes(targetFile);
  const hasSource = existsSync(sourceFile);
  const hasTargetDir = existsSync(targetDir);
  const hasTargetFile = existsSync(targetFile);
  const protectedTargets = [targetDir, targetFile].filter(isProtected);
  for (const target of protectedTargets) guardrailViolations.push({ county: slug, target, reason: 'Planned target matches protected-system guardrail.' });

  const actions = [];
  if (expectedByV816) {
    actions.push({ type: 'create_directory', classification: 'SAFE_FUTURE_WRITE_GUARDED_BOUNDARY_ONLY', target: targetDir, allowed: !isProtected(targetDir), status: hasTargetDir ? 'skipped_exists' : applyMode ? 'pending_create' : 'dry_run_create' });
    actions.push({ type: 'copy_boundary', classification: plannedAction?.classification || 'UNCLASSIFIED', source: sourceFile, target: targetFile, allowed: !isProtected(targetFile), status: hasTargetFile ? (hasSource && sameBytes(sourceFile, targetFile) ? 'skipped_unchanged_equivalent' : 'skipped_existing_not_modified') : hasSource ? applyMode ? 'pending_create' : 'dry_run_create' : 'skipped_missing_authoritative_source' });
  }
  return { county: county.county, countySlug: slug, safeToActivate: county.safeToActivate === true, sourceBoundary: sourceFile, canonicalBoundary: targetFile, v816BoundaryActionClassification: plannedAction?.classification || null, expectedByV816, actions };
});

const plannedTargets = countyResults.flatMap((c) => c.actions.map((a) => a.target));
for (const target of plannedTargets) if (isProtected(target)) guardrailViolations.push({ county: null, target, reason: 'Protected path planned.' });
const protectedSystemTouchCount = plannedTargets.filter(isProtected).length;

let filesCreated = 0, filesSkipped = 0, filesModified = 0, filesDeleted = 0, countiesPrepared = 0;
if (guardrailViolations.length === 0 && applyMode) {
  for (const county of countyResults) {
    let prepared = false;
    for (const action of county.actions) {
      if (!action.allowed) { action.status = 'blocked_guardrail'; filesSkipped++; continue; }
      if (action.type === 'create_directory') {
        if (existsSync(action.target)) { action.status = 'skipped_exists'; filesSkipped++; }
        else { mkdirSync(action.target, { recursive: true }); action.status = 'created'; filesCreated++; prepared = true; }
      } else if (action.type === 'copy_boundary') {
        if (!existsSync(action.source)) { action.status = 'skipped_missing_authoritative_source'; filesSkipped++; }
        else if (existsSync(action.target)) { action.status = sameBytes(action.source, action.target) ? 'skipped_unchanged_equivalent' : 'skipped_existing_not_modified'; filesSkipped++; }
        else { mkdirSync(path.dirname(action.target), { recursive: true }); copyFileSync(action.source, action.target); action.status = 'created'; filesCreated++; prepared = true; }
      }
    }
    if (prepared) countiesPrepared++;
  }
} else {
  filesSkipped = countyResults.reduce((sum, c) => sum + c.actions.length, 0);
}

const output = {
  milestone: 'V817',
  title: 'Bulk County Preparation WriteMode Guarded',
  generatedAt: new Date().toISOString(),
  mode,
  inputs: Object.fromEntries(Object.entries(loaded).map(([key, value]) => [key, { path: value.path, read: value.read }])),
  guardrails: {
    defaultDryRunNoWrites: !applyMode,
    noCountyActivation: true,
    runtimeRegistrationUnchanged: true,
    protectedSystemsUnchanged: protectedSystemTouchCount === 0,
    deleteOperationsForbidden: true,
    existingCanonicalRuntimeFilesNotModified: true
  },
  summary: {
    mode,
    countiesEvaluated: counties.length,
    countiesPrepared,
    filesCreated,
    filesSkipped,
    filesModified,
    filesDeleted,
    guardrailViolations: guardrailViolations.length,
    protectedSystemTouchCount,
    countiesActivated: 0,
    overallDetermination: guardrailViolations.length ? 'WRITEMODE_ABORTED_GUARDRAIL_VIOLATION' : applyMode ? 'GUARDED_PREPARATION_APPLIED_NO_ACTIVATION' : 'WRITEMODE_DRY_RUN_COMPLETE'
  },
  guardrailViolations,
  allowedWritePolicy: [
    'Create missing county boundary folders only under assets/county-implementation/<county>/boundary.',
    'Copy an existing authoritative WGS84 source boundary from Gridly-Source-Data/Census into the canonical boundary path only when the canonical file is missing.',
    'Never delete files and never modify protected systems or existing non-equivalent canonical boundary files.'
  ],
  counties: countyResults
};

function report() {
  const s = output.summary;
  return `# GRIDLY BULK COUNTY PREPARATION WRITEMODE V817\n\n## Quick Summary\n\nV817 is the first guarded write-mode milestone. It permits only boundary-folder creation and missing canonical boundary creation from existing authoritative WGS84 source files. It does not activate counties, register runtime packages, change runtime behavior, or touch protected systems.\n\n| Metric | Value |\n| --- | ---: |\n| Mode | \`${s.mode}\` |\n| Counties evaluated | ${s.countiesEvaluated} |\n| Counties prepared | ${s.countiesPrepared} |\n| Files created | ${s.filesCreated} |\n| Files skipped | ${s.filesSkipped} |\n| Files modified | ${s.filesModified} |\n| Files deleted | ${s.filesDeleted} |\n| Guardrail violations | ${s.guardrailViolations} |\n| Protected system touch count | ${s.protectedSystemTouchCount} |\n| Counties activated | ${s.countiesActivated} |\n| Overall determination | \`${s.overallDetermination}\` |\n\n## Guardrails\n\n- No county activation.\n- No runtime registration or package registry activation.\n- No \`js/app.js\` or \`js/gridlyPackageRegistry.js\` changes.\n- No \`assets/package-registry/\`, \`runtime-assets/\`, Supabase, UI, Awareness, Reporting, Route Watch, Alerts, or Community Intelligence changes.\n- No deletes.\n- Existing canonical runtime boundary files are skipped unless unchanged-equivalent.\n\n## County Results\n\n${output.counties.map((county) => `### ${county.county}\n\n- Slug: \`${county.countySlug}\`\n- Safe to activate: \`${county.safeToActivate}\`\n- Source boundary: \`${county.sourceBoundary}\`\n- Canonical boundary: \`${county.canonicalBoundary}\`\n- Actions:\n${county.actions.map((action) => `  - \`${action.type}\` → \`${action.target}\`: \`${action.status}\``).join('\n') || '  - None.'}`).join('\n\n')}\n\n## Merge Recommendation\n\nMerge V817 if validation confirms no protected systems changed and counties activated remains zero. Apply mode remains guarded and prepares only safe missing boundary assets when authoritative source files already exist.\n\n## Exact Validation Steps\n\n1. \`node scripts/v817-bulk-county-preparation-writemode-guarded.mjs --whatif --json\`\n2. \`node scripts/v817-bulk-county-preparation-writemode-guarded.mjs --json\`\n3. \`node scripts/v817-bulk-county-preparation-writemode-guarded.mjs --apply --json\`\n4. \`git diff -- js/app.js js/gridlyPackageRegistry.js assets/package-registry\`\n`;
}

if (!whatIfMode) {
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  writeFileSync(REPORT_PATH, report());
}

if (jsonMode) console.log(JSON.stringify(output, null, 2));
else console.log(`V817 ${output.summary.overallDetermination}. Counties evaluated: ${output.summary.countiesEvaluated}. Files created: ${output.summary.filesCreated}.`);

if (guardrailViolations.length) process.exitCode = 1;
