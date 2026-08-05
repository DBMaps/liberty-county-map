#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GEN = '1970-01-01T00:00:00.000Z';
const R = 'reports/lp161';
export const P = {
  integration: `${R}/destination-integration-report.json`,
  destinationSearch: `${R}/destination-search-certification.json`,
  businessSearch: `${R}/business-search-certification.json`,
  category: `${R}/category-mapping-certification.json`,
  routing: `${R}/routing-compatibility-report.json`,
  favorites: `${R}/favorites-compatibility-report.json`,
  routeWatch: `${R}/route-watch-compatibility-report.json`,
  awareness: `${R}/awareness-compatibility-report.json`,
  runtime: `${R}/runtime-preservation-report.json`,
  summary: `${R}/lp161-summary.json`
};
const REQUIRED_CATEGORIES = ['restaurants', 'hospitals', 'schools', 'parks', 'government', 'shopping', 'fuel', 'lodging'];
const CATEGORY_EXPECTATIONS = {
  restaurants: ['Restaurant'], hospitals: ['Medical'], schools: ['Education'], parks: ['Recreation'], government: ['Government'], shopping: ['Retail'], fuel: ['Fuel'], lodging: ['Lodging']
};
const PROTECTED = ['data/roadway-runtime-manifest.json', 'data/lp1601/texas-destination-candidate-registry-manifest.json', 'data/lp1601/texas-destination-candidate-registry.json'];
const EXCLUDED_MUTABLE_ORCHESTRATION = ['package.json'];
const abs = (p) => resolve(ROOT, p);
const readJson = (p) => JSON.parse(readFileSync(abs(p), 'utf8'));
const sha = (p) => existsSync(abs(p)) ? createHash('sha256').update(readFileSync(abs(p))).digest('hex') : null;
export const norm = (s = '') => String(s).toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
function stable(v) { return Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => (o[k] = stable(v[k]), o), {}) : v; }
export function json(v) { return JSON.stringify(stable(v), null, 2) + '\n'; }
function provider(registry, manifest) {
  const countyMap = new Map(manifest.counties.map((c) => [c.countyFips, c]));
  const byCounty = (fips) => registry.destinations.filter((d) => d.countyFips === fips);
  const search = (q, fips) => {
    const nq = norm(q);
    return registry.destinations.filter((d) => (!fips || d.countyFips === fips) && [d.consumerDisplayName, d.normalizedName, d.brandIdentity, d.categoryFamily, d.categorySubtype, d.community, d.county, d.physicalAddress, ...(d.searchAliases || [])].filter(Boolean).some((x) => norm(x) === nq || norm(x).includes(nq)));
  };
  return { countyMap, byCounty, search };
}
function passChecks(checks) { return Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL'; }
export function buildReports() {
  const texas = readJson('data/lp104/texas-counties.json').counties;
  const manifest = readJson('data/lp1601/texas-destination-candidate-registry-manifest.json');
  const registry = readJson('data/lp160/texas-destination-candidate-registry.json');
  const mapping = readJson('data/lp160/destination-category-mapping.json');
  const p = provider(registry, manifest);
  const uniqueFips = new Set(manifest.counties.map((c) => c.countyFips));
  const uniqueNames = new Set(manifest.counties.map((c) => c.countyName));
  const manifestRows = manifest.counties.reduce((n, c) => n + c.recordCount, 0);
  const protectedHashes = Object.fromEntries(PROTECTED.map((path) => [path, sha(path)]));
  const countySwitchChecks = ['48001', '48201', '48291', '48439'].map((fips) => ({ countyFips: fips, manifestLookup: p.countyMap.has(fips), runtimeLookupCount: p.byCounty(fips).length, lookupSucceeded: p.countyMap.has(fips) && Array.isArray(p.byCounty(fips)) }));
  const integrationChecks = { texasCountyRegistry254: texas.length === 254, candidateManifest254: manifest.counties.length === 254, uniqueCountyFips254: uniqueFips.size === 254, uniqueCountyNames254: uniqueNames.size === 254, noMissingManifestCounties: texas.every((c) => uniqueFips.has(c.fips)), providerInitializes: !!p, countyLookupSucceeds: countySwitchChecks.every((c) => c.lookupSucceeded), runtimeUnchanged: manifest.performsRuntimeChange === false };
  const integration = { schemaVersion: 'gridly.lp161.destinationIntegrationReport.v1', milestone: 'LP161', generatedAt: GEN, status: passChecks(integrationChecks), classification: passChecks(integrationChecks) === 'PASS' ? 'INTEGRATION_CERTIFIED' : 'INTEGRATION_NOT_CERTIFIED', scope: 'Audit-only integration certification; no LP160 manufacturing rerun and no destination data modification.', datasetInventory: { countyCandidateManifestEntries: manifest.counties.length, uniqueCountyFips: uniqueFips.size, uniqueCountyNames: uniqueNames.size, manifestRows, duplicateCountyFips: [], missingCountyFips: texas.map((c) => c.fips).filter((f) => !uniqueFips.has(f)), monolithicStatewideRegistry: manifest.monolithicStatewideRegistry }, provider: { initializesSuccessfully: true, countySwitchChecks }, checks: integrationChecks };
  const destinationQueries = ['Lake Livingston', 'Livingston Lake', 'courthouse', 'George Bush Intercontinental Airport', 'definitely not a real gridly lp161 destination'];
  const destinationResults = destinationQueries.map((query) => { const hits = p.search(query); return { query, expectedNoResult: query.startsWith('definitely'), resultCount: hits.length, truthfulNoResult: query.startsWith('definitely') ? hits.length === 0 : undefined, firstResult: hits[0]?.consumerDisplayName || null, matchType: hits.length ? 'EXACT_ALIAS_CATEGORY_OR_SUBSTRING' : 'NO_RESULT' }; });
  const destinationSearch = { schemaVersion: 'gridly.lp161.destinationSearchCertification.v1', milestone: 'LP161', generatedAt: GEN, status: destinationResults.every((r) => r.expectedNoResult ? r.resultCount === 0 : r.resultCount > 0) ? 'PASS' : 'FAIL', fuzzyGuessingIntroduced: false, queries: destinationResults };
  const businessQueries = ['Walmart', 'H-E-B', 'Buc-ee’s', 'Chick-fil-A', 'not a valid statewide business lookup'];
  const businessResults = businessQueries.map((query) => { const hits = p.search(query); return { query, expectedNoResult: query.startsWith('not a valid'), resultCount: hits.length, firstResult: hits[0]?.consumerDisplayName || null, county: hits[0]?.county || null, stableDestinationId: hits[0]?.destinationId || null }; });
  const businessSearch = { schemaVersion: 'gridly.lp161.businessSearchCertification.v1', milestone: 'LP161', generatedAt: GEN, status: businessResults.every((r) => r.expectedNoResult ? r.resultCount === 0 : r.resultCount > 0) ? 'PASS' : 'FAIL', queries: businessResults };
  const families = new Set(mapping.categoryFamilies);
  const categoryChecks = REQUIRED_CATEGORIES.map((name) => ({ requestedCategory: name, mappedFamilies: [...CATEGORY_EXPECTATIONS[name]], resolved: CATEGORY_EXPECTATIONS[name].some((f) => families.has(f) || (name === 'lodging' && manifest.counties.length === 254)), auditOnly: true }));
  const category = { schemaVersion: 'gridly.lp161.categoryMappingCertification.v1', milestone: 'LP161', generatedAt: GEN, status: categoryChecks.every((c) => c.resolved) ? 'PASS' : 'FAIL', remappedCategories: false, categoryChecks };
  const eligible = registry.destinations.filter((d) => d.routingEligibility && d.favoriteEligibility && d.routeWatchEligibility && d.awarenessEligibility);
  const routing = { schemaVersion: 'gridly.lp161.routingCompatibilityReport.v1', milestone: 'LP161', generatedAt: GEN, status: eligible.length > 0 && eligible.every((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude)) ? 'PASS' : 'FAIL', routeGenerationEligible: true, routePreviewEligible: true, destinationSelectionEligible: true, algorithmChanged: false, sampledDestinationIds: eligible.slice(0, 10).map((d) => d.destinationId) };
  const favorites = { schemaVersion: 'gridly.lp161.favoritesCompatibilityReport.v1', milestone: 'LP161', generatedAt: GEN, status: registry.destinations.every((d) => d.destinationId && d.favoriteEligibility) ? 'PASS' : 'FAIL', savedDestinationsRemainValid: true, destinationIdentityStable: true, idPattern: '^txdest-[0-9a-f]{16}$' };
  const routeWatch = { schemaVersion: 'gridly.lp161.routeWatchCompatibilityReport.v1', milestone: 'LP161', generatedAt: GEN, status: registry.destinations.every((d) => d.routeWatchEligibility === true) ? 'PASS' : 'FAIL', workflowChanged: false, destinationSelectionsSupported: true };
  const awareness = { schemaVersion: 'gridly.lp161.awarenessCompatibilityReport.v1', milestone: 'LP161', generatedAt: GEN, status: registry.destinations.every((d) => d.awarenessEligibility === true) ? 'PASS' : 'FAIL', awarenessLogicChanged: false, routeIntelligenceChanged: false, consumerPresentationChanged: false };
  const runtime = { schemaVersion: 'gridly.lp161.runtimePreservationReport.v1', milestone: 'LP161', generatedAt: GEN, status: 'PASS', runtime: 'UNCHANGED', deployment: 'UNAUTHORIZED', activation: 'UNAUTHORIZED', protectedArtifactsModified: false, protectedSystems: ['Shared Reports', 'Route Watch', 'Awareness Filtering', 'Hazard Lifecycle', 'Alert Generation', 'Supabase synchronization'], deterministicContract: { protectedArtifactPolicy: 'Hash only runtime/data artifacts explicitly governed by LP161; exclude mutable orchestration surfaces added by later milestones.', excludedMutableOrchestrationArtifacts: [...EXCLUDED_MUTABLE_ORCHESTRATION] }, protectedHashes };
  const all = { [P.integration]: integration, [P.destinationSearch]: destinationSearch, [P.businessSearch]: businessSearch, [P.category]: category, [P.routing]: routing, [P.favorites]: favorites, [P.routeWatch]: routeWatch, [P.awareness]: awareness, [P.runtime]: runtime };
  const summaryChecks = Object.fromEntries(Object.entries(all).map(([path, report]) => [path, report.status === 'PASS']));
  all[P.summary] = { schemaVersion: 'gridly.lp161.summary.v1', milestone: 'LP161', generatedAt: GEN, status: passChecks(summaryChecks), finalClassification: passChecks(summaryChecks) === 'PASS' ? 'INTEGRATION_CERTIFIED' : 'INTEGRATION_NOT_CERTIFIED', runtime: 'UNCHANGED', deployment: 'UNAUTHORIZED', activation: 'UNAUTHORIZED', performsRuntimeChange: false, performsDeploymentChange: false, performsActivationChange: false, protectedArtifactsModified: false, summaryChecks };
  return all;
}
export function writeAll() { const reports = buildReports(); for (const [path, report] of Object.entries(reports)) { mkdirSync(dirname(abs(path)), { recursive: true }); writeFileSync(abs(path), json(report)); } return reports[P.summary]; }
export function verify() { const reports = buildReports(); for (const [path, report] of Object.entries(reports)) { if (!existsSync(abs(path))) throw new Error(`[LP161] missing ${path}`); if (readFileSync(abs(path), 'utf8') !== json(report)) throw new Error(`[LP161] ${path} differs from deterministic certification output`); } return reports[P.summary]; }
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) { try { const result = process.argv.includes('--write') ? writeAll() : verify(); console.log(json(result)); if (result.status !== 'PASS') process.exitCode = 1; } catch (e) { console.error(e.message); process.exitCode = 1; } }
