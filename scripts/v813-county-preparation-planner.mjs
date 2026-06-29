import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const V811_PATH = 'assets/county-implementation/county-expansion-framework-v811.json';
const V812_PATH = 'assets/county-implementation/county-readiness-gap-resolver-v812.json';
const OUTPUT_PATH = 'assets/county-implementation/county-preparation-planner-v813.json';
const REPORT_PATH = 'GRIDLY-COUNTY-PREPARATION-PLANNER-V813.md';

const TIER_1 = 'TIER_1_LOW_EFFORT';
const TIER_2 = 'TIER_2_STANDARD_PREP';
const TIER_3 = 'TIER_3_DATA_GAP';
const TIER_4 = 'TIER_4_MANUAL_REVIEW';

function readJsonIfPresent(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function hasGap(county, category) {
  return county.gaps.some((gap) => gap.category === category);
}

function availability(county) {
  return {
    boundarySourceAvailable: !hasGap(county, 'missing_boundary_source'),
    crossingPackageAvailable: !hasGap(county, 'missing_crossings_package'),
    registryAvailable: !hasGap(county, 'missing_package_registry_entry'),
    roadsPackageAvailable: !hasGap(county, 'missing_roads_package'),
    canonicalPathConsistent: !hasGap(county, 'inconsistent_canonical_path'),
    manualReviewRequired: county.gaps.some((gap) => gap.category === 'unknown_manual_review_required' || gap.category.includes('manual_review'))
  };
}

function preparationTier(county, flags) {
  if (flags.manualReviewRequired) return TIER_4;
  const gapCount = county.gaps.length;
  const primaryAssetsAvailable = flags.boundarySourceAvailable && flags.crossingPackageAvailable && flags.roadsPackageAvailable && flags.registryAvailable && flags.canonicalPathConsistent;
  if (gapCount <= 2 && primaryAssetsAvailable) return TIER_1;
  if (gapCount <= 3 && flags.crossingPackageAvailable && flags.roadsPackageAvailable && flags.registryAvailable && flags.canonicalPathConsistent) return TIER_2;
  if (!flags.boundarySourceAvailable || !flags.crossingPackageAvailable || !flags.roadsPackageAvailable || !flags.registryAvailable || !flags.canonicalPathConsistent) return TIER_3;
  return TIER_2;
}

const TIER_WEIGHT = Object.freeze({ [TIER_1]: 0, [TIER_2]: 100, [TIER_3]: 200, [TIER_4]: 300 });

function priorityScore(county, tier, flags) {
  let score = TIER_WEIGHT[tier] + county.gaps.length * 10;
  if (!flags.boundarySourceAvailable) score += 4;
  if (!flags.crossingPackageAvailable) score += 3;
  if (!flags.roadsPackageAvailable) score += 3;
  if (!flags.registryAvailable) score += 2;
  if (!flags.canonicalPathConsistent) score += 5;
  if (flags.manualReviewRequired) score += 50;
  return score;
}

function recommendedNextAction(county, flags) {
  if (flags.manualReviewRequired) return 'Perform manual V811/V812 classification review before any preparation work; do not activate the county.';
  if (!flags.boundarySourceAvailable) return `Acquire and validate the canonical V809/V810 boundary source for ${county.county} before runtime registration or activation work.`;
  if (!flags.crossingPackageAvailable) return `Acquire, filter, and validate the canonical crossing package for ${county.county}.`;
  if (!flags.roadsPackageAvailable) return `Prepare the canonical roads package for ${county.county}.`;
  if (!flags.registryAvailable) return `Prepare missing package registry entries for ${county.county} without activation.`;
  if (!flags.canonicalPathConsistent) return `Correct canonical county-scoped asset paths for ${county.county}.`;
  return `Stage non-operational preparation review for ${county.county}; keep safeToActivate false.`;
}

const v811 = readJsonIfPresent(V811_PATH);
const v812 = readJsonIfPresent(V812_PATH);
if (!v812 || !Array.isArray(v812.counties)) {
  throw new Error(`V813 requires ${V812_PATH} with a counties array.`);
}

const blocked = v812.counties
  .filter((county) => (county.currentPromotionStatus || '').toUpperCase() === 'BLOCKED')
  .map((county) => {
    const flags = availability(county);
    const tier = preparationTier(county, flags);
    return {
      county: county.county,
      countySlug: county.countySlug,
      geoid: county.geoid || null,
      currentPromotionStatus: county.currentPromotionStatus,
      preparationTier: tier,
      priorityRank: 0,
      priorityScore: priorityScore(county, tier, flags),
      gapCount: county.gaps.length,
      availability: flags,
      gaps: county.gaps,
      requiredActions: county.requiredActions,
      recommendedNextAction: recommendedNextAction(county, flags),
      safeToPrepare: Boolean(county.safeToPrepare) && !flags.manualReviewRequired,
      safeToActivate: false
    };
  })
  .sort((a, b) => a.priorityScore - b.priorityScore || a.countySlug.localeCompare(b.countySlug))
  .map((county, index) => ({ ...county, priorityRank: index + 1 }));

function countTier(tier) {
  return blocked.filter((county) => county.preparationTier === tier).length;
}

const output = {
  milestone: 'V813',
  title: 'County Preparation Planner',
  mission: 'Know Before You Go — Awareness Platform First, Route Intelligence Second',
  scope: 'Read-only county preparation planning; no activation and no runtime behavior changes.',
  inputs: {
    v811FrameworkPath: V811_PATH,
    v811FrameworkRead: Boolean(v811),
    v812ResolverPath: V812_PATH,
    v812ResolverRead: true
  },
  protectedSystemsUnchanged: true,
  operationalCountiesUnchanged: ['Liberty', 'Montgomery', 'San Jacinto', 'Chambers', 'Jefferson'],
  blockedCountyCount: blocked.length,
  tier1Count: countTier(TIER_1),
  tier2Count: countTier(TIER_2),
  tier3Count: countTier(TIER_3),
  tier4Count: countTier(TIER_4),
  countiesSafeToPrepare: blocked.filter((county) => county.safeToPrepare).length,
  countiesSafeToActivate: blocked.filter((county) => county.safeToActivate).length,
  topRecommendedCounty: blocked[0]?.county || null,
  overallDetermination: 'PREPARATION_PLAN_READY',
  counties: blocked.map(({ priorityScore, gapCount, availability: flags, ...county }) => county)
};

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);

const tierDefinitions = [
  [TIER_1, 'Lowest-effort preparation candidate: primary data packages are available, canonical paths are consistent, and only minor non-activation preparation remains.'],
  [TIER_2, 'Standard preparation candidate: registry, roads, and crossings evidence are available, but canonical boundary/runtime preparation still blocks activation.'],
  [TIER_3, 'Data-gap candidate: one or more primary data packages or canonical-path prerequisites are missing and must be prepared before runtime work.'],
  [TIER_4, 'Manual-review candidate: V812 found an unknown or manual-review gap; deterministic preparation must pause until classification is resolved.']
];

const report = `# GRIDLY COUNTY PREPARATION PLANNER V813

## Mission

Know Before You Go. Awareness Platform First. Route Intelligence Second.

## Scope

V813 is a read-only planning milestone. It reads the V811 county expansion framework when present and the V812 readiness gap resolver, then produces a deterministic preparation order for counties that remain BLOCKED.

## Non-goals

- Do not activate new counties.
- Do not modify runtime behavior.
- Do not modify protected systems.
- Do not modify Awareness, Reporting, Route Watch, Alerts, Crossings, Supabase synchronization, Community Intelligence, or user-facing UI.

## Summary

- Overall determination: **${output.overallDetermination}**.
- Blocked county count: **${output.blockedCountyCount}**.
- Tier 1 count: **${output.tier1Count}**.
- Tier 2 count: **${output.tier2Count}**.
- Tier 3 count: **${output.tier3Count}**.
- Tier 4 count: **${output.tier4Count}**.
- Counties safe to prepare: **${output.countiesSafeToPrepare}**.
- Counties safe to activate: **${output.countiesSafeToActivate}**.
- Top recommended county: **${output.topRecommendedCounty || 'None'}**.

## Preparation Tier Definitions

| Tier | Definition |
| --- | --- |
${tierDefinitions.map(([tier, definition]) => `| \`${tier}\` | ${definition} |`).join('\n')}

## Recommended County Preparation Order

| Rank | County | Tier | Safe to prepare | Safe to activate | Recommended next action |
| ---: | --- | --- | --- | --- | --- |
${output.counties.map((county) => `| ${county.priorityRank} | ${county.county} | \`${county.preparationTier}\` | \`${county.safeToPrepare}\` | \`${county.safeToActivate}\` | ${county.recommendedNextAction} |`).join('\n')}

## County-by-county Preparation Plan

${output.counties.map((county) => `### ${county.priorityRank}. ${county.county}

- County slug: \`${county.countySlug}\`
- GEOID: \`${county.geoid || 'unknown'}\`
- Current promotion status: \`${county.currentPromotionStatus}\`
- Preparation tier: \`${county.preparationTier}\`
- Safe to prepare: \`${county.safeToPrepare}\`
- Safe to activate: \`${county.safeToActivate}\`
- Recommended next action: ${county.recommendedNextAction}
- Gaps:
${county.gaps.map((gap) => `  - \`${gap.category}\`: ${gap.evidence}`).join('\n')}
- Required actions:
${county.requiredActions.map((action) => `  - ${action}`).join('\n')}`).join('\n\n')}

## Activation and Operational Confirmation

No counties were activated by V813. Every blocked county in the planner keeps \`safeToActivate: false\`. Operational counties remain unchanged: Liberty, Montgomery, San Jacinto, Chambers, and Jefferson.
`;

writeFileSync(REPORT_PATH, report);
console.log(`Wrote ${OUTPUT_PATH}`);
console.log(`Wrote ${REPORT_PATH}`);
console.log(`Blocked counties: ${output.blockedCountyCount}`);
console.log(`Overall determination: ${output.overallDetermination}`);
