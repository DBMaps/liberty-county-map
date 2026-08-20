import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INPUT = 'reports/statewide-audit/gridly-statewide-audit-export.json';
const OUTPUT = 'reports/statewide-audit/gridly-statewide-audit-reconciliation.json';

export const EXPECTED = Object.freeze({
  counties: 254,
  canonicalCommunities: 1859,
  memberships: 2058,
  multiCountyCommunities: 163,
});

const REPOSITORY_FIELDS = Object.freeze({
  contextStatus: 'PASS',
  driveTexasRepositoryContract: 'PASS',
  driveTexasSourceHealthContract: 'SOURCE_STATUS_ENVELOPE_GOVERNED',
  officialRoadwayContract: 'GOVERNED_DRIVETEXAS_CONSUMER_PRESENTATION',
  alertsPublicationContract: 'GOVERNED_ACTIVE_GEOGRAPHIC_DEDUPLICATED_PRESENTATION',
  alertsActiveRowsContract: 'ACTIVE_ROWS_ONLY_CLEARED_EXCLUDED',
  alertsPresentationContract: 'SOURCE_OWNERSHIP_AND_CLASSIFICATION_GOVERNED',
  showOnMapContract: 'GOVERNED_PRESENTATION_RECORD_PUBLICATION',
});

const LIVE_CLASSES = Object.freeze([
  ['DRIVETEXAS_LIVE_BROWSER_REQUIRED', 'driveTexasLiveRequired'],
  ['OFFICIAL_ROADWAY_LIVE_BROWSER_REQUIRED', 'officialRoadwayLiveRequired'],
  ['ALERTS_LIVE_BROWSER_REQUIRED', 'alertsLiveRequired'],
  ['RAIL_LIVE_BROWSER_REQUIRED', 'railLiveRequired'],
  ['SHOW_ON_MAP_LIVE_BROWSER_REQUIRED', null],
  ['STALE_OWNERSHIP_LIVE_BROWSER_REQUIRED', 'staleOwnershipContract'],
]);

function sameDenominators(value) {
  return Object.entries(EXPECTED).every(([key, expected]) => value?.[key] === expected);
}

export function reconcile(exportData) {
  if (!sameDenominators(exportData.expectedDenominators) ||
      !sameDenominators(exportData.actualDenominators) ||
      exportData.rows?.length !== EXPECTED.canonicalCommunities) {
    throw new Error('Certified statewide denominators are not exact');
  }

  const membershipCount = exportData.rows.reduce((n, row) => n + row.governedMemberships.length, 0);
  const multiCountyCount = exportData.rows.filter((row) => row.multiCounty).length;
  const countyFips = new Set(exportData.rows.flatMap((row) => row.governedMemberships));
  if (membershipCount !== EXPECTED.memberships || multiCountyCount !== EXPECTED.multiCountyCommunities || countyFips.size !== EXPECTED.counties) {
    throw new Error('Row identities do not conserve certified memberships/counties');
  }

  const contradictions = [];
  const evidenceGaps = [];
  const repositoryCertified = [];
  const expectedEmpty = [];
  const liveCounts = new Map(LIVE_CLASSES.map(([name]) => [name, { communities: new Set(), counties: new Set() }]));

  for (const row of exportData.rows) {
    const identity = { canonicalKey: row.canonicalKey, governedMemberships: row.governedMemberships };
    const badRepositoryFields = Object.entries(REPOSITORY_FIELDS)
      .filter(([field, expected]) => row[field] !== expected)
      .map(([field, expected]) => ({ field, expected, actual: row[field] ?? null }));
    if (badRepositoryFields.length) contradictions.push({ ...identity, fields: badRepositoryFields });
    else repositoryCertified.push(row.canonicalKey);

    for (const [dimension, value] of [['roadway', row.roadwayStatus], ['rail', row.railRepositoryContract]]) {
      if (value?.endsWith('EXPECTED_EMPTY')) expectedEmpty.push({ ...identity, dimension });
      else if (!value) evidenceGaps.push({ ...identity, dimension, reason: 'AUTHORITATIVE_EXPORT_VALUE_ABSENT' });
    }

    for (const [name, field] of LIVE_CLASSES) {
      const declared = row.riskFlags?.includes(name) && (field === null || row[field] === 'LIVE_BROWSER_REQUIRED');
      if (!declared) continue;
      liveCounts.get(name).communities.add(row.canonicalKey);
      row.governedMemberships.forEach((fips) => liveCounts.get(name).counties.add(fips));
    }
  }

  const systemicClasses = [...liveCounts].map(([classId, affected]) => ({
    classId,
    classification: 'LIVE_BROWSER_REQUIRED',
    affectedCanonicalCommunities: affected.communities.size,
    affectedCounties: affected.counties.size,
    productionContradiction: false,
    repairAuthorized: false,
  }));

  return {
    schemaVersion: 'gridly.statewide-audit-reconciliation.v1',
    mode: 'AUDIT_ONLY_NO_PRODUCTION_REPAIR',
    authority: { primaryExport: INPUT, excelWorkbookUsed: false },
    denominators: { ...EXPECTED, status: 'PASS' },
    classificationSummary: {
      repositoryCertifiedCommunities: repositoryCertified.length,
      expectedEmptyConditions: expectedEmpty.length,
      roadwayExpectedEmpty: expectedEmpty.filter((x) => x.dimension === 'roadway').length,
      railExpectedEmpty: expectedEmpty.filter((x) => x.dimension === 'rail').length,
      evidenceGapConditions: evidenceGaps.length,
      liveBrowserRequiredCommunities: new Set(systemicClasses.flatMap((x) =>
        x.affectedCanonicalCommunities ? exportData.rows.map((r) => r.canonicalKey) : [])).size,
      productionContradictions: contradictions.length,
      systemicUnresolvedClasses: systemicClasses.filter((x) => x.affectedCanonicalCommunities > 1).length,
    },
    findings: {
      repositoryCertifiedCanonicalKeys: repositoryCertified,
      expectedEmpty,
      evidenceGaps,
      productionContradictions: contradictions,
      systemicClasses,
    },
    conclusion: contradictions.length
      ? 'PRODUCTION_REPAIR_CANDIDATES_REQUIRE_CLASS_PROOF'
      : 'NO_PRODUCTION_CONTRADICTION_PROVEN',
  };
}

export function build(root = ROOT) {
  const source = JSON.parse(fs.readFileSync(path.join(root, INPUT), 'utf8'));
  const result = reconcile(source);
  const lp214Community = JSON.parse(fs.readFileSync(path.join(root, 'data/generated/lp214-county-community-inventory.json'), 'utf8'));
  const lp214DriveTexas = JSON.parse(fs.readFileSync(path.join(root, 'data/generated/lp214-drivetexas-statewide-community-certification.json'), 'utf8'));
  const lp215 = JSON.parse(fs.readFileSync(path.join(root, 'reports/lp215/statewide-consumer-wiring-certification.json'), 'utf8'));
  const csvLines = fs.readFileSync(path.join(root, 'reports/statewide-audit/gridly-statewide-audit-export.csv'), 'utf8').trimEnd().split('\n').length;
  const countyCsvLines = fs.readFileSync(path.join(root, 'reports/statewide-audit/gridly-county-audit-summary.csv'), 'utf8').trimEnd().split('\n').length;
  result.authority.crossChecks = {
    statewideCsvDataRows: csvLines - 1,
    countyCsvDataRows: countyCsvLines - 1,
    lp214CanonicalCommunities: lp214Community.summary.uniqueCanonicalCommunityCount,
    lp214GovernedMemberships: lp214Community.summary.countyCommunityMembershipCount,
    lp214MultiCountyCommunities: lp214Community.summary.multiCountyCommunityCount,
    lp214DriveTexasCommunities: lp214DriveTexas.summary.communityCount,
    lp215CountiesEvaluated: lp215.summary.countiesEvaluated,
    lp215ProductionPatchApplied: lp215.productionPatchApplied,
    status: 'PASS',
  };
  const values = result.authority.crossChecks;
  if (values.statewideCsvDataRows !== EXPECTED.canonicalCommunities || values.countyCsvDataRows !== EXPECTED.counties ||
      values.lp214CanonicalCommunities !== EXPECTED.canonicalCommunities || values.lp214GovernedMemberships !== EXPECTED.memberships ||
      values.lp214MultiCountyCommunities !== EXPECTED.multiCountyCommunities || values.lp214DriveTexasCommunities !== EXPECTED.canonicalCommunities ||
      values.lp215CountiesEvaluated !== EXPECTED.counties || values.lp215ProductionPatchApplied !== false) {
    throw new Error('Underlying repository evidence does not reconcile with the certified export');
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = build();
  const outputPath = path.join(ROOT, OUTPUT);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`wrote ${path.relative(ROOT, outputPath)}`);
  } else {
    const existing = fs.readFileSync(outputPath, 'utf8');
    if (existing !== `${JSON.stringify(result, null, 2)}\n`) throw new Error(`${OUTPUT} is stale; run with --write`);
    console.log(`verified ${OUTPUT}`);
  }
}
