#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CENSUS_TYPES,
  createCensusPlace,
  createCommunityIdentityPackage,
  createLegacyAwarenessArea
} from './community-package-identity-contract.mjs';

export const EXPECTED = Object.freeze({ counties: 254, places: 1863, memberships: 2062, multiCounty: 163, c9: 4 });
const INPUT_FILES = Object.freeze({
  canonical: 'texas-place-canonical.json',
  memberships: 'texas-place-county-memberships.json',
  summary: 'texas-place-certification-summary.json',
  duplicateNames: 'texas-place-duplicate-names.json'
});
const CERT_FILE = 'lp1883-community-package-certification.json';
const fail = message => { throw new Error(`LP188.3 fail closed: ${message}`); };
const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const unique = values => [...new Set(values)].sort();

function assertCount(actual, expected, label) {
  if (actual !== expected) fail(`${label}: expected ${expected}, found ${actual}`);
}

function summaryCount(summary, name) {
  const value = summary?.counts?.[name];
  if (!Number.isInteger(value)) fail(`certification summary is missing integer counts.${name}`);
  return value;
}

function loadLegacy(legacyRoot, countyNames) {
  const result = new Map();
  if (!legacyRoot) return result;
  if (!fs.existsSync(legacyRoot)) fail(`legacy package root does not exist: ${legacyRoot}`);
  for (const entry of fs.readdirSync(legacyRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(legacyRoot, entry.name, 'package-manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    if (!Array.isArray(manifest.communities) || typeof manifest.county !== 'string') fail(`invalid legacy manifest: ${manifestPath}`);
    const matches = [...countyNames].filter(([, name]) => name.toLowerCase() === manifest.county.trim().toLowerCase());
    if (matches.length !== 1) fail(`legacy county display name does not resolve uniquely: ${manifest.county}`);
    const countyFips = matches[0][0];
    if (result.has(countyFips)) fail(`more than one legacy manifest resolves to county ${countyFips}`);
    const communities = manifest.communities.map(value => {
      if (typeof value !== 'string' || !value.trim()) fail(`invalid legacy community in ${manifestPath}`);
      return value.trim();
    });
    result.set(countyFips, {
      communities,
      areas: communities.map(displayName => createLegacyAwarenessArea({ legacyIdentity: displayName, displayName }))
    });
  }
  return result;
}

export function reconcileInputs({ canonical, memberships, summary, duplicateNames, legacyRoot }) {
  if (!Array.isArray(canonical) || !Array.isArray(memberships) || !Array.isArray(duplicateNames)) fail('all three LP188.2A record inputs must be arrays');
  if (summary?.milestone !== 'LP188.2A' || summary?.finalClassification !== 'PLACE_COUNTY_MEMBERSHIP_CERTIFIED_READY_FOR_COMMUNITY_MANUFACTURING') fail('LP188.2A certification is not approved for manufacturing');
  const requiredSummary = {
    TOTAL_PLACES: EXPECTED.places,
    TOTAL_PLACE_COUNTY_MEMBERSHIPS: EXPECTED.memberships,
    COUNTIES_WITH_AT_LEAST_ONE_PLACE: EXPECTED.counties,
    UNMATCHED_PLACES: 0,
    DUPLICATE_GEOIDS: 0,
    INVALID_GEOMETRIES: 0,
    OTHER_REQUIRES_REVIEW: 0,
    MULTI_COUNTY_PLACES: EXPECTED.multiCounty,
    INCORPORATED_INACTIVE_OR_NONFUNCTIONING: EXPECTED.c9
  };
  for (const [name, expected] of Object.entries(requiredSummary)) assertCount(summaryCount(summary, name), expected, name);
  assertCount(canonical.length, EXPECTED.places, 'canonical places');
  assertCount(memberships.length, EXPECTED.memberships, 'memberships');

  const canonicalByGeoid = new Map();
  for (const place of canonical) {
    if (!/^48\d{5}$/.test(place?.geoid || '')) fail('canonical place has invalid or name-substituted GEOID');
    if (canonicalByGeoid.has(place.geoid)) fail(`duplicate canonical PLACE GEOID ${place.geoid}`);
    canonicalByGeoid.set(place.geoid, place);
  }
  const membershipKeys = new Set();
  const membershipByPlace = new Map();
  const countyNames = new Map();
  for (const membership of memberships) {
    if (!canonicalByGeoid.has(membership?.placeGeoid)) fail(`unknown PLACE GEOID ${membership?.placeGeoid}`);
    if (!/^48\d{3}$/.test(membership?.countyFips || '')) fail(`unknown county FIPS ${membership?.countyFips}`);
    if (membership.placeName !== canonicalByGeoid.get(membership.placeGeoid).officialName) fail(`source name disagreement for ${membership.placeGeoid}`);
    if (typeof membership.countyName !== 'string' || !membership.countyName.trim()) fail(`county ${membership.countyFips} lacks display metadata`);
    if (countyNames.has(membership.countyFips) && countyNames.get(membership.countyFips) !== membership.countyName) fail(`county display metadata disagrees for ${membership.countyFips}`);
    countyNames.set(membership.countyFips, membership.countyName);
    const key = `${membership.placeGeoid}:${membership.countyFips}`;
    if (membershipKeys.has(key)) fail(`duplicate membership ${key}`);
    membershipKeys.add(key);
    const list = membershipByPlace.get(membership.placeGeoid) || [];
    list.push(membership.countyFips);
    membershipByPlace.set(membership.placeGeoid, list);
  }
  assertCount(countyNames.size, EXPECTED.counties, 'county identities');
  for (const geoid of canonicalByGeoid.keys()) if (!membershipByPlace.has(geoid)) fail(`missing membership for ${geoid}`);
  const multiCountyGeoids = [...membershipByPlace].filter(([, values]) => unique(values).length > 1).map(([geoid]) => geoid).sort();
  assertCount(multiCountyGeoids.length, EXPECTED.multiCounty, 'multi-county places');

  const duplicateGroups = new Map();
  for (const place of canonical) {
    const group = duplicateGroups.get(place.officialName) || [];
    group.push(place.geoid);
    duplicateGroups.set(place.officialName, group);
  }
  const expectedDuplicateGroups = [...duplicateGroups].filter(([, ids]) => ids.length > 1).map(([displayName, ids]) => ({ displayName, placeGeoids: ids.sort() })).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const suppliedDuplicateGroups = duplicateNames.map(group => ({ displayName: group.displayName, placeGeoids: unique(group.placeGeoids || []) })).sort((a, b) => a.displayName.localeCompare(b.displayName));
  if (JSON.stringify(expectedDuplicateGroups) !== JSON.stringify(suppliedDuplicateGroups)) fail('duplicate-name governed input disagrees with canonical identities');

  const legacy = loadLegacy(legacyRoot, countyNames);
  const packages = [];
  for (const countyFips of [...countyNames.keys()].sort()) {
    const countyMemberships = memberships.filter(row => row.countyFips === countyFips).sort((a, b) => a.placeGeoid.localeCompare(b.placeGeoid));
    const censusPlaces = countyMemberships.map(row => {
      const place = canonicalByGeoid.get(row.placeGeoid);
      return createCensusPlace({ geoid: place.geoid, officialName: place.officialName, governedType: place.governedType, countyMemberships: unique(membershipByPlace.get(place.geoid)) });
    });
    const compatibility = legacy.get(countyFips) || { communities: [], areas: [] };
    packages.push(createCommunityIdentityPackage({
      county: { countyFips, displayName: countyNames.get(countyFips) },
      censusPlaces,
      legacyAwarenessAreas: compatibility.areas,
      communities: compatibility.communities
    }));
  }
  const representedMemberships = packages.reduce((count, item) => count + item.censusPlaces.length, 0);
  const representedGeoids = unique(packages.flatMap(item => item.censusPlaces.map(place => place.placeGeoid)));
  const c9Records = packages.flatMap(item => item.censusPlaces).filter(place => place.governedType === CENSUS_TYPES.C9);
  // Count canonical C9 identities, not their potentially repeated package records.
  const c9Geoids = unique(c9Records.map(place => place.placeGeoid));
  assertCount(representedMemberships, EXPECTED.memberships, 'represented memberships');
  assertCount(representedGeoids.length, EXPECTED.places, 'represented canonical places');
  assertCount(c9Geoids.length, EXPECTED.c9, 'governed C9 identities');
  if (c9Records.some(place => place.consumerEligible)) fail('a C9 record is consumer eligible');
  const baytownPackages = packages.filter(item => item.censusPlaces.some(place => place.placeGeoid === '4806128')).map(item => item.county.countyFips).sort();
  if (JSON.stringify(baytownPackages) !== JSON.stringify(['48071', '48201'])) fail('Baytown membership does not reconcile to Chambers and Harris');
  for (const geoid of multiCountyGeoids) {
    const expected = unique(membershipByPlace.get(geoid));
    const records = packages.flatMap(item => item.censusPlaces).filter(place => place.placeGeoid === geoid);
    if (records.length !== expected.length || records.some(place => JSON.stringify(place.countyMemberships) !== JSON.stringify(expected))) fail(`multi-county membership is incomplete for ${geoid}`);
  }
  return { packages, representedGeoids, multiCountyGeoids, c9Geoids };
}

function certification(reconciled) {
  return {
    schemaVersion: 'gridly.community-package.certification.lp1883.v1',
    sourceContractVersion: 'LP188.2A',
    sourceReferences: Object.values(INPUT_FILES),
    expectedCountyCount: EXPECTED.counties,
    manufacturedCountyCount: reconciled.packages.length,
    expectedCanonicalPlaceCount: EXPECTED.places,
    representedCanonicalPlaceCount: reconciled.representedGeoids.length,
    expectedMembershipCount: EXPECTED.memberships,
    representedMembershipCount: reconciled.packages.reduce((n, item) => n + item.censusPlaces.length, 0),
    missingCounties: [], duplicateCounties: [], missingMemberships: [], duplicateMemberships: [], inventedMemberships: [],
    unknownPlaceGeoids: [], unknownCountyFips: [], zeroCommunityCounties: [], duplicateNameIdentityCollisions: [],
    multiCountyPlaceCount: reconciled.multiCountyGeoids.length,
    c9GovernedCount: reconciled.c9Geoids.length,
    c9ConsumerEligibleCount: 0,
    deterministicGenerationPass: true,
    validationFailureCount: 0,
    overallClassification: 'PASS'
  };
}

function writeGeneration(directory, reconciled) {
  fs.mkdirSync(path.join(directory, 'counties'), { recursive: true });
  for (const item of reconciled.packages) fs.writeFileSync(path.join(directory, 'counties', `${item.county.countyFips}.json`), stableJson(item), { encoding: 'utf8' });
  fs.writeFileSync(path.join(directory, CERT_FILE), stableJson(certification(reconciled)), { encoding: 'utf8' });
}

function inventory(directory) {
  const files = fs.readdirSync(path.join(directory, 'counties')).sort().map(name => `counties/${name}`);
  files.push(CERT_FILE);
  return new Map(files.map(name => [name, sha256(fs.readFileSync(path.join(directory, name)))]));
}

export function manufacture({ inputDirectory, outputDirectory, legacyRoot }) {
  for (const filename of Object.values(INPUT_FILES)) if (!fs.existsSync(path.join(inputDirectory, filename))) fail(`required governed input is absent: ${filename}`);
  const reconciled = reconcileInputs({
    canonical: readJson(path.join(inputDirectory, INPUT_FILES.canonical)),
    memberships: readJson(path.join(inputDirectory, INPUT_FILES.memberships)),
    summary: readJson(path.join(inputDirectory, INPUT_FILES.summary)),
    duplicateNames: readJson(path.join(inputDirectory, INPUT_FILES.duplicateNames)),
    legacyRoot
  });
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'gridly-lp1883-'));
  const first = path.join(scratch, 'generation-a');
  const second = path.join(scratch, 'generation-b');
  try {
    writeGeneration(first, reconciled);
    writeGeneration(second, reconciled);
    const a = inventory(first); const b = inventory(second);
    if (JSON.stringify([...a]) !== JSON.stringify([...b])) fail('isolated generations are not byte identical');
    const parent = path.dirname(outputDirectory); fs.mkdirSync(parent, { recursive: true });
    const stage = `${outputDirectory}.stage-${process.pid}`;
    const backup = `${outputDirectory}.backup-${process.pid}`;
    if (fs.existsSync(stage) || fs.existsSync(backup)) fail('staging or backup path already exists');
    fs.cpSync(first, stage, { recursive: true, errorOnExist: true });
    if (JSON.stringify([...inventory(stage)]) !== JSON.stringify([...a])) fail('staged output validation failed');
    if (fs.existsSync(outputDirectory)) fs.renameSync(outputDirectory, backup);
    try { fs.renameSync(stage, outputDirectory); } catch (error) { if (fs.existsSync(backup)) fs.renameSync(backup, outputDirectory); throw error; }
    if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
    return certification(reconciled);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}

function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) fail('usage: --input DIR --output DIR [--legacy-root DIR]');
    values[argv[i].slice(2)] = argv[i + 1];
  }
  if (!values.input || !values.output) fail('--input and --output are required');
  return { inputDirectory: path.resolve(values.input), outputDirectory: path.resolve(values.output), legacyRoot: values['legacy-root'] ? path.resolve(values['legacy-root']) : undefined };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(stableJson(manufacture(parseArgs(process.argv.slice(2)))).trimEnd()); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
