import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import readline from 'node:readline';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CONTROLLED_TEST_FIXTURE, loadGovernedCountyGeometries, normalizeTexasCountyFips, assignLp1601jCounty, manufactureLp1601jFromJsonl, LP1601L_FAILURES } from '../tools/lp1601f-streaming-manufacture.mjs';

const known=[
  ['Liberty',-94.8,30.05,'48291'],['Harris',-95.36,29.76,'48201'],['Travis',-97.743,30.267,'48453'],['Bexar',-98.493,29.424,'48029'],
  ['Dallas',-96.797,32.776,'48113'],['Tarrant',-97.330,32.755,'48439'],['El Paso',-106.485,31.761,'48141'],['Lubbock',-101.855,33.577,'48303'],
  ['Potter',-101.831,35.222,'48375'],['Cameron',-97.497,25.901,'48061'],['Webb',-99.507,27.506,'48479'],['McLennan',-97.146,31.549,'48309']
];

test('LP160.1L loads all governed county geometries and resolves county FIPS properties',()=>{
  const g=loadGovernedCountyGeometries();
  assert.equal(g.features.length,254);
  assert.equal(new Set(g.features.map(f=>f.countyFips)).size,254);
  assert.ok(g.features.every(f=>f.countyFips.startsWith('48')));
  assert.equal(normalizeTexasCountyFips('48001'),'48001');
  assert.equal(normalizeTexasCountyFips('001',{allowThreeDigitTexasCountyCode:true}),'48001');
  assert.throws(()=>normalizeTexasCountyFips('48'));
  assert.throws(()=>normalizeTexasCountyFips(null));
});

test('LP160.1L known points resolve to expected Texas county FIPS and nearby states are unresolved',()=>{
  for(const [name,lon,lat,fips] of known) assert.equal(assignLp1601jCounty(lon,lat).countyFips,fips,name);
  assert.equal(assignLp1601jCounty(-100.31,25.68).status,'UNRESOLVED');
  assert.equal(assignLp1601jCounty(-97.52,35.47).status,'UNRESOLVED');
  assert.equal(assignLp1601jCounty(-92.02,30.22).status,'UNRESOLVED');
  assert.equal(assignLp1601jCounty(-106.62,32.32).status,'UNRESOLVED');
  assert.ok(['BOUNDARY_AMBIGUOUS','GEOMETRY_CONTAINMENT'].includes(assignLp1601jCounty(-94.64727,30.25313).status));
});

test('LP160.1L controlled 12-county fixture opens 12 writers and reconciles manifest with real files',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lp1601l-'));
  try{
    const file=join(dir,'fixture.jsonl');
    const rows=known.map(([name,longitude,latitude])=>({id:`${CONTROLLED_TEST_FIXTURE}-${name}`,display_name:`${name} Place`,longitude,latitude,primary_category:'restaurant'}));
    await writeFile(file,rows.map(JSON.stringify).join('\n')+'\n');
    const artifacts=await manufactureLp1601jFromJsonl({stagingFile:file,manufacturingDirectory:dir,write:true});
    const final=artifacts['reports/lp1601j/final-jsonl-county-manufacturing-assessment.json'];
    const manifest=artifacts['data/lp1601/texas-destination-candidate-registry-manifest.json'];
    const lifecycle=JSON.parse(await import('node:fs/promises').then(fs=>fs.readFile('reports/lp1601l/county-writer-lifecycle-report.json','utf8')));
    const reconcile=JSON.parse(await import('node:fs/promises').then(fs=>fs.readFile('reports/lp1601l/final-county-writer-reconciliation-report.json','utf8')));
    assert.equal(final.retainedDestinations,12);
    assert.equal(final.finalClassification,'CONDITIONALLY_COMPLETE');
    assert.equal(manifest.counties.length,254);
    assert.equal(manifest.counties.filter(c=>c.recordCount>0).length,12);
    assert.equal(lifecycle.writersOpened,12);
    assert.equal(lifecycle.writersCompleted,12);
    assert.equal(lifecycle.writersFailed,0);
    assert.equal(lifecycle.filesPromoted,12);
    assert.equal(reconcile.status,'PASS');
    assert.equal(reconcile.actualCandidateFileRows,12);
    const files=readdirSync(join(dir,'lp1601l','counties')).filter(f=>f.endsWith('.jsonl.gz'));
    assert.equal(files.length,12);
    for(const entry of manifest.counties.filter(c=>c.recordCount>0)){
      assert.ok(existsSync(entry.candidateFilePathIdentity));
      assert.ok(entry.candidateFilePathIdentity.includes(entry.countyFips));
      assert.ok(entry.sha256);
      const records=await readGzipJsonl(entry.candidateFilePathIdentity);
      assert.equal(records.length,entry.recordCount);
      assert.ok(records.every(r=>r.countyFips===entry.countyFips));
    }
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

async function readGzipJsonl(file){
  const rows=[];
  const rl=readline.createInterface({input:createReadStream(file).pipe(createGunzip()),crlfDelay:Infinity});
  for await (const line of rl) if(line.trim()) rows.push(JSON.parse(line));
  return rows;
}

test('LP160.1L failure codes are explicit',()=>{
  assert.equal(LP1601L_FAILURES.collapse,'MANUFACTURING_FAILED:COUNTY_DISTRIBUTION_COLLAPSE');
  assert.equal(LP1601L_FAILURES.writerLoss,'MANUFACTURING_FAILED:COUNTY_WRITER_LOSS');
  assert.equal(LP1601L_FAILURES.manifestMismatch,'MANUFACTURING_FAILED:MANIFEST_FILE_COUNT_MISMATCH');
  assert.equal(LP1601L_FAILURES.writerNotClosed,'MANUFACTURING_FAILED:COUNTY_WRITER_NOT_CLOSED');
  assert.equal(LP1601L_FAILURES.pathCollision,'MANUFACTURING_FAILED:COUNTY_OUTPUT_PATH_COLLISION');
  assert.equal(LP1601L_FAILURES.placeholderNames,'MANUFACTURING_FAILED:PLACEHOLDER_COUNTY_NAMES');
  assert.equal(LP1601L_FAILURES.stagingMismatch,'MANUFACTURING_FAILED:STAGING_ROW_RECONCILIATION_MISMATCH');
});
