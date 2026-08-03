import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const ROOT = new URL('../../', import.meta.url);
const inventoryUrl = new URL('data/lp104/texas-counties.json', ROOT);
const defaultOutput = new URL('evidence/lp124/texas-statewide-government-evidence-batch.json', ROOT);
const sourceUrl = 'https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:48';
const observationDate = process.env.LP124_OBSERVATION_DATE || new Date().toISOString().slice(0, 10);
const id = (kind, fips) => `lp124-${kind}-${fips}`;

export async function buildBatch({ acquire = true, output = defaultOutput } = {}) {
  const inventory = JSON.parse(await readFile(inventoryUrl));
  let censusRows = null;
  let access = 'SOURCE_UNAVAILABLE';
  if (acquire) {
    try {
      const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'Gridly-LP124-evidence-acquisition/1.0' } });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      censusRows = await response.json();
      access = 'AVAILABLE';
    } catch {
      // Access errors are governed as SOURCE_UNAVAILABLE; no inaccessible assertion is accepted.
    }
  }
  const census = new Map();
  if (censusRows) {
    const [header, ...rows] = censusRows;
    const nameIndex = header.indexOf('NAME');
    const stateIndex = header.indexOf('state');
    const countyIndex = header.indexOf('county');
    for (const row of rows) census.set(`${row[stateIndex]}${row[countyIndex]}`, row[nameIndex]);
  }
  const workUnits = inventory.counties.map(({ countyName, fips }) => {
    const officialName = census.get(fips);
    const acquired = typeof officialName === 'string' && officialName === `${countyName} County, Texas`;
    const outcome = acquired ? 'EVIDENCE_ACQUIRED' : access === 'AVAILABLE' ? 'REVIEW_REQUIRED' : 'SOURCE_UNAVAILABLE';
    const evidenceRecordIds = acquired ? [id('government-county-identity', fips)] : [];
    return {
      workUnitId: id('county', fips), county: `${countyName} County`, countyFips: fips,
      evidenceClass: 'GOVERNMENT', terminalOutcome: outcome,
      checkpoint: { stage: 'TERMINAL', resumable: true, attemptCount: 1, observedOn: observationDate },
      evidenceRecordIds,
      unresolved: acquired ? [] : [{ field: 'officialName', value: null, reason: outcome }],
    };
  });
  const records = workUnits.flatMap((unit) => unit.terminalOutcome === 'EVIDENCE_ACQUIRED' ? [{
    recordId: id('government-county-identity', unit.countyFips), evidenceClass: 'GOVERNMENT',
    county: unit.county, countyFips: unit.countyFips, assertionType: 'COUNTY_GOVERNMENT_IDENTITY',
    officialName: census.get(unit.countyFips), sourcePublisher: 'United States Census Bureau', sourceUrl,
    observationDate, evidenceDate: '2020-04-01', sourcePriority: 'SECONDARY', confidence: 'MEDIUM',
    reviewStatus: 'PENDING_REVIEW', reviewer: null, acquisitionMethod: 'OFFICIAL_API',
    countyContainment: { status: 'CONFIRMED', method: 'OFFICIAL_STATE_AND_COUNTY_FIPS_RELATIONSHIP', countyFips: unit.countyFips },
    candidateApproval: false, productionAuthorization: false, runtimeEligible: false,
  }] : []);
  const countBy = (items, key, values) => Object.fromEntries(values.map((value) => [value, items.filter((item) => item[key] === value).length]));
  const terminalValues = ['EVIDENCE_ACQUIRED', 'NO_EVIDENCE_FOUND', 'SOURCE_UNAVAILABLE', 'BLOCKED', 'REVIEW_REQUIRED', 'FAIL'];
  const batch = {
    schemaVersion: 'gridly-lp124-government-evidence-v1', milestone: 'LP124', baselineCommit: '334b7cc8',
    evidenceClass: 'GOVERNMENT', observationDate, immutable: true, candidateOnly: true,
    runtimeModified: false, countiesActivated: false, candidateApproval: false, productionAuthorization: false,
    acquisitionPolicy: { deterministic: true, idempotent: true, resumable: true, checkpointed: true, rateLimit: { maxConcurrentRequests: 1, requestsPerBatch: 1 }, runtimeIsolated: true },
    authoritativeCountyInventory: { path: 'data/lp104/texas-counties.json', count: inventory.count, publisher: 'United States Census Bureau', role: 'PACKAGED_CONTROL_LIST' },
    sources: [{ sourceId: 'us-census-2020-pl-texas-counties', publisher: 'United States Census Bureau', exactUrl: sourceUrl, authority: 'FEDERAL_GOVERNMENT', priority: 'SECONDARY', acquisitionMethod: 'OFFICIAL_API', observedOn: observationDate, accessStatus: access, supports: ['COUNTY_GOVERNMENT_IDENTITY', 'COUNTY_FIPS_CONTAINMENT'], ownerPrerequisite: access === 'AVAILABLE' ? null : 'Run the LP124 builder where HTTPS access to api.census.gov is permitted.' }],
    workUnits, records,
    summary: {
      countyWorkUnitCount: workUnits.length, terminalOutcomes: countBy(workUnits, 'terminalOutcome', terminalValues),
      acceptedEvidenceCount: records.length,
      assertionTypes: countBy(records, 'assertionType', ['COUNTY_GOVERNMENT_IDENTITY']),
      confidence: countBy(records, 'confidence', ['HIGH', 'MEDIUM', 'LOW', 'REVIEW_REQUIRED']),
      reviewStatus: countBy(records, 'reviewStatus', ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUIRED']),
      sourcePriority: countBy(records, 'sourcePriority', ['PRIMARY', 'SECONDARY', 'FALLBACK', 'UNSUPPORTED']),
    },
  };
  batch.seal = { algorithm: 'SHA-256', canonicalPayloadHash: createHash('sha256').update(JSON.stringify(batch)).digest('hex') };
  await mkdir(new URL('.', output), { recursive: true });
  await writeFile(output, `${JSON.stringify(batch, null, 2)}\n`);
  return batch;
}

if (import.meta.url === `file://${process.argv[1]}`) await buildBatch({ acquire: !process.argv.includes('--source-unavailable') });
