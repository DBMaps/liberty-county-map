#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_PACKAGE_COUNT = 254;
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_INVENTORY_PATH = path.join(repositoryRoot, 'reports/lp1885/community-package-identity-inventory.json');
export const DEFAULT_OUTPUT_PATH = path.join(repositoryRoot, 'data/generated/gridly-statewide-consumer-community-projection-v1.json');
const fail = message => { throw new Error(`Statewide community projection failed closed: ${message}`); };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
const parseJson = (bytes, label) => {
  try { return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')); }
  catch (error) { fail(`${label} is not valid JSON: ${error.message}`); }
};
const sortedUnique = values => [...new Set(values)].sort();

function validateInventory(inventory) {
  if (inventory?.schemaVersion !== 'gridly.community-package.portable-identity-inventory.lp1885.v1') fail('unsupported LP188.5 inventory schemaVersion');
  if (inventory.expectedCountyCount !== EXPECTED_PACKAGE_COUNT || !Array.isArray(inventory.packages) || inventory.packages.length !== EXPECTED_PACKAGE_COUNT) fail(`inventory must contain exactly ${EXPECTED_PACKAGE_COUNT} package identities`);
  const seen = new Set();
  for (const identity of inventory.packages) {
    if (!/^48\d{3}$/.test(identity?.countyFips || '')) fail(`invalid inventory county FIPS: ${identity?.countyFips}`);
    if (seen.has(identity.countyFips)) fail(`duplicate inventory county FIPS ${identity.countyFips}`);
    seen.add(identity.countyFips);
    if (identity.relativePackagePath !== `counties/${identity.countyFips}.json`) fail(`unexpected package path for ${identity.countyFips}`);
    if (!Number.isInteger(identity.byteLength) || identity.byteLength < 1 || !/^[a-f0-9]{64}$/.test(identity.sha256 || '')) fail(`invalid byte identity for ${identity.countyFips}`);
  }
}

function validatePlace(place, packageFips) {
  if (!/^48\d{5}$/.test(place?.placeGeoid || '')) fail(`invalid PLACE GEOID in county ${packageFips}`);
  if (typeof place.displayName !== 'string' || !place.displayName.trim()) fail(`missing displayName for ${place.placeGeoid}`);
  if (typeof place.governedType !== 'string' || !place.governedType) fail(`missing governedType for ${place.placeGeoid}`);
  if (typeof place.consumerEligible !== 'boolean') fail(`missing consumerEligible for ${place.placeGeoid}`);
  if (!Array.isArray(place.countyMemberships) || place.countyMemberships.length === 0) fail(`missing countyMemberships for ${place.placeGeoid}`);
  const memberships = sortedUnique(place.countyMemberships);
  if (memberships.length !== place.countyMemberships.length || memberships.some(fips => !/^48\d{3}$/.test(fips)) || JSON.stringify(memberships) !== JSON.stringify(place.countyMemberships)) fail(`invalid or nondeterministic countyMemberships for ${place.placeGeoid}`);
  if (!memberships.includes(packageFips)) fail(`${place.placeGeoid} does not include package county ${packageFips}`);
}

export function buildProjection({ packageRoot, inventoryPath = DEFAULT_INVENTORY_PATH, outputPath = DEFAULT_OUTPUT_PATH, write = true }) {
  if (!packageRoot) fail('LP188.3 package root argument is required');
  const inventoryBytes = fs.readFileSync(inventoryPath);
  const inventory = parseJson(inventoryBytes, 'LP188.5 inventory');
  validateInventory(inventory);

  const perCounty = [];
  const occurrences = new Map();
  for (const identity of [...inventory.packages].sort((a, b) => a.countyFips.localeCompare(b.countyFips))) {
    const packagePath = path.resolve(packageRoot, ...identity.relativePackagePath.split('/'));
    let bytes;
    try { bytes = fs.readFileSync(packagePath); } catch { fail(`missing package ${identity.relativePackagePath}`); }
    if (bytes.byteLength !== identity.byteLength) fail(`byte length mismatch for ${identity.countyFips}: expected ${identity.byteLength}, found ${bytes.byteLength}`);
    const actualHash = sha256(bytes);
    if (actualHash !== identity.sha256) fail(`SHA-256 mismatch for ${identity.countyFips}`);
    const payload = parseJson(bytes, identity.relativePackagePath);
    if (payload?.schemaVersion !== identity.schemaVersion || payload?.county?.countyFips !== identity.countyFips) fail(`FIPS or schema identity mismatch for ${identity.countyFips}`);
    if (payload.county.displayName !== identity.countyName || !Array.isArray(payload.censusPlaces)) fail(`package metadata mismatch for ${identity.countyFips}`);
    const communities = [], exclusions = [], packagePlaceGeoids = new Set();
    for (const place of payload.censusPlaces) {
      validatePlace(place, identity.countyFips);
      if (packagePlaceGeoids.has(place.placeGeoid)) fail(`duplicate PLACE GEOID ${place.placeGeoid} in county ${identity.countyFips}`);
      packagePlaceGeoids.add(place.placeGeoid);
      const governed = { placeGeoid: place.placeGeoid, displayName: place.displayName, governedType: place.governedType, consumerEligible: place.consumerEligible, countyMemberships: place.countyMemberships };
      const previous = occurrences.get(place.placeGeoid)?.record;
      if (previous && JSON.stringify(previous) !== JSON.stringify(governed)) fail(`governed records disagree for ${place.placeGeoid}`);
      const entry = occurrences.get(place.placeGeoid) || { record: governed, packageCounties: [] };
      entry.packageCounties.push(identity.countyFips); occurrences.set(place.placeGeoid, entry);
      (place.consumerEligible ? communities : exclusions).push(governed);
    }
    const byGeoid = (a, b) => a.placeGeoid.localeCompare(b.placeGeoid);
    perCounty.push({ countyFips: identity.countyFips, displayName: identity.countyName, communities: communities.sort(byGeoid), exclusions: exclusions.sort(byGeoid) });
  }

  for (const [geoid, entry] of occurrences) {
    if (JSON.stringify(sortedUnique(entry.packageCounties)) !== JSON.stringify(entry.record.countyMemberships)) fail(`package occurrences do not preserve complete countyMemberships for ${geoid}`);
  }
  const eligible = [...occurrences.values()].filter(entry => entry.record.consumerEligible).map(entry => entry.record).sort((a, b) => a.placeGeoid.localeCompare(b.placeGeoid));
  const excluded = [...occurrences.values()].filter(entry => !entry.record.consumerEligible).map(entry => entry.record).sort((a, b) => a.placeGeoid.localeCompare(b.placeGeoid));
  const artifact = {
    schemaVersion: 'gridly.statewide-consumer-community-projection.v1',
    provenance: {
      inventory: { relativePath: 'reports/lp1885/community-package-identity-inventory.json', schemaVersion: inventory.schemaVersion, source: inventory.source, sha256: sha256(inventoryBytes) },
      sourcePackageCount: inventory.packages.length,
      acceptedPackageCount: perCounty.length
    },
    counts: {
      uniquePlaceCount: eligible.length,
      membershipCount: eligible.reduce((count, place) => count + place.countyMemberships.length, 0),
      multiCountyPlaceCount: eligible.filter(place => place.countyMemberships.length > 1).length,
      excludedIneligibleCount: excluded.length
    },
    communities: eligible,
    exclusions: excluded,
    counties: perCounty
  };
  const bytes = Buffer.from(stableJson(artifact));
  if (write) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const stage = `${outputPath}.stage-${process.pid}`;
    fs.writeFileSync(stage, bytes);
    fs.renameSync(stage, outputPath);
  }
  return { artifact, bytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const packageRoot = process.argv[2];
    if (!packageRoot || process.argv.length > 3) fail('usage: node tools/build-statewide-consumer-community-projection.mjs <LP188.3-package-root>');
    const result = buildProjection({ packageRoot: path.resolve(packageRoot) });
    process.stdout.write(`Wrote ${DEFAULT_OUTPUT_PATH} (${result.bytes.byteLength} bytes)\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
