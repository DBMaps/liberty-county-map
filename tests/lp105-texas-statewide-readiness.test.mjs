import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  atomicJson, buildLedger, buildPilotReport, buildSummary, countyResult, estimateSizes,
  licenseIsApproved, parseArguments, privacySafeSourceIdentity, run, selectCounties
} from '../tools/lp105/inventory-txgio-statewide.mjs';

const manifest = JSON.parse(await readFile('data/lp104/texas-counties.json'));
const unresolved = JSON.parse(await readFile('data/lp105/txgio-license-decision.json'));
const source = JSON.parse(await readFile('data/lp104/txgio-2026-address-source.json'));

test('canonical official inventory is complete and contains 254 unique Texas FIPS codes', () => {
  assert.equal(manifest.count, 254); assert.equal(manifest.counties.length, 254);
  assert.equal(new Set(manifest.counties.map(c => c.fips)).size, 254);
  assert.ok(manifest.counties.every(c => /^48\d{3}$/.test(c.fips)));
});

test('argument parsing and one, comma-separated, current-28, and all-254 selection', () => {
  assert.deepEqual(selectCounties(parseArguments(['--fips', '48291']), manifest).map(c => c.fips), ['48291']);
  assert.deepEqual(selectCounties(parseArguments(['--fips', '48291,48201,48339']), manifest).map(c => c.fips), ['48291','48201','48339']);
  assert.equal(selectCounties(parseArguments(['--gridly-counties']), manifest).length, 28);
  assert.equal(selectCounties(parseArguments(['--all-texas']), manifest).length, 254);
  assert.equal(parseArguments(['--all-texas']).concurrency, 1);
});

test('size estimates deterministically scale Liberty evidence', () => {
  assert.deepEqual(estimateSizes(20, { acceptedRecords: 10, compressedBytes: 100, uncompressedBytes: 400 }), { estimatedCompressedPackageBytes: 200, estimatedUncompressedPackageBytes: 800, sizeEstimateMethod: 'Liberty accepted-record baseline (10.00 compressed and 40.00 uncompressed bytes/record; estimates, not artifacts)' });
});

test('license remains fail closed until every authorization and evidence field is affirmative', () => {
  assert.equal(licenseIsApproved(unresolved), false); assert.equal(unresolved.productionEligible, false);
  for (const field of ['redistributionApproved','derivativePackagesApproved','publicBrowserDeliveryApproved','residentialAddressDistributionApproved','attributionTextApproved','retentionTermsApproved']) {
    assert.equal(licenseIsApproved({ ...unresolved, [field]: true }), false);
  }
  const approved = { ...unresolved, redistributionApproved:true, derivativePackagesApproved:true, publicBrowserDeliveryApproved:true, residentialAddressDistributionApproved:true, attributionTextApproved:true, retentionTermsApproved:true, approvalEvidenceReference:'written-evidence', reviewedBy:'reviewer', reviewedAt:'2026-01-01' };
  assert.equal(licenseIsApproved(approved), true);
});

test('zero-row county is empty and never production ready', () => {
  const context = { license: unresolved, evidence:{acceptedRecords:1,compressedBytes:1,uncompressedBytes:2}, now:()=> '2026-01-01T00:00:00Z', sourceIdentity:{fingerprint:'safe'}, config:source };
  const row = countyResult(manifest.counties[0], {raw:0,coordinates:0,houses:0,streets:0,usable:0}, context);
  assert.equal(row.inventoryStatus, 'SOURCE_EMPTY'); assert.equal(row.sourcePresent, false); assert.equal(row.usablePercentage, 0);
});

test('source identity is path-private and resume identity changes with source metadata', () => {
  const a = privacySafeSourceIdentity('C:\\Users\\Denise\\secret\\Texas-2026.gdb', source, {size:12,mtime:new Date(0)});
  const b = privacySafeSourceIdentity('D:\\copy\\Texas-2026.gdb', source, {size:13,mtime:new Date(0)});
  assert.equal(a.sourcePathExcludedFromReport, true); assert.doesNotMatch(JSON.stringify(a), /Denise|Users|secret/); assert.notEqual(a.fingerprint, b.fingerprint);
});

test('atomic JSON leaves valid destination and no temporary file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lp105-atomic-')); const path = join(dir, 'checkpoint.json');
  await atomicJson(path, {counties:[{countyFips:'48291'}]}); assert.deepEqual(JSON.parse(await readFile(path)), {counties:[{countyFips:'48291'}]}); assert.deepEqual((await readdir(dir)).filter(f => f.endsWith('.tmp')), []); await rm(dir,{recursive:true});
});

test('summary ordering is deterministic and aggregate reports contain no raw address records', () => {
  const context = { manifest, license:unresolved, sourceIdentity:{fingerprint:'x',sourcePathExcludedFromReport:true}, now:()=> '2026-01-01' };
  const base = fips => ({countyId:fips,countyName:fips,countyFips:fips,sourcePresent:true,rawRecordCount:2, potentiallyUsableRecordCount:1,estimatedCompressedPackageBytes:2,estimatedUncompressedPackageBytes:4,inventoryStatus:'BLOCKED_LICENSE'});
  const summary = buildSummary([base('48291'),base('48001')], context, {startedAt:'2026-01-01',reportName:'test'});
  assert.deepEqual(summary.counties.map(r=>r.countyFips), ['48001','48291']);
  assert.doesNotMatch(JSON.stringify(summary), /Full_Addr|Add_Number|coordinates|streetAddress/);
  assert.equal(buildPilotReport(summary).packagesBuilt, false);
});

test('ledger keeps readiness fields separate and cannot activate/build/certify new counties', () => {
  const rows = [{countyFips:'48001',sourcePresent:true,inventoryStatus:'BLOCKED_LICENSE',potentiallyUsableRecordCount:9}];
  const ledger = buildLedger(manifest, rows, {counties:[]}); const anderson = ledger.counties.find(c=>c.countyFips==='48001');
  assert.deepEqual(anderson, {countyId:'anderson',countyName:'Anderson',countyFips:'48001',sourcePresent:true,sourceInventoried:true,sourceUsableEstimate:9,licensingApproved:false,productionEligible:false,packageBuilt:false,packageCertified:false,runtimeActivated:false});
});

test('run continues after a county failure and writes a complete partial-failure report', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lp105-run-')); const gdb = join(dir,'fixture.gdb'); const reports = join(dir,'reports'); await writeFile(gdb,'synthetic metadata only'); let calls=0;
  const options = parseArguments(['--fips','48001,48003,48005','--gdb',gdb,'--reports',reports,'--name','partial']);
  const previousExit = process.exitCode; process.exitCode = 0;
  const summary = await run(options,{command:'fixture',now:()=> '2026-01-01T00:00:00.000Z',queryCounty:async (_c,_g,_s,county)=> { calls += 1; if(county.fips==='48003') throw new Error('synthetic failure'); return {raw:10,coordinates:9,houses:9,streets:9,usable:8}; }});
  assert.equal(calls,3); assert.equal(summary.countyCountInspected,3); assert.equal(summary.countyCountFailed,1); assert.deepEqual(summary.countiesWithQueryFailures,['48003']); assert.equal(JSON.parse(await readFile(join(reports,'partial.json'))).counties.length,3); assert.equal(JSON.parse(await readFile(join(reports,'partial.checkpoint.json'))).counties.length,3); assert.equal(process.exitCode,1); process.exitCode=previousExit; await rm(dir,{recursive:true});
});

test('resume guard refuses a checkpoint from a changed source identity', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lp105-resume-')); const gdb=join(dir,'fixture.gdb'); const reports=join(dir,'reports'); await writeFile(gdb,'x'); await run(parseArguments(['--fips','48001','--gdb',gdb,'--reports',reports,'--name','guard']),{command:'fixture',queryCounty:async()=>({raw:1,coordinates:1,houses:1,streets:1,usable:1})}); await writeFile(gdb,'changed source metadata');
  await assert.rejects(run(parseArguments(['--fips','48001','--gdb',gdb,'--reports',reports,'--name','guard','--resume']),{command:'fixture',queryCounty:async()=>({raw:1,coordinates:1,houses:1,streets:1,usable:1})}),/source identity changed/); await rm(dir,{recursive:true});
});
