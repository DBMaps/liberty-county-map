// Read-only governed asset acquisition for local replay. No credentials or writes
// to providers. All downloaded bytes remain under the ignored evidence directory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const dir=path.resolve(process.env.STATEWIDE_OUTPUT_DIR||'.artifacts/community-loading-statewide'),assets=path.join(dir,'fixtures');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 fs.mkdirSync(assets,{recursive:true});
 const roads=read('data/roadway-runtime-manifest.json').counties,rows=[];
 // Clean source checkouts intentionally omit this generated gzip. Reuse the
 // existing deterministic, hash-enforcing packager without writing its source
 // asset, staging native assets, invoking a build, or changing the runtime URL.
 const {packageAsset}=await import('../lp1833/repair-pages-artifact.mjs');
 const montgomery=packageAsset(process.cwd(),false),montgomeryEntry=roads['montgomery-tx'];
 assert.equal(hash(montgomery),montgomeryEntry.sha256);assert.equal(montgomery.length,montgomeryEntry.compressedBytes);
 fs.writeFileSync(path.join(assets,'montgomery-roads-lp1833-v1.geojson.gz'),montgomery);
 rows.push({url:montgomeryEntry.url,file:'montgomery-roads-lp1833-v1.geojson.gz',bytes:montgomery.length,sha256:hash(montgomery),expectedSha256:montgomeryEntry.sha256,authority:'unchanged LP1833 deterministic generator, canonical production raw Git blob and production compressed registry hash',verification:'GOVERNED_SHA256',contentType:'application/octet-stream'});
 for(const county of ['liberty-tx','san-jacinto-tx']){
  const entry=roads[county],body=fs.readFileSync(entry.url),canonical=cp.execFileSync('git',['show','faac47368da3137b50d53813b7f0299a2f4b1830:'+entry.url],{maxBuffer:50*1024*1024});
  assert.ok(body.equals(canonical)||Buffer.from(body.toString().replace(/\r\n/g,'\n')).equals(canonical),county+'/production Git roadway identity');
  const file=county+'-local-roads.geojson';fs.writeFileSync(path.join(assets,file),body);
  rows.push({url:entry.url,localPath:entry.url,verificationOnly:true,file,bytes:body.length,sha256:hash(body),expectedCanonicalSha256:hash(canonical),authority:'exact production Git source; only LF/CRLF checkout materialization tolerated',verification:'PRODUCTION_GIT_SOURCE_SHA256'});
 }
 const acquire=async(url,file,expectedSha,expectedBytes,authority)=>{
  const target=path.join(assets,file);let body;
  if(fs.existsSync(target))body=fs.readFileSync(target);
  else{const response=await fetch(url,{signal:AbortSignal.timeout(120000)});assert.ok(response.ok,`${url}: ${response.status}`);body=Buffer.from(await response.arrayBuffer());fs.writeFileSync(target,body);}
  const sha256=hash(body);if(expectedSha)assert.equal(sha256,expectedSha,file);if(expectedBytes)assert.equal(body.length,expectedBytes,file);
  rows.push({url,file,bytes:body.length,sha256,expectedSha256:expectedSha||null,authority,verification:expectedSha?'GOVERNED_SHA256':'SOURCE_URL_PINNED_REPLAY_SHA256_ONLY'});
  return body;
 };
 for(const county of ['harris-tx','dallas-tx','tarrant-tx','bexar-tx','travis-tx','fort-bend-tx']){
  const r=roads[county];
  if(county==='harris-tx'){
   const body=fs.readFileSync('.artifacts/community-loading-audit/harris-manifest.json');
   fs.writeFileSync(path.join(assets,'harris-manifest.json'),body);rows.push({url:r.manifestUrl,file:'harris-manifest.json',bytes:body.length,sha256:hash(body),authority:'retained governed LP032.2 manifest; package hashes below',verification:'RETAINED_MANIFEST'});
   for(const p of read('.artifacts/community-loading-audit/harris-manifest.json').packages){const url=r.manifestUrl.replace(/manifest.json$/,p.fileName),file=path.basename(p.fileName),prior=path.join('.artifacts/community-loading-audit',file);if(fs.existsSync(prior))fs.copyFileSync(prior,path.join(assets,file));await acquire(url,file,p.sha256,p.byteLength,'Harris LP032.2 governed manifest');}
  }else if(r.manifestUrl){
   const body=await acquire(r.manifestUrl,county+'-manifest.json',r.lp210?.remoteManifestSha256,r.lp210?.remoteManifestBytes,'unchanged roadway runtime registry LP210');
   const manifest=JSON.parse(body);assert.equal(manifest.packages.length,r.partitions.length,county);
   for(const p of r.partitions){const file=path.basename(new URL(p.url).pathname),prior=path.join('.artifacts/community-loading-audit',file);if(fs.existsSync(prior))fs.copyFileSync(prior,path.join(assets,file));await acquire(p.url,file,p.sha256,p.expectedBytes,'unchanged roadway runtime registry LP210');}
  }else{await acquire(r.url,path.basename(new URL(r.url).pathname),r.sha256,r.expectedBytes,'unchanged production URL; registry provides no authoritative expected hash');}
 }
 fs.writeFileSync(path.join(dir,'fixture-index.json'),JSON.stringify({date:new Date().toISOString(),rows},null,2));
 console.log(JSON.stringify(rows.map(({file,bytes,verification})=>({file,bytes,verification})),null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
