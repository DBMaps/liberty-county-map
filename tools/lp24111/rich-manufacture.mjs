import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'../..');
const local=path.join(root,'owner-local/lp24111');
const authority=path.join(local,'overture-texas-spatial-authority.geoparquet');
const manifestPath=path.join(root,'reports/lp24111/rich-shard-manifest.json');
const release='2026-08-19.0';
const fields=['id','geometry','bbox','names','categories','basic_category','taxonomy','confidence','brand','addresses','operating_status','sources','websites','phones'];
const q=value=>`'${String(value).replaceAll("'","''")}'`;

export function shardSql(shard, outputDirectory=local){
 const {xmin,xmax,ymin,ymax}=shard.bounds;
 const remote=path.join(outputDirectory,`${shard.shardId}.remote.parquet`);
 const matched=path.join(outputDirectory,`${shard.shardId}.authority-matched.parquet`);
 return `INSTALL httpfs; LOAD httpfs;\nSET preserve_insertion_order=false;\n`+
 `COPY (SELECT ${fields.join(', ')} FROM read_parquet('s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*', hive_partitioning=true) `+
 `WHERE bbox.xmin <= ${xmax} AND bbox.xmax >= ${xmin} AND bbox.ymin <= ${ymax} AND bbox.ymax >= ${ymin} ORDER BY id) `+
 `TO ${q(remote)} (FORMAT PARQUET, COMPRESSION ZSTD);\n`+
 `COPY (SELECT ${fields.map(field=>`r.${field}`).join(', ')} FROM read_parquet(${q(remote)}) r INNER JOIN read_parquet(${q(authority)}) a USING (id) ORDER BY r.id) `+
 `TO ${q(matched)} (FORMAT PARQUET, COMPRESSION ZSTD);\n`;
}

export function validatePlan(manifest){
 if(manifest.releaseId!==release || !manifest.immutableInput || manifest.countyHardWalls) throw Error('invalid shard governance');
 for(const shard of manifest.rows){
  const sql=shardSql(shard);
  if(/SELECT\s+\*/i.test(sql)||!sql.includes(`release/${release}/`)||!sql.includes('INNER JOIN')) throw Error(`unsafe shard ${shard.shardId}`);
  for(const value of Object.values(shard.bounds)) if(!Number.isFinite(value)) throw Error(`non-literal bound ${shard.shardId}`);
 }
 return true;
}

if(import.meta.url===`file://${process.argv[1]}`){
 if(!fs.existsSync(manifestPath)) throw Error('Run npm run build:lp24111 first.');
 const manifest=JSON.parse(fs.readFileSync(manifestPath)); validatePlan(manifest);
 if(!process.argv.includes('--execute')) { console.log(`validated ${manifest.shardCount} literal rich-field shards (not executed)`); process.exit(0); }
 if(!fs.existsSync(authority)) throw Error(`Missing owner-local authority: ${path.relative(root,authority)}`);
 fs.mkdirSync(local,{recursive:true});
 for(const shard of manifest.rows){
  const run=spawnSync(process.env.DUCKDB??'duckdb',[],{input:shardSql(shard),encoding:'utf8',stdio:['pipe','inherit','inherit']});
  if(run.error) throw run.error;
  if(run.status!==0) throw Error(`DuckDB failed for ${shard.shardId} (${run.status})`);
 }
 console.log(`executed ${manifest.shardCount} bounded rich-field shards; normalization/certification remains a separate measured stage`);
}
