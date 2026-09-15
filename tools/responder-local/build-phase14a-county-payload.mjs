#!/usr/bin/env node
// LOCAL CERTIFICATION ONLY. No database or network access.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {root,validateSource,expectedSha256 as sourceSha256}
  from './build-phase13-county-population.mjs';
export {root};

export const outputPath='db/responder-local/phase14a_county_population_payload.sql';
export const generatorVersion='responder.phase14a.transactionNeutralPayload.v1';
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const sha=b=>createHash('sha256').update(b).digest('hex');

export function buildPayload(){
  const source=validateSource();
  assert.equal(source.sha256,sourceSha256);
  const lines=[
    '-- TRANSACTION-NEUTRAL DATA PAYLOAD / LOCAL CERTIFICATION ARTIFACT.',
    '-- NOT A PRODUCTION MIGRATION. REQUIRES EXTERNAL GUARDED TRANSACTION.',
    `-- generatorVersion=${generatorVersion}`,
    `-- frozenSourceSha256=${source.sha256}`,
    `-- sourcePackageVersion=${source.packageVersion}`,
    `-- canonicalFipsSha256=${source.fipsSha256}`,
    '-- rowCount=254; no generated timestamp or connection information.'
  ];
  for(const row of source.rows){
    const geometry=JSON.stringify({type:row.geometry.type,
      coordinates:row.geometry.coordinates});
    lines.push('INSERT INTO public.gridly_texas_county_boundaries '+
      '(county_fips,geom,boundary_version) VALUES ('+
      quote(row.fips)+',extensions.ST_Multi(extensions.ST_SetSRID('+
      'extensions.ST_GeomFromGeoJSON('+quote(geometry)+'),4326)),'+
      quote(source.packageVersion)+');');
  }
  const sql=lines.join('\n')+'\n';
  const bytes=Buffer.from(sql,'utf8');
  return {sql,metadata:{path:outputPath,bytes:bytes.length,sha256:sha(bytes),
    sourceSha256:source.sha256,sourceBytes:source.canonicalBytes,
    sourcePackageVersion:source.packageVersion,countyCount:source.rows.length,
    fipsSha256:source.fipsSha256,coordinatePairs:source.points,
    generatorVersion,transactionNeutral:true,productionMigration:false}};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.ok(process.argv.length<=3 && (!process.argv[2] || process.argv[2]==='--check'));
  const {sql,metadata}=buildPayload();
  const target=resolve(root,outputPath);
  if(process.argv.includes('--check'))
    assert.ok(readFileSync(target).equals(Buffer.from(sql,'utf8')),
      'Phase 14A payload differs from deterministic regeneration');
  else writeFileSync(target,sql,'utf8');
  process.stdout.write(JSON.stringify({...metadata,
    mode:process.argv.includes('--check')?'verified':'generated'})+'\n');
}
