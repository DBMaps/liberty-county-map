import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'../..');
const local=path.join(root,'owner-local/lp24111');
const authority=path.join(local,'overture-texas-spatial-authority.geoparquet');
const manifestPath=path.join(root,'reports/lp24111/rich-shard-manifest.json');
const progressPath=path.join(local,'rich-shard-progress.json');
export const release='2026-08-19.0';
export const fields=['id','geometry','bbox','names','categories','basic_category','taxonomy','confidence','brand','addresses','operating_status','sources','websites','phones'];
const q=value=>`'${String(value).replaceAll("'","''")}'`;

export function artifactPaths(shardId,outputDirectory=local){return {remote:path.join(outputDirectory,`${shardId}.remote.parquet`),matched:path.join(outputDirectory,`${shardId}.authority-matched.parquet`)};}
export function fetchSql(shard,outputDirectory=local){
 const {xmin,xmax,ymin,ymax}=shard.bounds,{remote}=artifactPaths(shard.shardId,outputDirectory);
 return `INSTALL httpfs; LOAD httpfs;\nSET preserve_insertion_order=false;\nCOPY (SELECT ${fields.join(', ')} FROM read_parquet('s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*', hive_partitioning=true) WHERE bbox.xmin <= ${xmax} AND bbox.xmax >= ${xmin} AND bbox.ymin <= ${ymax} AND bbox.ymax >= ${ymin} ORDER BY id) TO ${q(remote)} (FORMAT PARQUET, COMPRESSION ZSTD);\n`;
}
export function matchSql(shard,outputDirectory=local,authorityPath=authority){
 const {remote,matched}=artifactPaths(shard.shardId,outputDirectory);
 return `COPY (SELECT ${fields.map(field=>`r.${field}`).join(', ')} FROM read_parquet(${q(remote)}) r INNER JOIN read_parquet(${q(authorityPath)}) a USING (id) ORDER BY r.id) TO ${q(matched)} (FORMAT PARQUET, COMPRESSION ZSTD);\n`;
}
export function shardSql(shard,outputDirectory=local){return fetchSql(shard,outputDirectory)+matchSql(shard,outputDirectory);}

export function validatePlan(manifest){
 if(manifest.releaseId!==release||!manifest.immutableInput||manifest.countyHardWalls||manifest.shardCount!==manifest.rows.length) throw Error('invalid shard governance');
 const ids=new Set();
 for(const shard of manifest.rows){
  const sql=shardSql(shard);
  if(ids.has(shard.shardId)||/SELECT\s+\*/i.test(sql)||!sql.includes(`release/${release}/`)||!sql.includes('INNER JOIN')) throw Error(`unsafe shard ${shard.shardId}`);
  ids.add(shard.shardId);
  for(const value of Object.values(shard.bounds)) if(!Number.isFinite(value)) throw Error(`non-literal bound ${shard.shardId}`);
 }
 return true;
}

export function parseCli(args){
 const value=flag=>{const i=args.indexOf(flag); if(i<0)return null; if(!args[i+1]||args[i+1].startsWith('--'))throw Error(`${flag} requires a value`); return args[i+1];};
 const one=value('--shard'),many=value('--shards');
 if(one&&many)throw Error('Use only one of --shard or --shards');
 const ids=one?[one]:many?many.split(',').map(x=>x.trim()).filter(Boolean):null;
 if(ids&&new Set(ids).size!==ids.length)throw Error('Duplicate shard ID requested');
 const known=new Set(['--plan','--execute','--shard','--shards','--rebuild-invalid','--dense-candidates']);
 for(let i=0;i<args.length;i++)if(args[i].startsWith('--')&&!known.has(args[i]))throw Error(`Unknown option ${args[i]}`);else if(['--shard','--shards'].includes(args[i]))i++;
 if(args.includes('--plan')&&args.includes('--execute'))throw Error('--plan cannot be combined with --execute');
 return {execute:args.includes('--execute'),plan:args.includes('--plan')||!args.includes('--execute'),ids,rebuildInvalid:args.includes('--rebuild-invalid'),dense:args.includes('--dense-candidates')};
}
export function selectShards(manifest,ids){
 if(!ids)return manifest.rows;
 const byId=new Map(manifest.rows.map(s=>[s.shardId,s])),missing=ids.filter(id=>!byId.has(id));
 if(missing.length)throw Error(`Unknown shard ID(s): ${missing.join(',')}`);
 return ids.map(id=>byId.get(id));
}

function duckdb(sql,{duckdb=process.env.DUCKDB??'duckdb'}={}){
 const run=spawnSync(duckdb,['-json'],{input:sql,encoding:'utf8'});
 if(run.error)throw run.error;
 if(run.status!==0)throw Error(run.stderr.trim()||`DuckDB exited ${run.status}`);
 return run.stdout.trim()?JSON.parse(run.stdout):[];
}
export function validateRemote(shard,file,options={}){
 if(!fs.existsSync(file)||fs.statSync(file).size<=0)throw Error('remote artifact missing or empty');
 const {xmin,xmax,ymin,ymax}=shard.bounds;
 const rows=(options.query??duckdb)(`SELECT count(*)::BIGINT AS rowCount, count(*) FILTER (WHERE NOT (bbox.xmin <= ${xmax} AND bbox.xmax >= ${xmin} AND bbox.ymin <= ${ymax} AND bbox.ymax >= ${ymin}))::BIGINT AS outsideCount FROM read_parquet(${q(file)});`);
 const schema=(options.query??duckdb)(`DESCRIBE SELECT * FROM read_parquet(${q(file)});`);
 const names=new Set(schema.map(x=>x.column_name)); for(const field of fields)if(!names.has(field))throw Error(`remote artifact missing field ${field}`);
 if(Number(rows[0].outsideCount)!==0)throw Error('remote artifact contains out-of-bounds rows');
 return {rowCount:Number(rows[0].rowCount),bytes:fs.statSync(file).size};
}
export function validateMatched(file,remoteCount,authorityPath=authority,options={}){
 if(!fs.existsSync(file)||fs.statSync(file).size<=0)throw Error('matched artifact missing or empty');
 const rows=(options.query??duckdb)(`SELECT count(*)::BIGINT AS rowCount, count(*)-count(DISTINCT m.id)::BIGINT AS duplicateCount, count(*) FILTER (WHERE a.id IS NULL)::BIGINT AS nonAuthorityCount FROM read_parquet(${q(file)}) m LEFT JOIN read_parquet(${q(authorityPath)}) a USING (id);`);
 const r=rows[0]; if(Number(r.duplicateCount)!==0)throw Error('matched artifact contains duplicate IDs'); if(Number(r.nonAuthorityCount)!==0)throw Error('matched artifact contains non-authority IDs');
 const rowCount=Number(r.rowCount); if(rowCount>remoteCount)throw Error('matched row count exceeds remote row count');
 return {rowCount,bytes:fs.statSync(file).size};
}
const blank=shard=>({shardId:shard.shardId,bounds:shard.bounds,status:'PLANNED',remoteRowCount:null,remoteBytes:null,authorityMatchedRowCount:null,authorityMatchedBytes:null,elapsedRemoteMs:null,elapsedMatchMs:null,elapsedTotalMs:null,releaseId:release,projectionFieldCount:fields.length,error:null,executedAt:null});
function writeProgress(file,records){fs.mkdirSync(path.dirname(file),{recursive:true}); const value={schemaVersion:1,releaseId:release,projectionFieldCount:fields.length,shards:Object.fromEntries([...records].sort(([a],[b])=>a.localeCompare(b)))}; const tmp=`${file}.tmp-${process.pid}`; fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n'); fs.renameSync(tmp,file);}

export async function executeShards(shards,options={}){
 const outputDirectory=options.outputDirectory??local,authorityPath=options.authorityPath??authority,file=options.progressPath??progressPath,now=options.now??(()=>new Date().toISOString()),clock=options.clock??(()=>Date.now());
 const query=options.query??((sql)=>duckdb(sql,options)),run=options.run??query,records=new Map();
 if(fs.existsSync(file)){try{for(const [id,r] of Object.entries(JSON.parse(fs.readFileSync(file)).shards??{}))records.set(id,r);}catch{throw Error(`Unreadable progress state: ${file}`);}}
 for(const shard of shards){
  const started=clock(),record=blank(shard),p=artifactPaths(shard.shardId,outputDirectory); let remote;
  try{
   let remoteValid=false,matchedValid=false,invalid=false;
   if(fs.existsSync(p.remote)){try{remote=validateRemote(shard,p.remote,{query});remoteValid=true;}catch(error){record.error=error.message;invalid=true;}}
   if(remoteValid&&fs.existsSync(p.matched)){try{const m=validateMatched(p.matched,remote.rowCount,authorityPath,{query});matchedValid=true;Object.assign(record,{status:'COMPLETE_EXISTING',remoteRowCount:remote.rowCount,remoteBytes:remote.bytes,authorityMatchedRowCount:m.rowCount,authorityMatchedBytes:m.bytes,elapsedTotalMs:clock()-started});}catch(error){record.error=error.message;invalid=true;}}
   if(matchedValid){records.set(shard.shardId,record);writeProgress(file,records);continue;}
   if(invalid&&!options.rebuildInvalid){record.status='INVALID_EXISTING_ARTIFACT';throw Object.assign(Error(record.error),{classified:true});}
   if(invalid&&options.rebuildInvalid){for(const candidate of [p.remote,p.matched])if(fs.existsSync(candidate))fs.renameSync(candidate,`${candidate}.invalid-${now().replaceAll(':','-')}`); remoteValid=false; remote=null;}
   if(!remoteValid){const t=clock();run(fetchSql(shard,outputDirectory));record.elapsedRemoteMs=clock()-t;remote=validateRemote(shard,p.remote,{query});record.status='FETCHED';}
   else record.status='REMOTE_REUSED';
   Object.assign(record,{remoteRowCount:remote.rowCount,remoteBytes:remote.bytes});records.set(shard.shardId,record);writeProgress(file,records);
   const t=clock();run(matchSql(shard,outputDirectory,authorityPath));record.elapsedMatchMs=clock()-t;const m=validateMatched(p.matched,remote.rowCount,authorityPath,{query});
   Object.assign(record,{status:record.status==='REMOTE_REUSED'?'REMOTE_REUSED':'MATCHED',authorityMatchedRowCount:m.rowCount,authorityMatchedBytes:m.bytes,elapsedTotalMs:clock()-started,error:null,executedAt:now()});
   records.set(shard.shardId,record);writeProgress(file,records);
  }catch(error){if(record.status!=='INVALID_EXISTING_ARTIFACT')record.status='FAILED';record.error=error.message;record.elapsedTotalMs=clock()-started;records.set(shard.shardId,record);writeProgress(file,records);throw Error(`Shard ${shard.shardId} failed: ${error.message}`);}
 }
 return Object.fromEntries(records);
}

export function denseCandidates(progress,limit=10){return Object.values(progress.shards??{}).filter(x=>Number.isFinite(x.remoteRowCount)).sort((a,b)=>b.remoteRowCount-a.remoteRowCount||a.shardId.localeCompare(b.shardId)).slice(0,limit).map(({shardId,bounds,remoteRowCount,remoteBytes})=>({shardId,bounds,remoteRowCount,remoteBytes}));}

async function main(){
 if(!fs.existsSync(manifestPath))throw Error('Run npm run build:lp24111 first.');
 const manifest=JSON.parse(fs.readFileSync(manifestPath));validatePlan(manifest);const cli=parseCli(process.argv.slice(2));const shards=selectShards(manifest,cli.ids);
 if(cli.dense){const p=fs.existsSync(progressPath)?JSON.parse(fs.readFileSync(progressPath)):{};console.log(JSON.stringify(denseCandidates(p),null,2));return;}
 if(!cli.execute){console.log(`validated ${manifest.shardCount} literal rich-field shards; selected ${shards.length} (not executed)`);return;}
 if(!fs.existsSync(authority))throw Error(`Missing owner-local authority: ${path.relative(root,authority)}`);
 await executeShards(shards,{rebuildInvalid:cli.rebuildInvalid});console.log(`processed ${shards.length} bounded rich-field shard(s); normalization/certification remains separate`);
}
const isMain=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(isMain)main().catch(error=>{console.error(error.message);process.exitCode=1;});
