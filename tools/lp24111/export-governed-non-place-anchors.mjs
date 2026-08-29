import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { areas, registry } from '../lp240x/supported-area-identity-audit.mjs';

export const EXPECTED_COUNT = 29;
export const OUTPUT_SCHEMA = 'gridly.lp24111.governed-non-place-anchors.v1';

function isCanonicalPlace(area) {
  return Boolean(area.placeGeoid || area.canonicalCommunityIdentity === 'PLACE_GEOID' || /^48\d{5}$/.test(String(area.communityId || '')));
}

export function deriveGovernedNonPlaceAnchors(authorityAreas = areas, countyRegistry = registry) {
  const candidates = authorityAreas.filter((area) => !isCanonicalPlace(area) && area.countyWide !== true && area.fallback !== true);
  const rows = candidates.map((area) => ({
    identityClass: 'GOVERNED_NON_PLACE',
    stableGovernedIdentity: `${area.countyId}:${area.key}`,
    communityKey: area.key,
    displayLabel: area.label,
    countyId: area.countyId,
    latitude: area.lat,
    longitude: area.lng,
    radiusMiles: area.radiusMiles ?? null,
    placeGeoid: null,
    source: area.source
  })).sort((a, b) => a.stableGovernedIdentity.localeCompare(b.stableGovernedIdentity));
  validateGovernedNonPlaceAnchors(rows, countyRegistry);
  return Object.freeze({
    schemaVersion: OUTPUT_SCHEMA,
    derivedFrom: 'js/app.js governed supported-area models projected by tools/lp240x/supported-area-identity-audit.mjs',
    count: rows.length,
    rows
  });
}

export function validateGovernedNonPlaceAnchors(rows, countyRegistry = registry) {
  const identities = rows.map((row) => row.stableGovernedIdentity);
  const countyKeys = rows.map((row) => `${row.countyId}:${row.communityKey}`);
  const failures = [];
  if (rows.length !== EXPECTED_COUNT) failures.push(`row count ${rows.length}; expected ${EXPECTED_COUNT}`);
  if (new Set(identities).size !== EXPECTED_COUNT) failures.push(`unique stable identity count ${new Set(identities).size}; expected ${EXPECTED_COUNT}`);
  if (new Set(countyKeys).size !== rows.length) failures.push('duplicate county/key identities');
  if (rows.some((row) => row.identityClass !== 'GOVERNED_NON_PLACE')) failures.push('unexpected identity classes');
  if (rows.some((row) => !countyRegistry[row.countyId])) failures.push('unregistered counties');
  if (rows.some((row) => !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude))) failures.push('invalid governed coordinates');
  if (rows.some((row) => row.placeGeoid !== null)) failures.push('non-null PLACE GEOIDs');
  if (rows.some((row) => row.countyWide === true || row.fallback === true || /^48\d{5}$/.test(String(row.stableGovernedIdentity)))) failures.push('excluded identity class present');
  const tarkington = rows.filter((row) => row.communityKey === 'tarkington');
  const expectedTarkington = { identityClass: 'GOVERNED_NON_PLACE', stableGovernedIdentity: 'liberty-tx:tarkington', communityKey: 'tarkington', displayLabel: 'Tarkington', countyId: 'liberty-tx', latitude: 30.3205, longitude: -94.996, radiusMiles: 8, placeGeoid: null, source: 'safe approximate community anchor' };
  if (tarkington.length !== 1 || JSON.stringify(tarkington[0]) !== JSON.stringify(expectedTarkington)) failures.push('Tarkington acceptance mismatch');
  if (failures.length) throw new Error(`Governed non-PLACE anchor export failed closed: ${failures.join('; ')}`);
  return true;
}

export function writeGovernedNonPlaceAnchors(outputPath = path.resolve('owner-local/lp24111/governed-non-place-anchors.json')) {
  const payload = deriveGovernedNonPlaceAnchors();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const payload = writeGovernedNonPlaceAnchors();
  console.log(`Exported ${payload.count} governed non-PLACE anchors to owner-local/lp24111/governed-non-place-anchors.json`);
}
