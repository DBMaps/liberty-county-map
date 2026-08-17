#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const paths = {
  counties: path.join(root, 'data/lp149/runtime-county-registry.json'),
  communities: path.join(root, 'data/generated/gridly-statewide-consumer-community-projection-v1.json'),
  multiCounty: path.join(root, 'data/generated/lp213-statewide-multi-county-place-audit.json'),
  output: path.join(root, 'data/generated/lp214-county-community-inventory.json')
};

const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
const fail = message => { throw new Error(`LP214 statewide community inventory: ${message}`); };
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const ordered = values => values.every((value, index) => !index || values[index - 1].localeCompare(value) < 0);

export function validateInventory(artifact) {
  if (artifact?.schemaVersion !== 'gridly.lp214.county-community-inventory.v1') fail('unsupported schemaVersion');
  if (!Array.isArray(artifact.counties) || artifact.counties.length !== 254 || artifact.summary?.countyCount !== 254) fail('exactly 254 counties are required');
  if (!ordered(artifact.counties.map(county => county.countyFips))) fail('counties must be uniquely ordered by FIPS');

  const countyFips = new Set();
  const canonical = new Map();
  const occurrences = new Map();
  let memberships = 0;
  for (const county of artifact.counties) {
    if (!/^48\d{3}$/.test(county.countyFips) || countyFips.has(county.countyFips)) fail(`invalid or duplicate county FIPS ${county.countyFips}`);
    countyFips.add(county.countyFips);
    if (!/^[a-z0-9-]+-tx$/.test(county.countyId)) fail(`invalid county ID ${county.countyId}`);
    if (county.communityCount !== county.communities?.length) fail(`community count mismatch for ${county.countyFips}`);
    if (!ordered(county.communities.map(row => row.canonicalKey))) fail(`communities must be uniquely ordered for ${county.countyFips}`);
    for (const community of county.communities) {
      memberships++;
      if (!community.canonicalKey) fail(`canonical key missing in ${county.countyFips}`);
      if (community.identityType !== 'PLACE_GEOID' || !/^48\d{5}$/.test(community.placeGeoid)) fail(`invalid PLACE identity ${community.canonicalKey}`);
      if (community.canonicalKey !== `place-${community.placeGeoid}`) fail(`canonical key is not governed identity for ${community.placeGeoid}`);
      if (!community.consumerLabel?.trim()) fail(`consumer label missing for ${community.canonicalKey}`);
      if (!Array.isArray(community.memberCountyFips) || !ordered(community.memberCountyFips) || !community.memberCountyFips.includes(county.countyFips)) fail(`invalid membership for ${community.canonicalKey}`);
      if (community.multiCounty !== (community.memberCountyFips.length > 1)) fail(`multi-county flag mismatch for ${community.canonicalKey}`);
      const identity = JSON.stringify(community);
      if (canonical.has(community.canonicalKey) && canonical.get(community.canonicalKey) !== identity) fail(`conflicting canonical identity ${community.canonicalKey}`);
      canonical.set(community.canonicalKey, identity);
      const memberRows = occurrences.get(community.canonicalKey) || [];
      memberRows.push(county.countyFips);
      occurrences.set(community.canonicalKey, memberRows);
    }
  }
  for (const [key, value] of canonical) {
    const community = JSON.parse(value);
    for (const fips of community.memberCountyFips) if (!countyFips.has(fips)) fail(`unknown member county ${fips}`);
    if (JSON.stringify(occurrences.get(key)) !== JSON.stringify(community.memberCountyFips)) fail(`county rows do not preserve complete membership for ${key}`);
  }
  const dallas = canonical.has('place-4819000') ? JSON.parse(canonical.get('place-4819000')) : null;
  if (JSON.stringify(dallas?.memberCountyFips) !== JSON.stringify(['48085', '48113', '48121', '48257', '48397'])) fail('Dallas 4819000 membership was not preserved');
  const unique = [...canonical.values()].map(value => JSON.parse(value));
  const multi = unique.filter(row => row.multiCounty).length;
  const expected = {
    countyCount: 254,
    uniqueCanonicalCommunityCount: unique.length,
    countyCommunityMembershipCount: memberships,
    singleCountyCommunityCount: unique.length - multi,
    multiCountyCommunityCount: multi,
    placeCommunityCount: unique.length,
    otherGovernedCommunityCount: 0,
    unresolvedCount: 0,
    ownerReviewRequiredCount: 0
  };
  if (JSON.stringify(artifact.summary) !== JSON.stringify(expected)) fail('statewide summary does not match inventory records');
  return expected;
}

export function buildInventory() {
  const countySource = read(paths.counties);
  const communitySource = read(paths.communities);
  const lp213 = read(paths.multiCounty);
  if (countySource.identityCount !== 254 || countySource.identities?.length !== 254) fail('county registry is not the 254-county identity registry');
  if (communitySource.counts?.uniquePlaceCount !== 1859 || communitySource.counties?.length !== 254) fail('community projection is not the governed statewide projection');

  const sourceCountyByFips = new Map(communitySource.counties.map(county => [county.countyFips, county]));
  const counties = [...countySource.identities].sort((a, b) => a.fips.localeCompare(b.fips)).map(county => {
    const sourceCounty = sourceCountyByFips.get(county.fips);
    if (!sourceCounty) fail(`community projection missing county ${county.fips}`);
    const communities = sourceCounty.communities.map(place => ({
      canonicalKey: `place-${place.placeGeoid}`,
      consumerLabel: place.displayName,
      identityType: 'PLACE_GEOID',
      placeGeoid: place.placeGeoid,
      multiCounty: place.countyMemberships.length > 1,
      memberCountyFips: [...place.countyMemberships]
    })).sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey));
    return { countyId: county.countyId, countyFips: county.fips, countyName: county.countyName, communityCount: communities.length, communities };
  });
  const artifact = {
    schemaVersion: 'gridly.lp214.county-community-inventory.v1',
    sources: ['data/lp149/runtime-county-registry.json', 'data/generated/gridly-statewide-consumer-community-projection-v1.json', 'data/generated/lp213-statewide-multi-county-place-audit.json'],
    summary: {},
    counties
  };
  artifact.summary = validateInventory({ ...artifact, summary: {
    countyCount: 254, uniqueCanonicalCommunityCount: 1859,
    countyCommunityMembershipCount: 2058, singleCountyCommunityCount: 1696,
    multiCountyCommunityCount: 163, placeCommunityCount: 1859,
    otherGovernedCommunityCount: 0, unresolvedCount: 0, ownerReviewRequiredCount: 0
  }});
  const actualMulti = new Map(communitySource.communities.filter(row => row.countyMemberships.length > 1).map(row => [row.placeGeoid, row.countyMemberships]));
  if (lp213.totalCanonicalMultiCountyPlaceCount !== 163 || lp213.inventory?.length !== 163) fail('LP213 certification is incomplete');
  for (const place of lp213.inventory) if (JSON.stringify(actualMulti.get(place.placeGeoid)) !== JSON.stringify(place.members.map(member => member.fips))) fail(`LP213 membership conflict for ${place.placeGeoid}`);
  validateInventory(artifact);
  return artifact;
}

export function run({ verify = false } = {}) {
  const bytes = Buffer.from(stableJson(buildInventory()));
  if (verify) {
    if (!fs.existsSync(paths.output) || !fs.readFileSync(paths.output).equals(bytes)) fail('generated artifact does not match deterministic expected output');
  } else {
    fs.mkdirSync(path.dirname(paths.output), { recursive: true });
    fs.writeFileSync(paths.output, bytes);
  }
  return { bytes, artifact: JSON.parse(bytes) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--verify') || args.length > 1) fail('usage: node tools/lp214/build-statewide-community-inventory.mjs [--verify]');
    const result = run({ verify: args.includes('--verify') });
    const zero = result.artifact.counties.filter(county => county.communityCount === 0).map(county => county.countyName);
    console.log(`${args.includes('--verify') ? 'Verified' : 'Wrote'} ${path.relative(root, paths.output)} (${result.bytes.byteLength} bytes)`);
    console.log(`Counties with zero governed communities: ${zero.length}${zero.length ? ` (${zero.join(', ')})` : ''}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
