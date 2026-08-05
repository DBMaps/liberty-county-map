#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { P as LP154 } from '../lp154/certify-consumer-experience.mjs';
import { canonicalJsonEqual, gitBlobBytes, protectedHashes } from '../lp151/validate-statewide-operations.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATED_AT = '1970-01-01T00:00:00.000Z';
const P = {
  lp154Matrix: LP154.certificationMatrix,
  executionPlan: 'data/lp155/statewide-consumer-evidence-execution-plan.json',
  addressReport: 'reports/lp155/statewide-address-evidence-report.json',
  businessReport: 'reports/lp155/business-search-evidence-report.json',
  routingReport: 'reports/lp155/destination-routing-evidence-report.json',
  routeWatchReport: 'reports/lp155/route-watch-evidence-report.json',
  notificationReport: 'reports/lp155/notification-quality-evidence-report.json',
  crossingReport: 'reports/lp155/railroad-crossing-experience-report.json',
  hazardReport: 'reports/lp155/hazard-experience-report.json',
  communityReport: 'reports/lp155/community-experience-report.json',
  gapMatrix: 'reports/lp155/statewide-launch-gap-matrix.json',
  readinessMatrix: 'reports/lp155/county-readiness-matrix.json',
  blockerRegister: 'reports/lp155/launch-blocker-register.json',
  correctiveActionRegister: 'reports/lp155/corrective-action-register.json',
  finalAssessment: 'reports/lp155/final-statewide-consumer-readiness-assessment.json',
  summary: 'reports/lp155/statewide-consumer-evidence-summary.json'
};
const FEATURES = [
  ['address','CEE-1','Address Search',['exact address lookup','County Roads','FM Roads','State Highways','US Highways','Interstate addresses','rural addressing','apartment/unit handling where supported','truthful No Results']],
  ['business','CEE-2','Business Search',['grocery','fuel','medical','retail','restaurants','hotels','schools','government','parks','Walmart','H-E-B','Buc-ee\'s','Lowe\'s','Home Depot','Starbucks','Chick-fil-A','CVS','Walgreens']],
  ['routing','CEE-3','Destination Routing',['destination creation','route generation','route persistence','recalculation','clearing routes']],
  ['routeWatch','CEE-4','Route Watch',['hazards affecting route','railroad crossings affecting route','weather affecting route','route-aware filtering','update behavior']],
  ['notifications','CEE-5','Notification Quality',['what happened','where','how recent','why it matters','no private/unknown/internal labels']],
  ['crossings','CEE-6','Railroad Crossing Experience',['searchability','naming','placement','awareness integration','route integration']],
  ['hazards','CEE-7','Hazard Experience',['placement','wording','confidence messaging','confirmation flow','cleared state','consumer readability']],
  ['community','CEE-8','Community Experience',['reporting','Confirm Still Active','Mark Cleared','trust messaging','participation messaging']]
];
function abs(path) { return resolve(ROOT, path); }
function readJson(path) { return JSON.parse(readFileSync(abs(path), 'utf8')); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => (out[key] = stable(value[key]), out), {}); return value; }
function stableJson(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function shaText(text) { return createHash('sha256').update(text).digest('hex'); }
function shaGit(path) { return createHash('sha256').update(gitBlobBytes(path)).digest('hex'); }
function fail(message) { throw new Error(`[LP155] ${message}`); }
function countyStatus(county, feature) {
  if (county.libertyBenchmark) return { status: 'PASS', evidence: 'LP154 Liberty benchmark certification; LP155 does not infer parity for any other county.' };
  return { status: 'NOT TESTED', evidence: 'No LP155 real-world county consumer execution evidence captured.' };
}
function buildArtifacts() {
  const source = readJson(P.lp154Matrix);
  const counties = source.counties.map(c => ({ fips: c.fips, countyName: c.countyName, libertyBenchmark: c.libertyBenchmark }));
  const executionPlan = { schemaVersion: 'gridly.lp155.consumerEvidenceExecutionPlan.v1', milestone: 'LP155', generatedAt: GENERATED_AT, philosophy: ['Awareness Platform First','Route Intelligence Second','Audit First','Patch Second'], constraints: ['does not expand operational runtime','does not authorize deployment','does not authorize activation','does not rebuild certified address packages','does not rebuild runtime certificates','does not modify protected infrastructure','does not introduce frameworks'], benchmarkCounty: 'Liberty', requiredFeatures: FEATURES.map(([key,id,title,checks]) => ({ key,id,title,checks })), passPolicy: 'PASS requires captured county-specific evidence; no inferred PASS results are allowed.' };
  const rows = counties.map((county) => {
    const statuses = Object.fromEntries(FEATURES.map(([key]) => [key, countyStatus(county, key).status]));
    const launchReady = Object.values(statuses).every(v => v === 'PASS') ? 'YES' : 'NO';
    return { fips: county.fips, countyName: county.countyName, ...statuses, launchReady };
  });
  function report(key, id, title, checks) {
    const evidenceRows = counties.map(county => ({ fips: county.fips, countyName: county.countyName, benchmarkComparison: county.libertyBenchmark ? 'LIBERTY_REFERENCE' : 'NOT_COMPARED_WITH_EXECUTED_EVIDENCE', ...countyStatus(county, key), checks }));
    return { schemaVersion: `gridly.lp155.${key}EvidenceReport.v1`, milestone: 'LP155', id, generatedAt: GENERATED_AT, title, benchmarkCounty: 'Liberty', passPolicy: executionPlan.passPolicy, rows: evidenceRows };
  }
  const reports = Object.fromEntries(FEATURES.map(f => [f[0], report(...f)]));
  const readinessRows = rows.map(row => { const missing = FEATURES.filter(([key]) => row[key] !== 'PASS').map(([key,id,title]) => ({ id, feature: title, status: row[key] })); const classification = row.launchReady === 'YES' ? 'Launch Ready' : missing.length <= 2 ? 'Conditionally Ready' : 'Not Ready'; return { fips: row.fips, countyName: row.countyName, classification, supportingEvidence: row.countyName === 'Liberty County' ? ['All LP155 feature statuses are PASS via Liberty benchmark evidence.'] : ['One or more LP155 consumer features lack executed county-specific evidence.'], missingEvidence: missing }; });
  const blockerRegister = { schemaVersion: 'gridly.lp155.launchBlockerRegister.v1', milestone: 'LP155', generatedAt: GENERATED_AT, blockers: FEATURES.map(([key,id,title]) => ({ id: `${id}-BLOCKER`, feature: title, severity: key === 'address' || key === 'routing' || key === 'notifications' ? 'HIGH' : 'MEDIUM', affectedCounties: rows.filter(r => r[key] !== 'PASS').map(r => ({ fips: r.fips, countyName: r.countyName, status: r[key] })), recommendedCorrectiveAction: `Execute and record county-specific ${title} consumer validation; patch only verified consumer-facing defects.` })) };
  const correctiveActionRegister = { schemaVersion: 'gridly.lp155.correctiveActionRegister.v1', milestone: 'LP155', generatedAt: GENERATED_AT, actions: blockerRegister.blockers.map(b => ({ blockerId: b.id, action: b.recommendedCorrectiveAction, requiredEvidence: 'Before changing status to PASS, attach executed query/route/notification/community evidence for each affected county.', prohibitedActions: executionPlan.constraints })) };
  const finalAssessment = { schemaVersion: 'gridly.lp155.finalStatewideConsumerReadinessAssessment.v1', milestone: 'LP155', generatedAt: GENERATED_AT, recommendation: rows.every(r => r.launchReady === 'YES') ? 'GO' : 'NO_GO', answer: 'Every non-Liberty Texas county still needs executed consumer-facing evidence before Gridly can claim Liberty County-quality statewide launch readiness.', launchReadyCountyCount: rows.filter(r => r.launchReady === 'YES').length, notReadyCountyCount: rows.filter(r => r.launchReady !== 'YES').length, blockerCount: blockerRegister.blockers.reduce((n,b) => n + b.affectedCounties.length, 0) };
  const gapMatrix = { schemaVersion: 'gridly.lp155.statewideLaunchGapMatrix.v1', milestone: 'LP155', generatedAt: GENERATED_AT, values: ['PASS','FAIL','NOT TESTED'], counties: rows };
  const readinessMatrix = { schemaVersion: 'gridly.lp155.countyReadinessMatrix.v1', milestone: 'LP155', generatedAt: GENERATED_AT, counties: readinessRows };
  const summary = { schemaVersion: 'gridly.lp155.consumerEvidenceSummary.v1', milestone: 'LP155', generatedAt: GENERATED_AT, performsDeployment: false, performsActivation: false, expandsOperationalRuntime: false, modifiesProtectedSystems: false, evaluatedCountyCount: counties.length, protectedArtifactHashes: { ...protectedHashes(), lp154Matrix: shaGit(P.lp154Matrix) } };
  for (const [name,obj] of [['executionPlan',executionPlan],['gapMatrix',gapMatrix],['readinessMatrix',readinessMatrix],['blockerRegister',blockerRegister],['correctiveActionRegister',correctiveActionRegister],['finalAssessment',finalAssessment], ...Object.entries(reports)]) summary[`${name}Sha256`] = shaText(stableJson(obj));
  return { executionPlan, reports, gapMatrix, readinessMatrix, blockerRegister, correctiveActionRegister, finalAssessment, summary };
}
const entries = a => [[P.executionPlan,a.executionPlan],[P.addressReport,a.reports.address],[P.businessReport,a.reports.business],[P.routingReport,a.reports.routing],[P.routeWatchReport,a.reports.routeWatch],[P.notificationReport,a.reports.notifications],[P.crossingReport,a.reports.crossings],[P.hazardReport,a.reports.hazards],[P.communityReport,a.reports.community],[P.gapMatrix,a.gapMatrix],[P.readinessMatrix,a.readinessMatrix],[P.blockerRegister,a.blockerRegister],[P.correctiveActionRegister,a.correctiveActionRegister],[P.finalAssessment,a.finalAssessment],[P.summary,a.summary]];
function writeAll() { const a = buildArtifacts(); for (const [p,o] of entries(a)) { mkdirSync(dirname(abs(p)), { recursive: true }); writeFileSync(abs(p), stableJson(o)); } return a.summary; }
function verify() { const a = buildArtifacts(); for (const [p,o] of entries(a)) if (!canonicalJsonEqual(readFileSync(abs(p),'utf8'), stableJson(o))) fail(`${p} differs from deterministic rebuild`); return a.summary; }
export { P, FEATURES, buildArtifacts, stableJson, writeAll, verify };
if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { try { console.log(JSON.stringify(process.argv.includes('--write') ? writeAll() : verify(), null, 2)); } catch (e) { console.error(e.message); process.exit(1); } }
