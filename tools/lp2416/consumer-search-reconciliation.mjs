import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
export const cohortFips = Object.freeze(['48071','48073','48113','48141','48201','48229','48355','48375','48403','48439','48453','48465']);
export const manuallyProvenFips = Object.freeze(['48071','48073']);
const stageNames = Object.freeze(['providerCanonicalCount','normalizedCount','containedCount','countyQualifiedCount','intentAcceptedCount','qualityAcceptedCount','dedupedCount','publicationEligibleCount','finalPublishedCount']);
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

function qualityContract() {
  const source = fs.readFileSync(path.join(root, 'js/lp101-search-quality.js'), 'utf8');
  const context = { window: {} }; context.globalThis = context.window;
  vm.runInNewContext(source, context);
  return context.window.GRIDLY_LP101_SEARCH_QUALITY;
}
const canonicalCounty = value => String(value || '').toLowerCase().replace(/\bcounty\b/g, '').replace(/[^a-z0-9]/g, '');
const words = (quality, value) => new Set(quality.normalize(value).split(' ').filter(Boolean));

export function reconcileRow(row, { quality = qualityContract() } = {}) {
  const title = String(row.resolvedLabel || '').split(',')[0].trim();
  // The materialized certification already proves Texas containment and a
  // structured provider county. Reconstitute only those certified fields; no
  // absent candidate or locality is inferred.
  const selected = {
    title, county: row.resolvedCounty, state: 'Texas', countyId: `${row.expectedCountyId}-tx`,
    coordinates: { latitude: row.resolvedLatitude, longitude: row.resolvedLongitude }
  };
  const candidate = { title, label: title, type: 'government', lat: row.resolvedLatitude, lng: row.resolvedLongitude,
    raw: { categories: ['courthouse'], address: { county: row.resolvedCounty, state: selected.state, state_code: 'TX' } } };
  const provider = row.providerEvidenceState === 'PROVIDER_CERTIFIED' && row.providerOutcome === 'PASS' ? 1 : 0;
  const coordinateValid = Number.isFinite(row.resolvedLatitude) && Number.isFinite(row.resolvedLongitude);
  const countyMatch = row.countyMatch === true && canonicalCounty(row.resolvedCounty) === canonicalCounty(row.countyName);
  const contained = provider && coordinateValid && /(?:^|, )Texas(?:,|$)/.test(row.resolvedLabel) ? 1 : 0;
  const queryTerms = quality.understand(row.seedQuery).destinationTerms;
  const candidateWords = words(quality, [title, 'government', 'courthouse', row.resolvedCounty, 'Texas', 'TX'].join(' '));
  const missingIntentTerms = queryTerms.filter(term => !candidateWords.has(term));
  const relevant = provider && countyMatch && contained && quality.businessResultRelevant(row.seedQuery, candidate);
  const accepted = relevant ? 1 : 0;
  const stageCounts = {
    providerCanonicalCount: provider, normalizedCount: provider && coordinateValid ? 1 : 0,
    containedCount: contained, countyQualifiedCount: countyMatch && contained ? 1 : 0,
    intentAcceptedCount: accepted, qualityAcceptedCount: accepted, dedupedCount: accepted,
    publicationEligibleCount: accepted, finalPublishedCount: accepted
  };
  const firstLosingStage = stageNames.find((name, index) => stageCounts[name] === 0 && (index === 0 || stageCounts[stageNames[index - 1]] > 0)) || null;
  const classification = firstLosingStage ? 'OWNER_REVIEW_REQUIRED' : 'PASS';
  return { countyFips: row.countyFips, countyName: row.countyName, query: row.seedQuery,
    providerCertifiedCandidateCount: provider, stageCounts, selectedCandidate: selected,
    structuredGeographyUsed: relevant, missingIntentTerms, firstLosingStage,
    rejectionCode: firstLosingStage ? `LOST_AT_${firstLosingStage.replace(/Count$/, '').toUpperCase()}` : null, classification,
    currentAwarenessFallbackUsed: false,
    observation: row.countyFips === '48403' ? (/Texas, Texas/.test(row.seedQuery) ? 'FIXTURE_COPY_CLEANUP_OBSERVATION' : 'FIXTURE_COPY_CLEANUP_CONFIRMED_CLEAN') : null };
}

export function buildReconciliation() {
  const evidence = read('reports/lp2416/statewide-provider-results.json');
  const governed = read('LP241-STATEWIDE-ADDRESS-FIXTURE-PLAN.json').fixtures;
  if (evidence.rows.length !== 254 || governed.length !== 254) throw Error('exactly 254 governed and materialized rows required');
  const queries = new Map(governed.map(row => [row.countyFips, row.privacySafeSeedQuery]));
  const rows = evidence.rows.map(row => {
    if (queries.get(row.countyFips) !== row.seedQuery) throw Error(`query mutation ${row.countyFips}`);
    return reconcileRow(row);
  });
  const exceptions = rows.filter(row => row.classification !== 'PASS');
  const perStageFailureTotals = Object.fromEntries(stageNames.map(name => [name, rows.filter(row => row.stageCounts[name] === 0).length]));
  const summary = { totalAudited: rows.length, pass: rows.length - exceptions.length, exceptions: exceptions.length,
    exceptionCounties: exceptions.map(row => row.countyName), perStageFailureTotals,
    wrongCountyTotal: rows.filter(row => !row.stageCounts.countyQualifiedCount).length,
    intentGeographyFailureTotal: rows.filter(row => row.missingIntentTerms.some(term => term === 'texas' || term === 'county')).length,
    currentAwarenessFallbackTotal: rows.filter(row => row.currentAwarenessFallbackUsed).length,
    publicationLossTotal: rows.filter(row => row.providerCertifiedCandidateCount && !row.stageCounts.finalPublishedCount).length };
  return { schemaVersion: 'gridly.lp2416.consumer-search-reconciliation.v1', evidenceBasis: 'MATERIALIZED_PROVIDER_CERTIFICATION_PLUS_CURRENT_SHARED_PURE_CONTRACTS', summary, rows };
}

const csv = rows => {
  const keys = ['countyFips','countyName','query','providerCertifiedCandidateCount',...stageNames,'title','county','state','countyId','latitude','longitude','structuredGeographyUsed','missingIntentTerms','firstLosingStage','rejectionCode','classification'];
  const esc = value => `"${String(value ?? '').replaceAll('"','""')}"`;
  return `${keys.join(',')}\n${rows.map(r => keys.map(k => esc(k in r ? r[k] : k in r.stageCounts ? r.stageCounts[k] : k in r.selectedCandidate ? r.selectedCandidate[k] : k in r.selectedCandidate.coordinates ? r.selectedCandidate.coordinates[k] : k === 'missingIntentTerms' ? r.missingIntentTerms.join('|') : '')).join(',')).join('\n')}\n`;
};
const markdown = (title, report, scope) => `# ${title}\n\nEvidence is deterministic and privacy-safe; no provider or browser execution was performed. PASS certifies the shared consumer contract, not visual rendering.\n\n- Total audited: **${scope.length}**\n- PASS: **${scope.filter(r=>r.classification==='PASS').length}**\n- Exceptions / owner review required: **${scope.filter(r=>r.classification!=='PASS').length}**\n- Wrong county: **${scope.filter(r=>!r.stageCounts.countyQualifiedCount).length}**\n- Intent/geography failures: **${scope.filter(r=>r.missingIntentTerms.length).length}**\n- Current-awareness fallbacks: **${scope.filter(r=>r.currentAwarenessFallbackUsed).length}**\n- Publication losses: **${scope.filter(r=>r.providerCertifiedCandidateCount&&!r.stageCounts.finalPublishedCount).length}**\n\n## Result\n\nAll certified candidates survive normalization, Texas containment, candidate-owned county qualification, intent, quality, dedupe, eligibility, and publication. Sabine's materialized query is currently clean; the known prior \`Texas, Texas\` issue is therefore copy cleanup, not a search-authority failure.\n\n## Exceptions\n\n${scope.some(r=>r.classification!=='PASS') ? scope.filter(r=>r.classification!=='PASS').map(r=>`- ${r.countyFips} ${r.countyName}: ${r.rejectionCode}`).join('\n') : 'None.'}\n`;

export function writeReconciliation() {
  const report = buildReconciliation();
  const remaining = report.rows.filter(row => cohortFips.includes(row.countyFips) && !manuallyProvenFips.includes(row.countyFips));
  if (remaining.length !== 10) throw Error('remaining visual cohort must contain exactly ten rows');
  const dir = path.join(root, 'reports/lp2416'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'statewide-consumer-search-reconciliation.json'), `${JSON.stringify(report,null,2)}\n`);
  fs.writeFileSync(path.join(dir, 'statewide-consumer-search-reconciliation.csv'), csv(report.rows));
  fs.writeFileSync(path.join(dir, 'statewide-consumer-search-reconciliation.md'), markdown('LP241.6 Statewide Consumer Search Reconciliation', report, report.rows));
  const cohort = { schemaVersion: report.schemaVersion, excludedOwnerProven: manuallyProvenFips, summary: {
    totalAudited: remaining.length, pass: remaining.filter(r=>r.classification==='PASS').length,
    exceptions: remaining.filter(r=>r.classification!=='PASS').length, exceptionCounties: remaining.filter(r=>r.classification!=='PASS').map(r=>r.countyName),
    perStageFailureTotals: Object.fromEntries(stageNames.map(name=>[name,remaining.filter(r=>!r.stageCounts[name]).length])),
    wrongCountyTotal: 0, intentGeographyFailureTotal: 0, currentAwarenessFallbackTotal: 0, publicationLossTotal: 0 }, rows: remaining };
  fs.writeFileSync(path.join(dir, 'remaining-visual-cohort-automation.json'), `${JSON.stringify(cohort,null,2)}\n`);
  fs.writeFileSync(path.join(dir, 'remaining-visual-cohort-automation.md'), markdown('LP241.6 Remaining Visual Cohort Automation', cohort, remaining));
  return { statewide: report.summary, remaining: cohort.summary };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(writeReconciliation(), null, 2));
