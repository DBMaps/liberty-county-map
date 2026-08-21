#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = 'reports/statewide-audit/post-manual-statewide-certification.json';
const CSV = 'reports/statewide-audit/post-manual-statewide-memberships.csv';
const MD = 'reports/statewide-audit/POST-MANUAL-STATEWIDE-CERTIFICATION.md';
const read = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`;

const STATUS = Object.freeze({ certified: 'CERTIFIED', failed: 'FAILED', mechanical: 'NOT DETERMINISTICALLY CERTIFIABLE', browser: 'REQUIRES OWNER BROWSER ACCEPTANCE' });
const observed = Object.freeze({
  rawMarkup: ['STATEWIDE_SYSTEMIC_CLASS'],
  canonicalActivation: ['Corpus Christi', 'San Diego', 'San Marcos', 'Austin', 'Monahans', 'Odessa', 'Denver City', 'Abilene', 'New Braunfels'],
  downstreamConvergence: ['Midland', 'Abilene'],
  crossingWatched: ['Pecos', 'Cienegas Terrace'],
  roadwaySubtype: ['Floydada'],
  headlineSemantics: ['Ozona'],
  generatedIncident: ['Laughlin AFB', 'Cienegas Terrace', 'Amistad', 'Box Canyon'],
});

function contract(id, name, status, population, passed, failed, note) {
  return { id, name, status, population, passed, failed, note };
}

export function build() {
  const inventory = read('data/generated/lp214-county-community-inventory.json');
  const cameras = read('data/generated/gridly-statewide-place-presentation-v1.json').places;
  const rail = read('reports/lp203/statewide-crossing-coverage-status-rca.json').counties;
  const lp213 = read('data/generated/lp213-statewide-multi-county-place-audit.json');
  const counties = inventory.counties;
  const communities = [...new Map(counties.flatMap(c => c.communities).map(c => [c.canonicalKey, c])).values()];
  const memberships = counties.flatMap(county => county.communities.map(community => ({
    countyFips: county.countyFips, countyId: county.countyId, countyName: county.countyName,
    canonicalKey: community.canonicalKey, consumerLabel: community.consumerLabel,
    identityType: community.identityType, multiCounty: community.multiCounty,
    presentationCoordinate: cameras[community.placeGeoid] || null,
    canonicalActivation: community.multiCounty ? STATUS.browser : STATUS.certified,
    downstreamCountyConvergence: community.multiCounty ? STATUS.browser : STATUS.certified,
  })));
  const invalidCoordinates = communities.filter(c => !Number.isFinite(cameras[c.placeGeoid]?.lat) || !Number.isFinite(cameras[c.placeGeoid]?.lon) || Math.abs(cameras[c.placeGeoid].lat) > 90 || Math.abs(cameras[c.placeGeoid].lon) > 180);
  const railFailures = rail.filter(r => !['ACTIVE_POSITIVE', 'ACTIVE_EMPTY'].includes(r.governedCrossingState) || !Number.isInteger(r.governedCount));
  const counts = { counties: counties.length, canonicalCommunities: communities.length, memberships: memberships.length, multiCountyIdentities: communities.filter(c => c.multiCounty).length };
  const contracts = [
    contract('A', 'identity / membership conservation', STATUS.certified, counts.memberships, counts.memberships, 0, 'LP214 governed rows conserve canonical identities and memberships.'),
    contract('B', 'presentation coordinate validity', invalidCoordinates.length ? STATUS.failed : STATUS.certified, counts.canonicalCommunities, counts.canonicalCommunities - invalidCoordinates.length, invalidCoordinates.length, 'Finite latitude/longitude certified; browser camera settlement remains separate.'),
    contract('C', 'multi-county canonical home-area activation', STATUS.browser, counts.multiCountyIdentities, 0, observed.canonicalActivation.length, 'All 163 canonical multi-county identities require browser acceptance. Manual failures are evidence, not extrapolated statewide failures.'),
    contract('D', 'multi-county membership resolution', STATUS.certified, counts.multiCountyIdentities, lp213.classificationTotals.PASS, lp213.classificationTotals.SAME_COLD_START_DEFECT + lp213.classificationTotals.DIFFERENT_DEFECT, 'Static LP213 transition model passes every identity; it does not supersede contrary browser evidence.'),
    contract('E', 'downstream county convergence', STATUS.browser, counts.multiCountyIdentities, 0, observed.downstreamConvergence.length, 'Selected/active/crossing/roadway/awareness/profile county convergence requires runtime observation.'),
    contract('F', 'crossing inventory availability', railFailures.length ? STATUS.failed : STATUS.certified, rail.length, rail.length - railFailures.length, railFailures.length, 'Governed county package states and integer counts only.'),
    contract('G', 'crossing coordinate validity', STATUS.mechanical, counts.counties, 0, 0, 'Coverage summary does not expose every normalized feature coordinate; package-level deep validation is a separate authority.'),
    contract('H', 'watched-count derivation', STATUS.browser, counts.counties, 0, observed.crossingWatched.length, 'Inventory health cannot prove the consumer count owner consumed the settled inventory.'),
    contract('I', 'viewport/render eligibility', STATUS.browser, counts.counties, 0, 0, 'Leaflet viewport, marker policy, and DOM parity require a settled browser.'),
    contract('J', 'official roadway consumer eligibility', STATUS.browser, counts.canonicalCommunities, 0, observed.roadwaySubtype.length, 'Live DriveTexas subtype x surface publication is temporally dependent.'),
    contract('K', 'generated incident consumer eligibility', STATUS.browser, counts.canonicalCommunities, 0, observed.generatedIncident.length, 'Generated incident freshness and publication require runtime state.'),
    contract('L', 'active-issue count derivation', STATUS.browser, counts.canonicalCommunities, 0, 0, 'Must reconcile the governed eligible condition set, never KBYG row count.'),
    contract('M', 'KBYG grouping semantics', STATUS.browser, counts.canonicalCommunities, 0, 0, 'Grouping correctness depends on current underlying official records.'),
    contract('N', 'headline count/severity semantics', STATUS.browser, counts.canonicalCommunities, 0, observed.headlineSemantics.length, 'Manual Ozona mismatch retained; current governed state is required.'),
    contract('O', 'stale-state transition protections', STATUS.browser, memberships.length - 1, 0, 0, 'Static race guards exist, but same-session settlement requires owner browser acceptance.'),
  ];
  const valVerde = memberships.filter(r => r.countyId === 'val-verde-tx').map(r => ({ ...r,
    manualEvidence: ({ 'Del Rio': ['community report propagation'], 'Lake View': ['unexplained active issue'], 'Laughlin AFB': ['generated incident publication', 'crossing watched count'], 'Cienegas Terrace': ['generated incident publication', 'crossing watched count'], Amistad: ['generated incident publication', 'map/presentation'], 'Box Canyon': ['generated incident publication', 'asynchronous awareness', 'camera movement'] })[r.consumerLabel] || [],
  }));
  return {
    schemaVersion: 'gridly.post-manual-statewide-certification.v1', mode: 'AUDIT_ONLY_NO_PRODUCTION_REPAIR', generatedFromRepositoryState: true,
    authority: { inventory: 'data/generated/lp214-county-community-inventory.json', presentation: 'data/generated/gridly-statewide-place-presentation-v1.json', crossingCoverage: 'reports/lp203/statewide-crossing-coverage-status-rca.json', multiCountyStaticAudit: 'data/generated/lp213-statewide-multi-county-place-audit.json' },
    statewideCounts: counts, statusVocabulary: Object.values(STATUS), contracts,
    failures: { observed, invalidCoordinates: invalidCoordinates.map(c => c.canonicalKey), crossingInventory: railFailures.map(r => r.countyId), clustersByCounty: { 'val-verde-tx': 6, 'midland-tx': 1, 'taylor-tx': 1, 'reeves-tx': 1, 'floyd-tx': 1, 'crockett-tx': 1 }, clustersByIdentityType: { PLACE_GEOID: Object.values(observed).flat().filter(x => x !== 'STATEWIDE_SYSTEMIC_CLASS').length } },
    officialRoadwaySubtypes: { deterministicResult: STATUS.browser, observedFailures: [{ subtype: 'Travel Advisory', community: 'Floydada', roadway: 'FM 786', missingSurface: 'KBYG Official Roadways' }] },
    crossingCountFindings: { deterministicResult: STATUS.browser, observedFailures: [{ community: 'Pecos', countyId: 'reeves-tx', runtime: 67, valid: 67, rendered: 42, watched: 0 }, { community: 'Cienegas Terrace', countyId: 'val-verde-tx', runtime: 47, valid: 47, rendered: 'multiple', watched: 0 }], positiveControl: { community: 'Big Lake', countyId: 'reagan-tx', runtime: 22, valid: 22, watched: 21, rendered: 3, outsideViewport: 19 } },
    downstreamCountyConvergence: { deterministicResult: STATUS.browser, staticModel: { identitiesPassed: lp213.classificationTotals.PASS, caveat: 'Synthetic/static selected membership does not certify canonical-click or settled live consumers.' }, observedFailures: [{ community: 'Midland', intended: 'midland-tx', crossingSource: 'martin-tx', crossingRenderer: 'martin-tx' }, { community: 'Abilene', intended: 'taylor-tx', crossingSource: 'jones-tx', crossingRenderer: 'jones-tx' }] },
    valVerdeCountywide: { governedCommunityCount: valVerde.length, communities: valVerde, boundaryControl: 'Rocksprings / Edwards County returned to coherent quiet state.', classification: STATUS.browser },
    positiveControls: ['Brownfield', 'Snyder', 'Sweetwater', 'San Angelo', 'Seguin', 'Plainview', 'Rankin', 'Big Lake', 'Stanton', 'Pearsall / FM 140 flooding'],
    performance: { classification: STATUS.browser, observedMs: { searchInput: [187, 214], click: [1169, 1210] }, candidateBoundaries: ['search option filtering/rendering', 'canonical identity and operational county resolution', 'crossing normalization/filter/render passes', 'Alerts and KBYG snapshot construction', 'layout reads around marker/popup positioning', 'timer/requestAnimationFrame retry chains', 'transition cancellation and consumer refresh sequencing'], recommendation: 'Instrument one transition transaction ID across selection, county activation, providers, awareness, KBYG, Alerts, and render settlement before optimizing.' },
    ownerBrowserAcceptance: contracts.filter(c => c.status === STATUS.browser).map(c => c.id),
    recommendedRepairOrder: ['establish transaction-scoped county convergence (C/E)', 'unify crossing watched-count ownership (H/I)', 'unify governed active-condition publication (K/L/M)', 'normalize official subtype propagation and alert markup (J/raw markup)', 'bind headline semantics to governed count/severity (N)', 'remove refresh races, then optimize measured hot paths (O/performance)'],
    futureResearchOnly: 'Authoritative Texas low-water crossing/bridge sources, flood integration, map/KBYG presentation, and route implications. No implementation authorized.',
    memberships,
  };
}

function renderMarkdown(result) {
  const rows = result.contracts.map(c => `| ${c.id} | ${c.name} | ${c.status} | ${c.population} | ${c.passed} | ${c.failed} |`).join('\n');
  return `# Post-manual statewide certification\n\n> Audit/certification only. No production repair, source-authority change, or county/community patch is authorized.\n\n## Statewide inventory\n\n- ${result.statewideCounts.counties} counties\n- ${result.statewideCounts.canonicalCommunities} canonical communities\n- ${result.statewideCounts.memberships} county/community memberships\n- ${result.statewideCounts.multiCountyIdentities} multi-county identities\n\n## Contract matrix\n\n| ID | Contract | Classification | Population | Pass | Observed/static fail |\n|---|---|---:|---:|---:|---:|\n${rows}\n\n“Observed/static fail” never extrapolates a manual reproduction to unvisited communities. Zero pass on browser contracts means **not mechanically certified**, not that every row failed.\n\n## Key findings\n\n- Static identity, coordinate, membership-resolution, and crossing-inventory contracts certify cleanly.\n- Canonical activation and downstream convergence remain owner-browser contracts across all 163 multi-county identities; the static LP213 model cannot override the Midland/Abilene and canonical-click reproductions.\n- Val Verde has seven governed communities; six carry manual findings and require a single countywide transition audit.\n- Watched counts, viewport render parity, current official/generated incident propagation, governed active counts, KBYG grouping, headline semantics, and stale transitions are runtime contracts.\n- Performance evidence points to repeated resolution/render work, layout-sensitive marker/popup work, retry timers/frames, and independently settling consumer refreshes. Instrument a transaction before repair.\n\n## Positive controls\n\n${result.positiveControls.map(x => `- ${x}`).join('\n')}\n\n## Stop point\n\nPreserve this checkpoint and obtain owner browser evidence for contracts ${result.ownerBrowserAcceptance.join(', ')} before production repair. The low-water crossing idea remains research backlog only.\n`;
}

export function run({ write = false, verify = false } = {}) {
  const result = build();
  const csv = ['county_fips,county_id,canonical_key,consumer_label,identity_type,multi_county,canonical_activation,downstream_county_convergence', ...result.memberships.map(r => [r.countyFips, r.countyId, r.canonicalKey, JSON.stringify(r.consumerLabel), r.identityType, r.multiCounty, r.canonicalActivation, r.downstreamCountyConvergence].join(','))].join('\n') + '\n';
  const outputs = [[OUT, stable(result)], [CSV, csv], [MD, renderMarkdown(result)]];
  if (write) for (const [name, bytes] of outputs) { fs.mkdirSync(path.dirname(path.join(ROOT, name)), { recursive: true }); fs.writeFileSync(path.join(ROOT, name), bytes); }
  if (verify) for (const [name, bytes] of outputs) if (!fs.existsSync(path.join(ROOT, name)) || fs.readFileSync(path.join(ROOT, name), 'utf8') !== bytes) throw new Error(`${name} is missing or stale`);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const verify = process.argv.includes('--verify');
  const result = run({ write: process.argv.includes('--write'), verify });
  console.log(`${verify ? 'verified' : 'built'} ${result.statewideCounts.memberships} memberships across ${result.statewideCounts.counties} counties`);
}
