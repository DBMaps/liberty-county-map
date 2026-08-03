import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const EVIDENCE_CLASSES = ['COMMUNITY', 'DESTINATION', 'PUBLIC_SAFETY', 'HEALTHCARE', 'EDUCATION', 'TRANSPORTATION', 'PARK', 'GOVERNMENT'];
export const TERMINAL_OUTCOMES = ['EVIDENCE_ACQUIRED', 'NO_EVIDENCE_FOUND', 'SOURCE_UNAVAILABLE', 'BLOCKED', 'REVIEW_REQUIRED', 'FAIL', 'NOT_REGISTERED'];
export const DEFAULT_OUTPUT = 'evidence/lp126/texas-statewide-multi-class-evidence.json';

const readJson = async (root, file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const stable = value => value && typeof value === 'object'
  ? Array.isArray(value) ? value.map(stable) : Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
  : value;
export const seal = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

function lp122Record(kind, county, item, source) {
  const evidenceClass = kind === 'communityEvidence' ? 'COMMUNITY' : 'DESTINATION';
  const assertionType = kind === 'communityEvidence' ? 'COUNTY_SEAT_LOCALITY' : 'OFFICIAL_COUNTY_DESTINATION';
  return {
    recordId: `lp126-${evidenceClass.toLowerCase()}-${county.fips}-${seal([item.sourceId, item.name]).slice(0, 12)}`,
    evidenceClass, assertionType, county: county.county, countyFips: county.fips, officialName: item.name,
    sourcePublisher: source.publisher, sourceUrl: source.url, sourceArtifactSha256: null,
    observationDate: item.observedOn, evidenceDate: item.evidenceDate, sourcePriority: 'PRIMARY',
    confidence: item.confidence, reviewStatus: item.reviewStatus, reviewer: null,
    acquisitionMethod: 'REUSED_GOVERNED_LP122_EVIDENCE', jurisdictionLevel: kind === 'communityEvidence' ? 'LOCALITY' : 'COUNTY',
    countyContainment: { status: 'CONFIRMED', method: 'OFFICIAL_COUNTY_SOURCE_ASSERTION', countyFips: county.fips },
    optionalFields: { address: item.address ?? null, aliases: item.aliases ?? null, scopeNote: item.scopeNote ?? null },
    candidateApproval: false, productionAuthorization: false, runtimeEligible: false
  };
}

function lp125Record(record) {
  return {
    ...record, evidenceClass: 'PUBLIC_SAFETY', officialName: `${record.county} facility status`,
    sourceUrl: 'https://www.tcjs.state.tx.us/population-reports/', observationDate: '2026-08-03',
    evidenceDate: record.reportingDate, sourcePriority: 'PRIMARY', confidence: record.reviewStatus === 'REVIEW_REQUIRED' ? 'REVIEW_REQUIRED' : 'MEDIUM',
    reviewer: null, jurisdictionLevel: 'COUNTY',
    countyContainment: { status: record.reconciliationIssue ? 'UNRESOLVED' : 'CONFIRMED', method: 'COUNTY_FIPS_RECONCILIATION', countyFips: record.countyFips },
    optionalFields: { address: null, aliases: null, scopeNote: null },
    candidateApproval: false, productionAuthorization: false, runtimeEligible: false
  };
}

export async function manufacture({ root, classes = EVIDENCE_CLASSES, adapterFailure = null }) {
  const [control, registry, inventory, government, safety, wave1] = await Promise.all([
    readJson(root, 'data/lp104/texas-counties.json'), readJson(root, 'evidence/lp126/adapter-registry.json'),
    readJson(root, 'evidence/lp126/source-inventory.json'), readJson(root, 'evidence/lp124/texas-statewide-government-evidence-batch.json'),
    readJson(root, 'evidence/lp125/texas-statewide-county-jail-evidence.json'), readJson(root, 'evidence/lp122/wave-1-authoritative-community-destination-evidence.json')
  ]);
  if (control.count !== 254 || control.counties.length !== 254 || new Set(control.counties.map(c => c.fips)).size !== 254) throw new Error('LP104 control inventory must contain exactly 254 unique counties');
  const selected = EVIDENCE_CLASSES.filter(c => classes.includes(c));
  const governmentByFips = new Map(government.records.map(r => [r.countyFips, r]));
  const safetyByFips = new Map(safety.records.map(r => [r.countyFips, r]));
  const waveByFips = new Map(wave1.counties.map(r => [r.fips, r]));
  const sources = new Map(wave1.sources.map(s => [s.sourceId, s]));
  const records = [];
  const matrix = [];
  for (const county of control.counties) for (const evidenceClass of selected) {
    const name = `${county.countyName} County`; let added = []; let terminalOutcome = 'NOT_REGISTERED'; let unresolved = [];
    const adapter = registry.adapters.find(a => a.evidenceClass === evidenceClass);
    if (adapterFailure === evidenceClass) { terminalOutcome = 'FAIL'; unresolved = ['INJECTED_ADAPTER_FAILURE']; }
    else if (evidenceClass === 'GOVERNMENT') { const r = governmentByFips.get(county.fips); added = r ? [{ ...r, jurisdictionLevel: 'COUNTY', optionalFields: { address: null, aliases: null, scopeNote: null } }] : []; terminalOutcome = added.length ? 'EVIDENCE_ACQUIRED' : 'FAIL'; }
    else if (evidenceClass === 'PUBLIC_SAFETY') { const r = safetyByFips.get(county.fips); added = r ? [lp125Record(r)] : []; terminalOutcome = r?.reviewStatus === 'REVIEW_REQUIRED' ? 'REVIEW_REQUIRED' : added.length ? 'EVIDENCE_ACQUIRED' : 'FAIL'; unresolved = r?.reconciliationIssue ? [r.reconciliationIssue] : []; }
    else if (evidenceClass === 'COMMUNITY' || evidenceClass === 'DESTINATION') { const c = waveByFips.get(county.fips); const kind = evidenceClass === 'COMMUNITY' ? 'communityEvidence' : 'destinationEvidence'; added = (c?.[kind] ?? []).map(item => lp122Record(kind, c, item, sources.get(item.sourceId))); terminalOutcome = added.length ? 'REVIEW_REQUIRED' : 'SOURCE_UNAVAILABLE'; unresolved = c?.unresolved ?? ['STATEWIDE_GOVERNED_SOURCE_NOT_AVAILABLE']; }
    else if (adapter?.enabled) terminalOutcome = 'SOURCE_UNAVAILABLE';
    records.push(...added);
    matrix.push({ county: name, countyFips: county.fips, evidenceClass, terminalOutcome, acceptedRecordCount: added.length, unresolvedCount: unresolved.length, sourceIds: added.map(r => r.recordId.startsWith('lp124-') ? 'lp124-census-tiger-2025' : r.recordId.startsWith('lp125-') ? 'lp125-tcjs-workbook' : waveByFips.get(county.fips)?.[evidenceClass === 'COMMUNITY' ? 'communityEvidence' : 'destinationEvidence']?.[0]?.sourceId).filter(Boolean), checkpoint: { stage: 'TERMINAL', resumable: adapter?.resumable ?? false, adapterId: adapter?.adapterId ?? null }, candidateApproval: false, productionAuthorization: false, runtimeEligible: false });
  }
  const countBy = (items, key) => items.reduce((out, item) => (out[item[key]] = (out[item[key]] ?? 0) + 1, out), {});
  const outcomesByClass = Object.fromEntries(selected.map(c => [c, countBy(matrix.filter(x => x.evidenceClass === c), 'terminalOutcome')]));
  const acceptedRecordsByClass = Object.fromEntries(EVIDENCE_CLASSES.map(c => [c, records.filter(r => r.evidenceClass === c).length]));
  const body = { schemaVersion: 'gridly-lp126-statewide-multi-class-evidence-v1', milestone: 'LP126', observationDate: '2026-08-03', immutable: true,
    countyCount: 254, evidenceClasses: selected, matrixCellCount: matrix.length, adapterRegistry: 'evidence/lp126/adapter-registry.json', sourceInventory: 'evidence/lp126/source-inventory.json',
    matrix, records, summary: { outcomesByClass, outcomesByCounty: Object.fromEntries(control.counties.map(c => [c.fips, countBy(matrix.filter(x => x.countyFips === c.fips), 'terminalOutcome')])), acceptedRecordsByClass,
      assertionTypeCounts: countBy(records, 'assertionType'), confidenceCounts: countBy(records, 'confidence'), reviewStatusCounts: countBy(records, 'reviewStatus'), sourcePriorityCounts: countBy(records, 'sourcePriority'),
      sourceCoverage: inventory.sources.map(s => ({ sourceId: s.sourceId, coverageScope: s.coverageScope, completenessClaim: s.completenessClaim })), unresolvedAnomalies: [{ id: 'YOUNG_DUPLICATE_TCJS_ROWS', preserved: true }, { id: 'YOAKUM_MISSING_AT_LATEST_TCJS_DATE', preserved: true }],
      ownerPrerequisites: registry.adapters.filter(a => !a.enabled).map(a => ({ evidenceClass: a.evidenceClass, prerequisite: a.ownerPrerequisite })), adapterCoverage: registry.adapters.map(a => ({ adapterId: a.adapterId, evidenceClass: a.evidenceClass, implemented: a.enabled, governedSourceAvailable: a.governedSourceAvailable, acquisitionExecuted: selected.includes(a.evidenceClass) && a.enabled })),
      programStatus: { adapterImplemented: true, governedSourceAvailable: true, acquisitionExecuted: true, evidenceAcquired: records.length > 0, humanReviewPending: true, candidateApproved: false, productionAuthorized: false },
      productionBoundary: { runtimeModified: false, countiesActivated: false, evidenceUploaded: false, supabaseStorageMutated: false, deployed: false, protectedSystemsModified: false, candidateApproval: false, productionAuthorization: false } } };
  return { ...body, seal: { algorithm: 'SHA-256', value: seal(body) } };
}
