#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { P as LP153 } from '../lp153/execute-statewide-operations.mjs';
import { canonicalJsonEqual, gitBlobBytes, protectedHashes } from '../lp151/validate-statewide-operations.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATED_AT = '1970-01-01T00:00:00.000Z';
const P = {
  lp153Registry: LP153.executionRegistry,
  consumerChecklist: 'data/lp154/statewide-consumer-experience-checklist.json',
  certificationMatrix: 'reports/lp154/county-consumer-experience-matrix.json',
  addressReport: 'reports/lp154/address-search-certification-report.json',
  businessReport: 'reports/lp154/business-search-certification-report.json',
  routingReport: 'reports/lp154/destination-routing-certification-report.json',
  routeWatchReport: 'reports/lp154/route-watch-certification-report.json',
  notificationReport: 'reports/lp154/notification-quality-certification-report.json',
  crossingReport: 'reports/lp154/crossing-experience-certification-report.json',
  hazardReport: 'reports/lp154/hazard-experience-certification-report.json',
  communityReport: 'reports/lp154/community-experience-certification-report.json',
  searchIntelligenceReport: 'reports/lp154/search-intelligence-certification-report.json',
  launchReadiness: 'reports/lp154/final-launch-readiness-assessment.json',
  summary: 'reports/lp154/consumer-experience-summary.json'
};
const AREAS = [
  ['addressSearch','CE-1','Statewide Address Search Certification',['exact address lookup','rural addresses','County Roads','FM Roads','State Highways','US Highways','Interstate addresses','apartment/unit handling where supported','truthful No Results','no interpolation','no nearby substitutions']],
  ['businessSearch','CE-2','Statewide Business Search Certification',['grocery','fuel','medical','restaurants','hotels','retail','government','schools','parks','representative brands']],
  ['destinationRouting','CE-3','Destination Routing Certification',['route generation','route preview','route recalculation','route persistence','route clearing']],
  ['routeWatch','CE-4','Route Watch Certification',['hazards affecting the route','railroad crossings affecting the route','weather affecting the route','route-aware updates','off-route filtering']],
  ['notificationQuality','CE-5','Notification Relevance Certification',['what happened','where','how recent','how reliable','meaningful roads/highways/intersections/communities/landmarks','no private/unknown/unnamed/internal terminology']],
  ['crossingExperience','CE-6','Crossing Experience Certification',['searchable crossings','consumer-friendly names','correct placement','awareness integration','route integration']],
  ['hazardExperience','CE-7','Hazard Experience Certification',['hazard placement','consumer wording','confidence messaging','freshness','trust messaging','confirmation flow','cleared state']],
  ['communityExperience','CE-8','Community Experience Certification',['reporting','Confirm Still Active','Mark Cleared','participation acknowledgement','trust messaging']],
  ['searchIntelligence','CE-9','Search Intelligence Certification',['addresses','businesses','communities','roads','landmarks','partial names','common misspellings','brand aliases']]
];
function abs(path) { return resolve(ROOT, path); }
function readJson(path) { return JSON.parse(readFileSync(abs(path), 'utf8')); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => (out[key] = stable(value[key]), out), {}); return value; }
function stableJson(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function shaText(text) { return createHash('sha256').update(text).digest('hex'); }
function shaGit(path) { return createHash('sha256').update(gitBlobBytes(path)).digest('hex'); }
function fail(message) { throw new Error(`[LP154] ${message}`); }
function statusFor(county, area) {
  if (county.countyName === 'Liberty County') return 'BENCHMARK_CERTIFIED';
  if (!county.currentOperational) return 'NOT_LAUNCH_READY_NOT_EVALUATED';
  return 'CERTIFICATION_REQUIRED_AGAINST_LIBERTY';
}
function buildArtifacts() {
  const source = readJson(P.lp153Registry);
  const protectedArtifactHashes = { ...protectedHashes(), lp153Registry: shaGit(P.lp153Registry) };
  const counties = source.counties.map((county) => {
    const areas = Object.fromEntries(AREAS.map(([key, id, title, checks]) => [key, { id, title, status: statusFor(county, key), benchmark: 'Liberty County', checks }]));
    const launchBlockers = county.currentOperational && county.countyName !== 'Liberty County' ? ['Requires county-specific consumer experience evidence before public launch'] : [];
    return { fips: county.fips, countyName: county.countyName, launchReadyCandidate: county.currentOperational, libertyBenchmark: county.countyName === 'Liberty County', areas, launchBlockers, goNoGo: launchBlockers.length ? 'NO_GO_PENDING_CERTIFICATION' : county.countyName === 'Liberty County' ? 'GO_BENCHMARK' : 'NOT_IN_LAUNCH_READY_COHORT' };
  });
  const operational = counties.filter(c => c.launchReadyCandidate);
  const checklist = { schemaVersion: 'gridly.lp154.consumerExperienceChecklist.v1', milestone: 'LP154', generatedAt: GENERATED_AT, benchmarkCounty: 'Liberty', philosophy: ['Awareness Platform First','Route Intelligence Second','Audit First','Patch Second'], constraints: ['no operational runtime expansion','no deployment authorization change','no activation authorization change','no certified address package rebuild','no runtime certificate rebuild','no protected system modification','no framework introduction','no infrastructure governance layer'], certificationAreas: AREAS.map(([key,id,title,checks]) => ({ key,id,title,checks })) };
  const matrix = { schemaVersion: 'gridly.lp154.countyConsumerExperienceMatrix.v1', milestone: 'LP154', generatedAt: GENERATED_AT, sourceRegistry: P.lp153Registry, benchmarkCounty: 'Liberty', evaluatedCountyCount: counties.length, launchReadyCandidateCount: operational.length, counties };
  function areaReport(key, title) { const rows = counties.map(c => ({ fips: c.fips, countyName: c.countyName, launchReadyCandidate: c.launchReadyCandidate, status: c.areas[key].status, checks: c.areas[key].checks, blockers: c.launchBlockers })); return { schemaVersion: `gridly.lp154.${key}.v1`, milestone: 'LP154', generatedAt: GENERATED_AT, title, benchmarkCounty: 'Liberty', passed: rows.every(r => !r.launchReadyCandidate || r.status === 'BENCHMARK_CERTIFIED'), certificationStatus: rows.some(r => r.launchReadyCandidate && r.status !== 'BENCHMARK_CERTIFIED') ? 'NO_GO_PENDING_COUNTY_EVIDENCE' : 'GO', rows }; }
  const reports = Object.fromEntries(AREAS.map(([key,,title]) => [key, areaReport(key, title)]));
  const launchBlockers = operational.filter(c => c.goNoGo !== 'GO_BENCHMARK').map(c => ({ fips: c.fips, countyName: c.countyName, blockers: c.launchBlockers }));
  const launchReadiness = { schemaVersion: 'gridly.lp154.finalLaunchReadinessAssessment.v1', milestone: 'LP154', generatedAt: GENERATED_AT, passed: launchBlockers.length === 0, recommendation: launchBlockers.length === 0 ? 'GO' : 'NO_GO', reason: launchBlockers.length === 0 ? 'All launch-ready counties match the Liberty benchmark.' : 'Operational counties lack county-specific consumer experience certification evidence.', launchBlockers };
  const summary = { schemaVersion: 'gridly.lp154.consumerExperienceSummary.v1', milestone: 'LP154', generatedAt: GENERATED_AT, passed: launchReadiness.passed, recommendation: launchReadiness.recommendation, performsDeployment: false, performsActivation: false, expandsOperationalRuntime: false, modifiesProtectedSystems: false, benchmarkCounty: 'Liberty', evaluatedCountyCount: counties.length, launchReadyCandidateCount: operational.length, blockedLaunchReadyCandidateCount: launchBlockers.length, protectedArtifactHashes };
  for (const [name, obj] of [['consumerChecklist',checklist],['certificationMatrix',matrix],['launchReadiness',launchReadiness], ...Object.entries(reports)]) summary[`${name}Sha256`] = shaText(stableJson(obj));
  return { checklist, matrix, reports, launchReadiness, summary };
}
function writeAll() { const a = buildArtifacts(); const entries = [[P.consumerChecklist,a.checklist],[P.certificationMatrix,a.matrix],[P.launchReadiness,a.launchReadiness],[P.addressReport,a.reports.addressSearch],[P.businessReport,a.reports.businessSearch],[P.routingReport,a.reports.destinationRouting],[P.routeWatchReport,a.reports.routeWatch],[P.notificationReport,a.reports.notificationQuality],[P.crossingReport,a.reports.crossingExperience],[P.hazardReport,a.reports.hazardExperience],[P.communityReport,a.reports.communityExperience],[P.searchIntelligenceReport,a.reports.searchIntelligence],[P.summary,a.summary]]; for (const [p,o] of entries) { mkdirSync(dirname(abs(p)), { recursive: true }); writeFileSync(abs(p), stableJson(o)); } return a.summary; }
function verify() { const a = buildArtifacts(); const entries = [[P.consumerChecklist,a.checklist],[P.certificationMatrix,a.matrix],[P.launchReadiness,a.launchReadiness],[P.addressReport,a.reports.addressSearch],[P.businessReport,a.reports.businessSearch],[P.routingReport,a.reports.destinationRouting],[P.routeWatchReport,a.reports.routeWatch],[P.notificationReport,a.reports.notificationQuality],[P.crossingReport,a.reports.crossingExperience],[P.hazardReport,a.reports.hazardExperience],[P.communityReport,a.reports.communityExperience],[P.searchIntelligenceReport,a.reports.searchIntelligence],[P.summary,a.summary]]; for (const [p,o] of entries) if (!canonicalJsonEqual(readFileSync(abs(p),'utf8'), stableJson(o))) fail(`${p} differs from deterministic rebuild`); return a.summary; }
export { P, AREAS, buildArtifacts, stableJson, writeAll, verify };
if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { try { console.log(JSON.stringify(process.argv.includes('--write') ? writeAll() : verify(), null, 2)); } catch (e) { console.error(e.message); process.exit(1); } }
