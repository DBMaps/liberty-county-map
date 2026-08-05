#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJsonEqual } from '../lp151/validate-statewide-operations.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATED_AT = '1970-01-01T00:00:00.000Z';
const P = {
  lp131Audit: 'evidence/lp131/statewide-readiness-audit.json',
  lp155Final: 'reports/lp155/final-statewide-consumer-readiness-assessment.json',
  plan: 'data/lp156/statewide-data-acquisition-plan.json',
  addressAssessment: 'reports/lp156/statewide-address-coverage-assessment.json',
  businessAssessment: 'reports/lp156/statewide-business-coverage-assessment.json',
  communityAssessment: 'reports/lp156/texas-community-coverage-assessment.json',
  crossingAssessment: 'reports/lp156/railroad-crossing-coverage-assessment.json',
  hazardAssessment: 'reports/lp156/hazard-intelligence-assessment.json',
  routeAssessment: 'reports/lp156/route-intelligence-assessment.json',
  notificationAssessment: 'reports/lp156/notification-context-assessment.json',
  searchAssessment: 'reports/lp156/search-intelligence-assessment.json',
  coverageMatrix: 'reports/lp156/statewide-coverage-matrix.json',
  acquisitionRegister: 'reports/lp156/data-acquisition-register.json',
  launchDependencyMatrix: 'reports/lp156/launch-dependency-matrix.json',
  finalAssessment: 'reports/lp156/final-statewide-data-readiness-assessment.json',
  summary: 'reports/lp156/statewide-data-readiness-summary.json'
};
const DOMAINS = [
  ['addresses','Statewide Address Coverage Assessment','TXGIO Texas statewide address packages','Statewide county package evidence exists, but 14 counties remain certification-blocked in LP131.','Ready with Monitoring','Critical Before Launch'],
  ['businesses','Statewide Business Coverage Assessment','Curated destination/business search datasets','LP131 reports missing curated destination search dataset evidence for 226 counties.','Requires Acquisition','Critical Before Launch'],
  ['communities','Texas Community Coverage Assessment','Runtime community manifest plus governed place labels','LP131 reports governed community labels for only 12 communities and missing community coverage in 251 counties.','Requires Acquisition','Critical Before Launch'],
  ['crossings','Railroad Crossing Coverage Assessment','FRA crossing source and production crossing packages','LP131 reports 3,771 production crossings and missing production crossing packages in 226 counties.','Requires Enrichment','Recommended Before Launch'],
  ['hazards','Hazard Intelligence Assessment','Gridly hazard reports, weather association, road-event/community report inputs','LP155 leaves non-Liberty hazard experience NOT TESTED; statewide live hazard source readiness is not evidenced.','Requires Enrichment','Recommended Before Launch'],
  ['routes','Route Intelligence Assessment','Route generation/persistence with hazard, crossing, and weather association','LP155 leaves non-Liberty destination routing and route-watch experience NOT TESTED.','Requires Enrichment','Recommended Before Launch'],
  ['notifications','Notification Context Assessment','Road, community, county, landmark, crossing, hazard, and route context','LP155 leaves non-Liberty notification quality NOT TESTED; generic private/unknown labels must be rejected.','Requires Acquisition','Critical Before Launch'],
  ['search','Search Intelligence Assessment','Address, business, community, landmark, alias, and misspelling indexes','LP131 and LP155 show destination/community/search evidence gaps outside Liberty.','Requires Acquisition','Critical Before Launch']
];
function abs(path) { return resolve(ROOT, path); }
function readJson(path) { return JSON.parse(readFileSync(abs(path), 'utf8')); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => (out[key] = stable(value[key]), out), {}); return value; }
function stableJson(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function shaObj(obj) { return createHash('sha256').update(stableJson(obj)).digest('hex'); }
function fail(message) { throw new Error(`[LP156] ${message}`); }
function buildArtifacts() {
  const audit = readJson(P.lp131Audit);
  const lp155 = readJson(P.lp155Final);
  const totals = audit.statewideSummary ?? audit.summary ?? {};
  const gaps = audit.gapSummary ?? audit.gaps ?? {};
  const evidence = { lp131: P.lp131Audit, lp155: P.lp155Final, lp131Totals: totals, lp131Gaps: gaps, lp155Recommendation: lp155.recommendation };
  const plan = { schemaVersion: 'gridly.lp156.statewideDataAcquisitionPlan.v1', milestone: 'LP156', generatedAt: GENERATED_AT, question: 'What information must Gridly possess in order to confidently serve every community in Texas?', principles: ['Awareness Platform First','Route Intelligence Second','Audit First','Patch Second','No speculative acquisitions','No duplicate datasets'], constraints: ['does not expand runtime','does not modify deployment','does not modify activation','does not rebuild certified packages','does not replace authoritative sources without evidence','does not introduce frameworks'], evidenceSources: [P.lp131Audit, P.lp155Final], requiredInformation: DOMAINS.map(([key,title,source]) => ({ domain: key, deliverable: title, authoritativeOrCurrentSource: source })) };
  const assessments = Object.fromEntries(DOMAINS.map(([key,title,source,finding,classification,dependency]) => [key, { schemaVersion: `gridly.lp156.${key}Assessment.v1`, milestone: 'LP156', generatedAt: GENERATED_AT, title, currentSource: source, evidence, findings: [finding], coverageCompleteness: classification === 'Ready with Monitoring' ? 'STATEWIDE_WITH_EXCEPTIONS' : 'PARTIAL_EVIDENCE_ONLY', launchDependency: dependency, dataQualityClassification: classification, conclusion: `${title}: ${classification}. ${finding}` }]));
  const coverageRows = DOMAINS.map(([key,,source,,classification,dependency]) => ({ domain: key, currentSource: source, coverage: classification === 'Ready with Monitoring' ? 'Statewide with documented exceptions' : 'Partial / needs expansion', refresh: key === 'addresses' ? 'Defined by TXGIO package refresh and certification workflow' : 'TBD during acquisition or enrichment', license: key === 'crossings' ? 'Authoritative public-source verification required per package' : 'Verified where existing repository evidence exists; acquisition rows require source license verification', launchReady: classification === 'Ready with Monitoring' ? 'CONDITIONAL' : 'NO', dataQualityClassification: classification, launchDependency: dependency }));
  const acquisitionRows = [
    ['Governed Texas community inventory','Cities, towns, CDPs, unincorporated communities, and applicable neighborhoods','Texas statewide','Authoritative statewide government/Census place source plus governed local aliases','Verify before ingestion','Scheduled source refresh plus governed alias review','P0','YES'],
    ['Statewide curated business/destination dataset','Consumer destination search and meaningful landmarks','Texas statewide','Authoritative/licensed POI provider or governed public-source compilation','Verify before acquisition','Provider/public-source refresh cadence with deterministic diff review','P0','YES'],
    ['Notification context enrichment dataset','Highway names, cross streets, communities, counties, landmarks; reject private/unknown labels','Texas statewide','Combination of governed roadway/community/landmark/crossing sources','Verify each component before ingestion','Refresh with source updates and notification wording audits','P0','YES'],
    ['Statewide production crossing package completion','Rail crossing awareness and route context outside currently evidenced counties','Texas statewide','FRA crossing inventory with governed county production packages','Verify FRA/public-source terms','Periodic FRA refresh and county package verification','P1','NO'],
    ['Hazard/weather/road-event intelligence feeds','Awareness map and route-watch confidence outside Liberty evidence','Texas statewide','Existing Gridly reports plus authoritative weather/road event sources where licensed','Verify before live use','Live/feed cadence plus confidence monitoring','P1','NO'],
    ['Search alias and misspelling enrichment','Address, business, community, and landmark search quality','Texas statewide','Derived governed aliases from acquired community/business/road datasets','Internal derivative policy after license review','Deterministic synonym/misspelling review per refresh','P1','NO']
  ].map(([dataset,purpose,geographicScope,authoritativeSource,license,refreshStrategy,priority,requiredBeforeLaunch]) => ({ dataset,purpose,geographicScope,authoritativeSource,license,refreshStrategy,priority,requiredBeforeLaunch }));
  const coverageMatrix = { schemaVersion: 'gridly.lp156.statewideCoverageMatrix.v1', milestone: 'LP156', generatedAt: GENERATED_AT, rows: coverageRows };
  const acquisitionRegister = { schemaVersion: 'gridly.lp156.dataAcquisitionRegister.v1', milestone: 'LP156', generatedAt: GENERATED_AT, rows: acquisitionRows };
  const launchDependencyMatrix = { schemaVersion: 'gridly.lp156.launchDependencyMatrix.v1', milestone: 'LP156', generatedAt: GENERATED_AT, rows: coverageRows.map(r => ({ dataset: r.domain, classification: r.launchDependency, rationale: r.dataQualityClassification })) };
  const finalAssessment = { schemaVersion: 'gridly.lp156.finalStatewideDataReadinessAssessment.v1', milestone: 'LP156', generatedAt: GENERATED_AT, recommendation: 'NO_GO_FOR_UNCONDITIONAL_STATEWIDE_DATA_READINESS', answer: 'Gridly must possess certified address coverage, governed community inventory, licensed/authoritative business and landmark coverage, production crossing coverage, hazard/weather/road-event intelligence, route associations, notification context, and search aliases for every Texas community. Current evidence supports a conditional address foundation but requires acquisition or enrichment for business, community, notification, search, crossing, hazard, and route intelligence before claiming Liberty County-quality statewide readiness.', criticalBeforeLaunch: acquisitionRows.filter(r => r.requiredBeforeLaunch === 'YES').map(r => r.dataset), evidenceSources: plan.evidenceSources };
  const summary = { schemaVersion: 'gridly.lp156.statewideDataReadinessSummary.v1', milestone: 'LP156', generatedAt: GENERATED_AT, performsRuntimeChange: false, performsDeploymentChange: false, performsActivationChange: false, rebuildsCertifiedPackages: false, domainCount: DOMAINS.length };
  const artifacts = { plan, assessments, coverageMatrix, acquisitionRegister, launchDependencyMatrix, finalAssessment, summary };
  for (const [k,v] of Object.entries({ plan, coverageMatrix, acquisitionRegister, launchDependencyMatrix, finalAssessment, ...assessments })) summary[`${k}Sha256`] = shaObj(v);
  return artifacts;
}
const entries = a => [[P.plan,a.plan],[P.addressAssessment,a.assessments.addresses],[P.businessAssessment,a.assessments.businesses],[P.communityAssessment,a.assessments.communities],[P.crossingAssessment,a.assessments.crossings],[P.hazardAssessment,a.assessments.hazards],[P.routeAssessment,a.assessments.routes],[P.notificationAssessment,a.assessments.notifications],[P.searchAssessment,a.assessments.search],[P.coverageMatrix,a.coverageMatrix],[P.acquisitionRegister,a.acquisitionRegister],[P.launchDependencyMatrix,a.launchDependencyMatrix],[P.finalAssessment,a.finalAssessment],[P.summary,a.summary]];
function writeAll() { const a = buildArtifacts(); for (const [p,o] of entries(a)) { mkdirSync(dirname(abs(p)), { recursive: true }); writeFileSync(abs(p), stableJson(o)); } return a.summary; }
function verify() { const a = buildArtifacts(); for (const [p,o] of entries(a)) if (!canonicalJsonEqual(readFileSync(abs(p),'utf8'), stableJson(o))) fail(`${p} differs from deterministic rebuild`); return a.summary; }
export { P, DOMAINS, buildArtifacts, stableJson, writeAll, verify };
if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { try { console.log(JSON.stringify(process.argv.includes('--write') ? writeAll() : verify(), null, 2)); } catch (e) { console.error(e.message); process.exit(1); } }
