#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { countyRegistryRange } from '../../scripts/lp189-statewide-runtime-activation-guarded.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => JSON.parse(read(relative));

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter(value => seen.has(value) || !seen.add(value)))].sort();
}

export function certifyPlaceMemberships({ canonicalPlaces, countyRegistry, operationalRows = [], crossingPlaces = {}, roadwayCountyIds = [], weatherPlaceIds = [] }) {
  const countiesByFips = new Map();
  for (const [key, county] of Object.entries(countyRegistry || {})) {
    const fips = String(county?.countyFips || '');
    if (!countiesByFips.has(fips)) countiesByFips.set(fips, []);
    countiesByFips.get(fips).push({ id: String(county?.id || key), name: String(county?.name || '') });
  }
  const operationalByPlace = Map.groupBy(operationalRows, row => String(row?.placeGeoid || ''));
  const roadway = new Set(roadwayCountyIds.map(String));
  const weather = new Set(weatherPlaceIds.map(String));
  const rows = [...canonicalPlaces].sort((a, b) => String(a.placeGeoid).localeCompare(String(b.placeGeoid))).map(place => {
    const canonicalPlaceId = String(place?.placeGeoid || '') || null;
    const governed = Array.isArray(place?.countyMemberships) ? place.countyMemberships.map(String) : [];
    const duplicateCountyFips = duplicates(governed);
    const membershipCountyFips = [...new Set(governed)].sort();
    const resolved = membershipCountyFips.flatMap(fips => (countiesByFips.get(fips)?.length === 1 ? [{ fips, ...countiesByFips.get(fips)[0] }] : []));
    const unresolvedCountyFips = membershipCountyFips.filter(fips => countiesByFips.get(fips)?.length !== 1);
    const duplicateCountyIds = duplicates(resolved.map(entry => entry.id));
    const operational = operationalByPlace.get(canonicalPlaceId || '') || [];
    const operationalProjectionCountyIds = [...new Set(operational.flatMap(row => Array.isArray(row.countyMemberships) ? row.countyMemberships : []).map(String).flatMap(fips => countiesByFips.get(fips)?.length === 1 ? [countiesByFips.get(fips)[0].id] : []))].sort();
    const membershipCountyIds = resolved.map(entry => entry.id);
    const identityMismatch = !canonicalPlaceId || operational.some(row => String(row.displayName) !== String(place.displayName));
    const authorityAvailable = Boolean(canonicalPlaceId && Array.isArray(place?.countyMemberships));
    let membershipApplicability = membershipCountyFips.length === 1 ? 'SINGLE_COUNTY_CONTROL' : 'MULTI_COUNTY_CONVERGENCE';
    if (identityMismatch) membershipApplicability = 'REGISTRY_IDENTITY_MISMATCH';
    else if (!authorityAvailable || membershipCountyFips.length === 0) membershipApplicability = 'MEMBERSHIP_AUTHORITY_UNRESOLVED';
    else if (duplicateCountyFips.length || duplicateCountyIds.length) membershipApplicability = 'DUPLICATE_MEMBERSHIP';
    else if (unresolvedCountyFips.length) membershipApplicability = 'INVALID_MEMBERSHIP_MAPPING';
    const membershipAuthorityPass = Boolean(authorityAvailable && membershipCountyFips.length && !identityMismatch && !duplicateCountyFips.length && !duplicateCountyIds.length && !unresolvedCountyFips.length && resolved.length === membershipCountyFips.length);
    return {
      canonicalCommunity: String(place?.displayName || ''), canonicalPlaceId,
      membershipAuthorityAvailable: authorityAvailable,
      membershipAuthorityReason: authorityAvailable ? 'EXACT_CANONICAL_PLACE_REGISTRY_ROW_GOVERNED_COUNTY_FIPS' : 'AUTHORITATIVE_REGISTRY_ROW_OR_MEMBERSHIP_ARRAY_UNAVAILABLE',
      membershipApplicability, membershipCount: membershipCountyFips.length,
      membershipCountyFips, membershipCountyIds, membershipCountyNames: resolved.map(entry => entry.name),
      unresolvedCountyFips, duplicateCountyFips, duplicateCountyIds,
      operationalProjectionMembershipCount: operationalProjectionCountyIds.length,
      operationalProjectionCountyIds,
      operationalProjectionThinnerThanRegistry: operational.length > 0 && operationalProjectionCountyIds.length < membershipCountyIds.length,
      crossingCanonicalPlaceAvailable: Boolean(crossingPlaces[canonicalPlaceId]),
      officialRoadwayConsumerAvailable: membershipCountyIds.every(id => roadway.has(id)),
      weatherConsumerAvailable: weather.has(canonicalPlaceId),
      membershipAuthorityPass
    };
  });
  const failures = rows.filter(row => !row.membershipAuthorityPass).map(row => ({
    canonicalCommunity: row.canonicalCommunity, canonicalPlaceId: row.canonicalPlaceId,
    failureClass: row.membershipApplicability, authoritativeMembershipCount: row.membershipCount,
    unresolvedFips: row.unresolvedCountyFips, operationalProjectionMembershipCount: row.operationalProjectionMembershipCount,
    recommendedNextAction: 'Inspect the exact canonical PLACE row and runtime county FIPS registry; do not substitute operational consumer data.'
  }));
  const summary = {
    canonicalPlaceCount: rows.length,
    singleCountyPlaceCount: rows.filter(row => row.membershipApplicability === 'SINGLE_COUNTY_CONTROL').length,
    multiCountyPlaceCount: rows.filter(row => row.membershipApplicability === 'MULTI_COUNTY_CONVERGENCE').length,
    totalMembershipCount: rows.reduce((sum, row) => sum + row.membershipCount, 0),
    zeroMembershipPlaceCount: rows.filter(row => row.membershipCount === 0).length,
    unresolvedCountyFipsCount: rows.reduce((sum, row) => sum + row.unresolvedCountyFips.length, 0),
    duplicateMembershipPlaceCount: rows.filter(row => row.duplicateCountyFips.length || row.duplicateCountyIds.length).length,
    invalidRuntimeCountyMappingCount: rows.filter(row => row.unresolvedCountyFips.length || row.duplicateCountyIds.length).length,
    operationalProjectionThinnerPlaceCount: rows.filter(row => row.operationalProjectionThinnerThanRegistry).length,
    membershipAuthorityPassCount: rows.filter(row => row.membershipAuthorityPass).length,
    membershipAuthorityFailCount: failures.length,
    overallPass: rows.length > 0 && failures.length === 0
  };
  return { rows, failures, summary };
}

function loadInputs() {
  const app = read('js/app.js');
  const range = countyRegistryRange(app);
  const sandbox = { Object };
  vm.createContext(sandbox);
  vm.runInContext(`${app.slice(0, range.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, sandbox);
  const canonical = json('data/generated/gridly-statewide-consumer-community-projection-v1.json');
  const runtimeCounties = json('data/lp149/runtime-county-registry.json');
  const crossings = json('data/runtime/canonical-crossing-memberships-v1.json');
  const presentation = json('data/generated/gridly-statewide-place-presentation-v1.json');
  const roadways = json('data/roadway-runtime-manifest.json');
  return {
    canonicalPlaces: canonical.communities,
    countyRegistry: Object.fromEntries(runtimeCounties.identities.map(county => [county.countyId, { id: county.countyId, name: county.countyName, countyFips: county.fips }])),
    operationalRows: Object.values(sandbox.registry).flatMap(county => county.consumerAwarenessAreas || []),
    crossingPlaces: crossings.places, roadwayCountyIds: Object.keys(roadways.counties || {}),
    weatherPlaceIds: Object.keys(presentation.places || {})
  };
}

function csvCell(value) { const text = Array.isArray(value) ? value.join('|') : String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function renderCsv(rows) { const fields = Object.keys(rows[0] || {}); return `${fields.join(',')}\n${rows.map(row => fields.map(field => csvCell(row[field])).join(',')).join('\n')}\n`; }
function renderMarkdown(result) {
  const s = result.summary;
  return `# LP239.2 Statewide Canonical PLACE Membership Certification\n\nGenerated deterministically from the exact statewide canonical PLACE projection and governed county FIPS authority. No registry data was modified.\n\n## Summary\n\n| Metric | Total |\n|---|---:|\n${Object.entries(s).map(([key, value]) => `| ${key} | ${value} |`).join('\n')}\n\n## Failure ledger\n\n${result.failures.length ? result.failures.map(row => `- ${row.canonicalCommunity} (${row.canonicalPlaceId}): ${row.failureClass}`).join('\n') : 'Empty — every authoritative membership row passed.'}\n`;
}

export function buildCertification() { return certifyPlaceMemberships(loadInputs()); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildCertification();
  const dir = path.join(root, 'reports/lp239-statewide');
  const outputs = new Map([
    ['statewide-place-membership-certification.json', `${JSON.stringify({ schemaVersion: 'gridly.lp239.2.statewide-place-membership-certification.v1', generatedAt: '1970-01-01T00:00:00.000Z', ...result }, null, 2)}\n`],
    ['statewide-place-membership-certification.csv', renderCsv(result.rows)],
    ['README.md', renderMarkdown(result)],
    ['failure-ledger.json', `${JSON.stringify(result.failures, null, 2)}\n`]
  ]);
  if (process.argv.includes('--write')) { fs.mkdirSync(dir, { recursive: true }); for (const [name, value] of outputs) fs.writeFileSync(path.join(dir, name), value); }
  else { for (const [name, value] of outputs) if (!fs.existsSync(path.join(dir, name)) || fs.readFileSync(path.join(dir, name), 'utf8') !== value) throw new Error(`LP239.2 artifact missing or stale: ${name}`); }
  if (!result.summary.overallPass) throw new Error(`LP239.2 authoritative registry certification failed for ${result.failures.length} PLACE(s); stop before registry edits`);
  console.log(`LP239.2 ${process.argv.includes('--write') ? 'build' : 'verify'} PASS: ${result.summary.canonicalPlaceCount} PLACEs, ${result.summary.totalMembershipCount} memberships, ${result.summary.operationalProjectionThinnerPlaceCount} thinner operational projections`);
}
