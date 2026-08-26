#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { canonicalizeCsvNewlines, lp239ArtifactMatches } from './csv-artifact-newlines.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => JSON.parse(read(relative));

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter(value => seen.has(value) || !seen.add(value)))].sort();
}

export function certifyCrossingAuthority({ canonicalPlaces, resolveRecords, resolveCountyFips }) {
  const rows = [...canonicalPlaces].sort((a, b) => String(a.placeGeoid).localeCompare(String(b.placeGeoid))).map(place => {
    const canonicalPlaceId = String(place?.placeGeoid || '') || null;
    const canonicalCommunity = String(place?.displayName || '');
    const governedFips = [...new Set((place?.countyMemberships || []).map(String))].sort();
    const membershipCountyIds = governedFips.map(fips => resolveCountyFips(fips)?.countyId).filter(Boolean).sort();
    // Intentionally supply only canonical identity. A selected-area projection is
    // operational state and is not an admissible substitute for this join.
    const resolution = canonicalPlaceId ? resolveRecords({ placeGeoid: canonicalPlaceId }) : null;
    const membership = resolution?.membership || null;
    const identities = Array.isArray(membership?.crossingIds) ? membership.crossingIds.map(String) : [];
    const records = Array.isArray(resolution?.records) ? resolution.records : [];
    const recordIds = new Set(records.map(record => String(record?.crossingId || record?.id || '')).filter(Boolean));
    const unresolvedCrossingIds = [...new Set(identities.filter(id => !recordIds.has(id)))].sort();
    const duplicateCrossingIds = duplicates(identities);
    const crossingFips = [...new Set((membership?.governedCountyFips || []).map(String))].sort();
    const crossingCountyIds = crossingFips.map(fips => resolveCountyFips(fips)?.countyId).filter(Boolean).sort();
    const unexpectedCrossingCountyIds = crossingCountyIds.filter(id => !membershipCountyIds.includes(id));
    const missingCrossingMemberships = membershipCountyIds.filter(id => !crossingCountyIds.includes(id));
    const identityMismatch = Boolean(membership && (String(membership.placeGeoid || '') !== canonicalPlaceId || String(membership.canonicalCommunity || '') !== canonicalCommunity));
    const crossingAuthorityAvailable = Boolean(resolution && resolution.authorityAvailable !== false);
    const crossingIdentityParityPass = Boolean(canonicalPlaceId && membership && !identityMismatch && !unresolvedCrossingIds.length && !duplicateCrossingIds.length && identities.length === records.length);
    const crossingMembershipParityPass = Boolean(membershipCountyIds.length && crossingCountyIds.length && !unexpectedCrossingCountyIds.length && !missingCrossingMemberships.length);
    const crossingAuthorityPass = Boolean(crossingAuthorityAvailable && crossingIdentityParityPass && crossingMembershipParityPass);
    const crossingAuthorityState = !crossingAuthorityAvailable ? 'UNAVAILABLE' : identities.length ? 'AVAILABLE_NONEMPTY' : 'AVAILABLE_EMPTY';
    const crossingAuthorityReason = crossingAuthorityAvailable ? null : (!canonicalPlaceId ? 'CANONICAL_PLACE_UNRESOLVED' : resolution?.reason || 'CANONICAL_CROSSING_AUTHORITY_UNAVAILABLE');
    return { canonicalCommunity, canonicalPlaceId, membershipCountyIds, membershipCount: membershipCountyIds.length,
      crossingAuthorityAvailable, crossingAuthorityReason, canonicalCrossingIdentityCount: identities.length,
      resolvedCrossingRecordCount: records.length, crossingCountyIds, unresolvedCrossingIds, duplicateCrossingIds,
      missingCrossingMemberships, crossingAuthorityState, crossingIdentityParityPass, crossingMembershipParityPass,
      crossingAuthorityPass, unexpectedCrossingCountyIds, identityMismatch };
  });
  const failures = rows.filter(row => !row.crossingAuthorityPass).map(row => {
    const failureClass = !row.canonicalPlaceId || row.identityMismatch ? 'CANONICAL_IDENTITY_MISMATCH'
      : !row.crossingAuthorityAvailable ? 'CROSSING_AUTHORITY_UNAVAILABLE'
        : row.unresolvedCrossingIds.length ? 'UNRESOLVED_CROSSING_IDENTITY'
          : row.duplicateCrossingIds.length ? 'DUPLICATE_CROSSING_IDENTITY'
            : 'CROSSING_COUNTY_MEMBERSHIP_MISMATCH';
    return { canonicalCommunity: row.canonicalCommunity, canonicalPlaceId: row.canonicalPlaceId,
      membershipCountyIds: row.membershipCountyIds, failureClass, crossingAuthorityReason: row.crossingAuthorityReason,
      canonicalCrossingIdentityCount: row.canonicalCrossingIdentityCount, resolvedCrossingRecordCount: row.resolvedCrossingRecordCount,
      unresolvedCrossingIds: row.unresolvedCrossingIds, duplicateCrossingIds: row.duplicateCrossingIds,
      unexpectedCrossingCountyIds: row.unexpectedCrossingCountyIds, missingCrossingMemberships: row.missingCrossingMemberships,
      recommendedNextAction: 'Stop and inspect the canonical PLACE GEOID join and governed crossing runtime; do not modify production automatically.' };
  });
  const sum = key => rows.reduce((total, row) => total + row[key], 0);
  const summary = { canonicalPlaceCount: rows.length,
    crossingAuthorityPassCount: rows.filter(row => row.crossingAuthorityPass).length,
    crossingAuthorityFailCount: failures.length,
    availableNonemptyPlaceCount: rows.filter(row => row.crossingAuthorityState === 'AVAILABLE_NONEMPTY').length,
    availableEmptyPlaceCount: rows.filter(row => row.crossingAuthorityState === 'AVAILABLE_EMPTY').length,
    unavailablePlaceCount: rows.filter(row => row.crossingAuthorityState === 'UNAVAILABLE').length,
    totalCanonicalCrossingIdentityCount: sum('canonicalCrossingIdentityCount'), totalResolvedCrossingRecordCount: sum('resolvedCrossingRecordCount'),
    unresolvedCrossingIdentityCount: rows.reduce((n, row) => n + row.unresolvedCrossingIds.length, 0),
    duplicateCrossingIdentityCount: rows.reduce((n, row) => n + row.duplicateCrossingIds.length, 0),
    membershipMismatchPlaceCount: rows.filter(row => !row.crossingMembershipParityPass).length,
    identityMismatchPlaceCount: rows.filter(row => row.identityMismatch || !row.canonicalPlaceId).length,
    overallPass: rows.length === 1859 && failures.length === 0 };
  return { rows, failures, summary };
}

async function loadInputs() {
  const memberships = json('data/runtime/canonical-crossing-memberships-v1.json');
  const records = json('data/runtime/canonical-crossing-records-v1.json');
  const responses = new Map([["data/runtime/canonical-crossing-memberships-v1.json", memberships], ["data/runtime/canonical-crossing-records-v1.json", records]]);
  const sandbox = { window: {}, Object, fetch: async url => ({ ok: responses.has(url), status: responses.has(url) ? 200 : 404, json: async () => responses.get(url) }) };
  vm.createContext(sandbox); vm.runInContext(read('js/gridlyCanonicalCrossingRuntime.js'), sandbox);
  await sandbox.window.gridlyCanonicalCrossingRuntime.load();
  const identitySandbox = { window: {} }; vm.createContext(identitySandbox); vm.runInContext(read('js/gridlyRuntimeCountyIdentity.js'), identitySandbox);
  return { canonicalPlaces: json('data/generated/gridly-statewide-consumer-community-projection-v1.json').communities,
    resolveRecords: identity => sandbox.window.gridlyCanonicalCrossingRuntime.resolveRecords(identity),
    resolveCountyFips: fips => identitySandbox.window.gridlyRuntimeCountyIdentity.resolveFips(fips) };
}

function csvCell(value) { const text = Array.isArray(value) ? value.join('|') : String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
export function renderCsv(rows) { const fields = Object.keys(rows[0] || {}).filter(key => !['unexpectedCrossingCountyIds', 'identityMismatch'].includes(key)); return canonicalizeCsvNewlines(`${fields.join(',')}\n${rows.map(row => fields.map(field => csvCell(row[field])).join(',')).join('\n')}\n`); }
function renderMarkdown(result) { return `# LP239.6 Statewide Canonical Crossing Authority Parity Certification\n\nDeterministically audits the LP239.2 registry through \`gridlyCanonicalCrossingRuntime.resolveRecords({ placeGeoid })\`. No production behavior was changed.\n\n## Summary\n\n| Metric | Total |\n|---|---:|\n${Object.entries(result.summary).map(([key, value]) => `| ${key} | ${value} |`).join('\n')}\n\n## Beaumont control\n\n${JSON.stringify(result.rows.find(row => row.canonicalPlaceId === '4807000'))}\n\n## Failure ledger\n\n${result.failures.length ? result.failures.map(row => `- ${row.canonicalCommunity} (${row.canonicalPlaceId}): ${row.failureClass}`).join('\n') : 'Empty — all canonical PLACE crossing authority rows passed.'}\n`; }
export async function buildCertification() { return certifyCrossingAuthority(await loadInputs()); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildCertification(); const dir = path.join(root, 'reports/lp239-crossing-statewide');
  const outputs = new Map([['statewide-crossing-certification.json', `${JSON.stringify({ schemaVersion: 'gridly.lp239.6.statewide-crossing-certification.v1', generatedAt: '1970-01-01T00:00:00.000Z', ...result }, null, 2)}\n`], ['statewide-crossing-certification.csv', renderCsv(result.rows)], ['README.md', renderMarkdown(result)], ['failure-ledger.json', `${JSON.stringify(result.failures, null, 2)}\n`]]);
  if (process.argv.includes('--write')) { fs.mkdirSync(dir, { recursive: true }); for (const [name, value] of outputs) fs.writeFileSync(path.join(dir, name), value); }
  else for (const [name, value] of outputs) {
    const file = path.join(dir, name);
    const matches = fs.existsSync(file) && lp239ArtifactMatches(name, fs.readFileSync(file, 'utf8'), value);
    if (!matches) throw new Error(`LP239.6 artifact missing or stale: ${name}`);
  }
  if (!result.summary.overallPass) throw new Error(`LP239.6 certification failed for ${result.failures.length} PLACE(s); inspect failure ledger before production changes`);
  console.log(`LP239.6 ${process.argv.includes('--write') ? 'build' : 'verify'} PASS: ${result.summary.canonicalPlaceCount} PLACEs, ${result.summary.totalCanonicalCrossingIdentityCount} canonical crossings`);
}
