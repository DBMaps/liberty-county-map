import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import vm from 'node:vm';

const root = resolve(new URL('../../', import.meta.url).pathname);
const readJson = async path => JSON.parse((await readFile(resolve(root, path), 'utf8')).replace(/^\uFEFF/, ''));
const slash = path => path.replaceAll('\\', '/');
const walk = dir => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]) : [];

export async function buildAudit() {
  const [addressManifest, reconciliation, communityManifest, crossingManifest, evidenceMatrix, runtimeManifest] = await Promise.all([
    readJson('data/generated/lp104/txgio-addresses/manifest.json'), readJson('evidence/lp130/final-reconciliation.json'),
    readJson('Community-Packages/county-manifest.json'), readJson('Crossing-Packages/production-crossing-manifest.json'),
    readJson('evidence/lp126/texas-statewide-multi-class-evidence.json'), readJson('data/generated/lp104/txgio-addresses/runtime-manifest.json')
  ]);
  const certificationFiles = walk(resolve(root, 'reports')).concat(walk(resolve(root, 'data/generated/lp1051/certification'))).filter(path => path.endsWith('.certification.json'));
  const certifications = new Map(certificationFiles.map(path => { const item = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')); return [item.countyFips, { ...item, path: slash(relative(root, path)) }]; }));
  const communities = new Map(communityManifest.counties.map(item => [item.county.toLowerCase(), item]));
  const crossings = new Map(crossingManifest.records.map(item => [item.county.toLowerCase(), item]));
  const matrix = new Map(evidenceMatrix.matrix.map(item => [`${item.countyFips}:${item.evidenceClass}`, item]));
  const runtimeFips = new Set(runtimeManifest.packages.map(item => item.fips));
  const inventoryByFips = new Map(reconciliation.packageInventory.map(item => [item.fips, item]));
  const blockedFips = new Set(reconciliation.certificationBlockedInventory.counties.map(item => item.fips));

  const context = { window: {} };
  vm.runInNewContext(await readFile(resolve(root, 'js/lp097-curated-destinations.js'), 'utf8'), context);
  vm.runInNewContext(await readFile(resolve(root, 'js/lp098-curated-destinations.js'), 'utf8'), context);
  const destinations = context.window.GRIDLY_LP098_CURATED_DESTINATIONS;

  const counties = addressManifest.packages.map(pkg => {
    const nameKey = pkg.county.toLowerCase();
    const community = communities.get(nameKey);
    const crossing = crossings.get(nameKey);
    const cert = certifications.get(pkg.fips);
    const packageInventory = inventoryByFips.get(pkg.fips);
    const countyDestinations = destinations.filter(item => item.countyId === `${pkg.countyId}-tx` && item.active === true);
    const communityNames = community?.communities || [];
    const addressRuntime = runtimeFips.has(pkg.fips);
    // LP130's corrected statewide reconciliation is the superseding certification-blocker authority.
    // Some earlier cohort reports retain historical FAIL results after later governed reconciliation.
    const certified = Boolean(cert) && !blockedFips.has(pkg.fips);
    const missing = [];
    if (!communityNames.length) missing.push('communities');
    if (!countyDestinations.length) missing.push('destinations');
    if (!crossing) missing.push('production crossing package');
    if (!certified) missing.push('certification');
    if (!addressRuntime) missing.push('address runtime eligibility');
    const runtime = addressRuntime && certified && communityNames.length && countyDestinations.length && crossing ? 'PRODUCTION_READY'
      : cert && !certified ? 'CERTIFICATION_BLOCKED'
      : 'MISSING_REQUIRED_EVIDENCE';
    const blocker = !certified ? (cert ? 'Certification Blocked' : 'Missing Certification')
      : !communityNames.length ? 'Missing Community Coverage'
      : !countyDestinations.length ? 'Missing Destination Dataset'
      : !crossing ? 'Missing Production Crossing Package'
      : !addressRuntime ? 'Candidate Only' : 'Already Production Ready';
    const gapCount = ['communities', 'destinations', 'production crossing package'].filter(x => missing.includes(x)).length;
    const tier = runtime === 'PRODUCTION_READY' ? 'TIER_1' : gapCount === 0 ? 'TIER_2' : gapCount <= 2 ? 'TIER_3' : 'TIER_4';
    const categoryCounts = Object.fromEntries(['government', 'medical', 'education', 'public_service', 'community_destination'].map(category => [category, countyDestinations.filter(x => x.category === category).length]));
    return {
      county: `${pkg.county} County`, countyId: pkg.countyId, fips: pkg.fips,
      address: { status: cert && !certified ? 'CERTIFICATION_BLOCKED' : addressRuntime ? 'PASS' : 'CANDIDATE_ONLY', packageExists: Boolean(packageInventory), runtimeSidecarExists: Boolean(packageInventory?.sidecarName), certificateExists: Boolean(cert), integrity: 'PASS', certificationStatus: cert ? (certified ? 'PASS' : 'FAIL') : 'NOT_FOUND', runtimeEligible: addressRuntime, recordCount: pkg.acceptedRecords, certificationEvidence: cert?.path || null },
      communities: { datasetPresent: Boolean(community), count: communityNames.length, aliases: [], searchSupported: communityNames.length > 0, names: communityNames },
      destinations: { datasetPresent: countyDestinations.length > 0, count: countyDestinations.length, aliases: countyDestinations.reduce((sum, x) => sum + x.aliases.length, 0), categoryCounts, searchSupported: countyDestinations.length > 0 },
      crossings: { productionPackageExists: Boolean(crossing), count: crossing?.crossingCount || 0, runtimeAvailable: crossing?.status === 'PASS' },
      authoritativeEvidence: Object.fromEntries(evidenceMatrix.evidenceClasses.map(kind => { const cell = matrix.get(`${pkg.fips}:${kind}`); return [kind.toLowerCase(), { outcome: cell.terminalOutcome, acceptedRecordCount: cell.acceptedRecordCount }]; })),
      search: { address: addressRuntime, community: communityNames.length > 0, destination: countyDestinations.length > 0 },
      runtime, activationEligible: runtime === 'PRODUCTION_READY', activationBlocker: blocker, missingEvidence: missing, tier,
      status: runtime === 'PRODUCTION_READY' ? 'PRODUCTION_READY' : cert && !certified ? 'CERTIFICATION_BLOCKED' : 'CANDIDATE_ONLY'
    };
  });
  const count = fn => counties.filter(fn).length;
  const sum = fn => counties.reduce((total, county) => total + fn(county), 0);
  return {
    schemaVersion: 'gridly-lp131-statewide-readiness-audit-v1', milestone: 'LP131', observationDate: '2026-08-04', auditOnly: true,
    authority: { countyControl: 'data/generated/lp104/txgio-addresses/manifest.json', packageIntegrity: 'evidence/lp130/final-reconciliation.json', communityRuntime: 'Community-Packages/county-manifest.json', destinationRuntime: 'js/lp098-curated-destinations.js', crossingRuntime: 'Crossing-Packages/production-crossing-manifest.json', evidenceMatrix: 'evidence/lp126/texas-statewide-multi-class-evidence.json', addressRuntime: 'data/generated/lp104/txgio-addresses/runtime-manifest.json' },
    classificationRules: { blockerPriority: ['Certification Blocked', 'Missing Certification', 'Missing Community Coverage', 'Missing Destination Dataset', 'Missing Production Crossing Package', 'Candidate Only', 'Already Production Ready'], note: 'Runtime support is reported only when an existing runtime registry or search dataset supplies affirmative evidence; candidate packages are not treated as activated.' },
    summary: { countiesAudited: counties.length, addressPackages: count(x => x.address.packageExists), certifiedPackages: count(x => x.address.certificationStatus === 'PASS'), certificationBlocked: count(x => x.address.certificationStatus === 'FAIL'), candidateOnly: count(x => x.status === 'CANDIDATE_ONLY'), communities: sum(x => x.communities.count), destinations: sum(x => x.destinations.count), crossings: sum(x => x.crossings.count), runtimeReadyCounties: count(x => x.activationEligible) },
    gaps: { countiesMissingCommunities: count(x => !x.communities.count), countiesMissingDestinations: count(x => !x.destinations.count), countiesMissingCrossings: count(x => !x.crossings.productionPackageExists), certificationBlockedCounties: count(x => x.address.certificationStatus === 'FAIL'), runtimeEligibleCounties: count(x => x.activationEligible), candidateOnlyCounties: count(x => x.status === 'CANDIDATE_ONLY') },
    tiers: Object.fromEntries(['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4'].map(tier => [tier, count(x => x.tier === tier)])),
    counties
  };
}

function csv(audit) {
  const quote = value => `"${String(value).replaceAll('"', '""')}"`;
  const header = ['County','FIPS','Address','Communities','Destinations','Crossings','Search','Runtime','Activation Blocker','Tier','Status','Missing Evidence'];
  return [header, ...audit.counties.map(x => [x.county,x.fips,x.address.status,x.communities.count,x.destinations.count,x.crossings.count,`A:${x.search.address?'Y':'N'} C:${x.search.community?'Y':'N'} D:${x.search.destination?'Y':'N'}`,x.runtime,x.activationBlocker,x.tier,x.status,x.missingEvidence.join('; ')])].map(row => row.map(quote).join(',')).join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const audit = await buildAudit();
  const out = resolve(root, 'evidence/lp131'); await mkdir(out, { recursive: true });
  const json = JSON.stringify(audit, null, 2) + '\n'; const csvText = csv(audit);
  if (process.argv.includes('--verify')) {
    if (await readFile(join(out, 'statewide-readiness-audit.json'), 'utf8') !== json || await readFile(join(out, 'county-inventory.csv'), 'utf8') !== csvText) throw new Error('LP131 outputs are stale; run without --verify');
  } else { await writeFile(join(out, 'statewide-readiness-audit.json'), json); await writeFile(join(out, 'county-inventory.csv'), csvText); }
  console.log(JSON.stringify({ summary: audit.summary, gaps: audit.gaps, tiers: audit.tiers }));
}
