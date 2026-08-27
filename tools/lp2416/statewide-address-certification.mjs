import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
const artifactJson = 'LP241-STATEWIDE-ADDRESS-FIXTURE-PLAN.json';
const artifactCsv = 'LP241-STATEWIDE-ADDRESS-FIXTURE-PLAN.csv';
const reportDir = 'reports/lp2416';
const localProgress = path.join(root, 'owner-local/lp2416/statewide-address-progress.json');
export const publicRequestContract = Object.freeze({
  endpoint:'https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-geocode',
  origin:'https://gridly.app',
  publicKey:'sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO'
});
const outcomes = ['PASS','NO_RESULT','WRONG_COUNTY','AMBIGUOUS_RESULT','PROVIDER_UNAVAILABLE','INVALID_COORDINATES','HANDOFF_FAILURE','MAP_FAILURE','UI_FAILURE','FIXTURE_REQUIRED','NOT_EXECUTED'];
const cohortFips = ['48201','48113','48439','48403','48141','48453','48375','48355','48073','48071','48229','48465'];
const riskClasses = {48201:'major metro',48113:'dense urban',48439:'suburban',48403:'rural east Texas',48141:'border',48453:'central Texas',48375:'panhandle',48355:'coastal',48073:'historically sensitive location context',48071:'multi-county community',48229:'sparse/frontier and west Texas',48465:'west Texas and border'};
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const csv = rows => { const keys = Object.keys(rows[0]); const esc = value => `"${String(value ?? '').replaceAll('"','""')}"`; return `${keys.join(',')}\n${rows.map(row => keys.map(key => esc(typeof row[key] === 'object' ? JSON.stringify(row[key]) : row[key])).join(',')).join('\n')}\n`; };
const canonical = value => String(value || '').toLowerCase().replace(/\bcounty\b/g, '').replace(/[^a-z0-9]/g, '');

export function classifyProviderResult(row, response) {
  if (!response || response.providerBoundary !== 'gridly') return 'PROVIDER_UNAVAILABLE';
  if (!response.ok) return response.status === 'no_results' ? 'NO_RESULT' : 'PROVIDER_UNAVAILABLE';
  if (!Array.isArray(response.results) || response.results.length === 0) return 'NO_RESULT';
  const result = response.results[0];
  const lat = Number(result.latitude), lon = Number(result.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 25 || lat > 37 || lon < -107 || lon > -93) return 'INVALID_COORDINATES';
  return canonical(result.address?.county) === canonical(row.expectedCountyName) ? 'PASS' : 'WRONG_COUNTY';
}

export function buildPlan() {
  const inventory = read('evidence/lp130/final-reconciliation.json').packageInventory;
  const destinations = read('data/lp158/texas-destination-registry.json').destinations;
  const courthouses = new Map(destinations.filter(x => x.subcategory === 'courthouse').map(x => [x.countyFips, x]));
  const fixtures = inventory.map(item => {
    const governed = courthouses.get(item.fips);
    const countyName = governed?.county || item.countyId.split('-').map(x => x[0].toUpperCase() + x.slice(1)).join(' ');
    const fixtureAvailable = Boolean(governed?.name && governed?.source === 'LP158 governed destination seed registry');
    return {
      countyFips:item.fips, countyName, expectedCountyId:item.countyId, expectedCountyName:countyName,
      privacySafeSeedQuery:fixtureAvailable ? `${governed.name}, ${countyName} County, Texas` : '',
      queryStrategy:fixtureAvailable ? 'GOVERNED_PUBLIC_COUNTY_COURTHOUSE' : 'FIXTURE_REQUIRED',
      executionState:'NOT_EXECUTED', providerOutcome:'NOT_EXECUTED', resolvedAddress:'', resolvedLatitude:null,
      resolvedLongitude:null, resolvedCounty:'', resolvedCommunity:'', countyMatch:null, handoffState:'NOT_EXECUTED',
      mapState:'NOT_EXECUTED', visualReviewState:cohortFips.includes(item.fips) ? 'OWNER_REVIEW_REQUIRED' : 'NOT_SELECTED',
      blockerClassification:fixtureAvailable ? 'NOT_EXECUTED' : 'FIXTURE_REQUIRED',
      notes:fixtureAvailable ? 'Public facility provenance: LP158 governed destination seed registry; provider and UI execution require owner authorization.' : 'No governed public fixture available; do not invent one.'
    };
  });
  return {schemaVersion:'gridly.lp2416.address-certification.v1', evidenceState:'STATIC_CERTIFIED', providerExecutionAuthorization:'READY_FOR_OWNER_AUTHORIZED_EXECUTION', generatedFrom:['evidence/lp130/final-reconciliation.json','data/lp158/texas-destination-registry.json'], deterministicOrder:'countyFips ascending', fixtureCount:fixtures.length, countyCount:fixtures.length, outcomes, fixtures};
}

export function verifyPlan(plan) {
  if (plan.fixtures.length !== 254) throw Error('expected exactly 254 county fixtures');
  const fips = new Set(), ids = new Set(), queries = new Set();
  for (const row of plan.fixtures) {
    if (!/^48\d{3}$/.test(row.countyFips) || fips.has(row.countyFips)) throw Error(`invalid/duplicate FIPS ${row.countyFips}`); fips.add(row.countyFips);
    if (!row.countyName || !row.expectedCountyId || !row.expectedCountyName || ids.has(row.expectedCountyId)) throw Error(`missing/duplicate governed identity ${row.countyFips}`); ids.add(row.expectedCountyId);
    if (!row.queryStrategy || !row.privacySafeSeedQuery || /^\s*County Courthouse, Texas\s*$/i.test(row.privacySafeSeedQuery)) throw Error(`unsafe/incomplete fixture ${row.countyFips}`);
    if (queries.has(canonical(row.privacySafeSeedQuery))) throw Error(`duplicate query ${row.countyFips}`); queries.add(canonical(row.privacySafeSeedQuery));
    if (!/GOVERNED_PUBLIC_/.test(row.queryStrategy)) throw Error(`privacy-safe governed strategy required ${row.countyFips}`);
  }
  if (plan.fixtures.some((row, index, rows) => index && rows[index - 1].countyFips >= row.countyFips)) throw Error('county order must be ascending FIPS');
  return true;
}

function writeArtifacts(plan) {
  fs.mkdirSync(path.join(root, reportDir), {recursive:true});
  fs.writeFileSync(path.join(root, artifactJson), `${JSON.stringify(plan,null,2)}\n`);
  fs.writeFileSync(path.join(root, artifactCsv), csv(plan.fixtures));
  const cohort = plan.fixtures.filter(x => cohortFips.includes(x.countyFips)).map(x => ({countyFips:x.countyFips,countyName:x.countyName,riskClass:riskClasses[x.countyFips],visualReviewState:x.visualReviewState}));
  fs.writeFileSync(path.join(root, `${reportDir}/visual-cohort.json`), `${JSON.stringify({fixed:true,count:cohort.length,rows:cohort},null,2)}\n`);
  const totals={totalCounties:254,executed:0,pass:0,noResult:0,wrongCounty:0,ambiguous:0,providerUnavailable:0,invalidCoordinate:0,handoffFailure:0,mapFailure:0,uiFailure:0,fixtureRequired:0,notExecuted:254};
  fs.writeFileSync(path.join(root, `${reportDir}/exception-ledger.json`), `${JSON.stringify({evidenceState:'NOT_EXECUTED',exceptionDefinition:'Every non-PASS row',count:254,exceptions:plan.fixtures.map(x=>({countyFips:x.countyFips,countyName:x.countyName,classification:'NOT_EXECUTED',visualReviewState:x.visualReviewState}))},null,2)}\n`);
  fs.writeFileSync(path.join(root, `${reportDir}/launch-classification.json`), `${JSON.stringify({staticCertification:'STATIC_CERTIFIED',providerExecution:'NOT_EXECUTED',ownerVisualAcceptance:'NOT_EXECUTED',launchClassification:'OWNER_ACCEPTANCE_REQUIRED',countyOutcomeTotals:totals},null,2)}\n`);
  fs.writeFileSync(path.join(root, `${reportDir}/summary.md`), `# LP241.6 Statewide Address Launch Certification\n\n- Static fixture certification: **STATIC_CERTIFIED (254/254)**\n- Provider execution: **NOT_EXECUTED**\n- Owner visual acceptance: **NOT_EXECUTED**\n- Launch classification: **OWNER_ACCEPTANCE_REQUIRED**\n- Production code changed: **No**\n\nThe prior plan derived names from absent LP130 fields, producing blank names and generic queries. This revision joins the LP130 governed FIPS/county keys to LP158 governed public courthouse fixtures. It does not claim provider, handoff, map, or UI evidence.\n\n## Outcome totals\n\n| Total | Executed | Pass | No result | Wrong county | Ambiguous | Provider unavailable | Invalid coordinate | Handoff | Map | UI | Fixture required | Not executed |\n|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n| 254 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 254 |\n\nMulti-county handoff, truthful no-result, map movement, awareness convergence, desktop/mobile, keyboard/touch, focus, reset, wrapping, and stale-state behavior remain **NOT_EXECUTED** for this statewide run. Existing deterministic regression suites are supporting contract evidence only, not statewide runtime or owner visual evidence. Geography/provider-result failure grouping is unavailable until provider execution and is not inferred.\n\n## Owner-authorized execution\n\n\`node tools/lp2416/statewide-address-certification.mjs --execute --owner-authorized\`\n\nExecution is sequential, FIPS ordered, resumable in ignored \`owner-local/\`, uses no retries, and stops on authentication, quota, provider-health, or contract failures.\n`);
}

export class SafeStopError extends Error {
  constructor(status, countyFips) { super(`provider HTTP ${status} at ${countyFips}`); this.name='SafeStopError'; this.status=status; this.countyFips=countyFips; }
}

export function buildProviderRequest(row, contract=publicRequestContract) {
  return {url:contract.endpoint, init:{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',apikey:contract.publicKey,Authorization:`Bearer ${contract.publicKey}`,Origin:contract.origin},body:JSON.stringify({intent:'address',query:row.privacySafeSeedQuery,limit:3,requestMode:'explicit_search',requestId:`lp2416-${row.countyFips}`})}};
}

function persistProgress(file, progress) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const temporary=`${file}.tmp`;
  fs.writeFileSync(temporary,`${JSON.stringify(progress,null,2)}\n`);
  fs.renameSync(temporary,file);
}

export async function executePlan(plan, {fetchImpl=fetch, progressPath=localProgress, contract=publicRequestContract}={}) {
  fs.mkdirSync(path.dirname(progressPath), {recursive:true});
  const progress = fs.existsSync(progressPath) ? JSON.parse(fs.readFileSync(progressPath,'utf8')) : {rows:[]};
  const done = new Set(progress.rows.map(x => x.countyFips));
  for (const row of plan.fixtures) {
    if (done.has(row.countyFips)) continue;
    const started = Date.now();
    const request=buildProviderRequest(row,contract);
    const response = await fetchImpl(request.url,request.init);
    if ([401,403,429].includes(response.status) || response.status >= 500) {
      await response.text().catch(()=>{});
      progress.safeStop={countyFips:row.countyFips,httpStatus:response.status,executionState:'NOT_EXECUTED',providerOutcome:'NOT_EXECUTED'};
      persistProgress(progressPath,progress);
      throw new SafeStopError(response.status,row.countyFips);
    }
    let payload; try { payload=await response.json(); } catch { throw Error(`safe stop: malformed provider response at ${row.countyFips}`); }
    const outcome=classifyProviderResult(row,payload); if (outcome==='PROVIDER_UNAVAILABLE') throw Error(`safe stop: provider health/contract failure at ${row.countyFips}`);
    const result=payload.results?.[0]; progress.rows.push({...row,executionState:'PROVIDER_EXECUTED',providerOutcome:outcome,resolvedAddress:result?.displayName||'',resolvedLatitude:result?.latitude??null,resolvedLongitude:result?.longitude??null,resolvedCounty:result?.address?.county||'',resolvedCommunity:result?.address?.community||result?.address?.city||'',countyMatch:outcome==='PASS',requestLatencyMs:Date.now()-started,blockerClassification:outcome});
    delete progress.safeStop;
    persistProgress(progressPath,progress);
  }
  return progress;
}

async function main() {
  const plan=buildPlan(); verifyPlan(plan);
  if (process.argv.includes('--write')) writeArtifacts(plan);
  if (process.argv.includes('--verify')) { const tracked=read(artifactJson); verifyPlan(tracked); if (JSON.stringify(tracked)!==JSON.stringify(plan)) throw Error('tracked artifact drift'); }
  if (process.argv.includes('--execute')) {
    if (!process.argv.includes('--owner-authorized')) throw Error('READY_FOR_OWNER_AUTHORIZED_EXECUTION: pass --owner-authorized only after the owner approves provider use');
    try { await executePlan(plan); }
    catch (error) {
      if (!(error instanceof SafeStopError)) throw error;
      console.error(`SAFE STOP: county ${error.countyFips}; HTTP ${error.status}; progress persisted; county remains NOT_EXECUTED.`);
      process.exitCode=1;
      return;
    }
  }
  console.log(`LP241.6 static fixtures verified: ${plan.fixtures.length}; provider execution ${process.argv.includes('--execute')?'requested':'not attempted'}`);
}

if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) await main();
