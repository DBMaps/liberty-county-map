import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createGunzip, gzipSync, gunzipSync } from 'node:zlib';
import { createInterface } from 'node:readline';

export const HARRIS_FIPS='48201', FORMAT='gridly-harris-independent-buckets-v1', BUCKETS=256;
export const MANIFEST_OBJECT='lp108/harris-48201.certified-lookup-manifest.json';
export const BUCKET_PREFIX='lp108/harris-48201/buckets';
export const NORMALIZATION='lp105.2-exact-address-v1';
export const SOURCE_OBJECT='lp104/txgio-addresses/harris-48201.addresses.jsonl.gz';
const clean=v=>String(v??'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
export const canonicalRoad=v=>clean(v).replace(/\b(?:county road|county rd|co rd|cr)\s*(\d+[a-z]?)\b/g,'cr $1');
export const exactKey=row=>[clean(row.h),canonicalRoad(row.r),clean(row.p),String(row.z||'').slice(0,5),String(row.f).padStart(5,'0')].join('|');
export const bucketForKey=key=>createHash('sha256').update(key).digest()[0];
export const bucketId=value=>Number(value).toString(16).padStart(2,'0');
export const eligible=row=>String(row.f).padStart(5,'0')===HARRIS_FIPS&&clean(row.h)&&canonicalRoad(row.r)&&Number.isFinite(Number(row.x))&&Number.isFinite(Number(row.y))&&Boolean(String(row.i||''));
export const compact=row=>({i:String(row.i),h:String(row.h),r:String(row.r),a:String(row.a||''),p:String(row.p||''),z:String(row.z||''),x:Number(row.x),y:Number(row.y)});
export const digest=async path=>{const h=createHash('sha256');let n=0;for await(const b of createReadStream(path)){h.update(b);n+=b.length}return{sizeBytes:n,sha256:h.digest('hex')}};
const atomicWrite=async(path,bytes)=>{await mkdir(dirname(path),{recursive:true});const tmp=`${path}.${process.pid}.tmp`;const h=await open(tmp,'w');try{await h.writeFile(bytes);await h.sync();await h.close();await rename(tmp,path)}catch(e){await h.close().catch(()=>{});await rm(tmp,{force:true});throw e}};

export async function buildBuckets({sourcePath,sourceCertificate,outputDirectory,manifestPath,sourcePackageObjectPath=SOURCE_OBJECT}){
 const source=await digest(sourcePath);if(source.sizeBytes!==sourceCertificate.sizeBytes)throw new Error('source_package_size_mismatch');if(source.sha256!==sourceCertificate.sha256)throw new Error('source_package_sha256_mismatch');
 const staging=`${outputDirectory}.build-${process.pid}`;await rm(staging,{recursive:true,force:true});await mkdir(staging,{recursive:true});
 const raw=Array.from({length:BUCKETS},(_,i)=>join(staging,`${bucketId(i)}.jsonl`)),streams=raw.map(p=>createWriteStream(p));
 const stats=Array.from({length:BUCKETS},()=>({recordCount:0,firstSourcePackagePosition:null,lastSourcePackagePosition:null}));let total=0,position=0;
 try{for await(const line of createInterface({input:createReadStream(sourcePath).pipe(createGunzip()),crlfDelay:Infinity})){if(!line.trim())continue;const row=JSON.parse(line);if(eligible(row)){const b=bucketForKey(exactKey(row)),s=stats[b];s.firstSourcePackagePosition??=position;s.lastSourcePackagePosition=position;s.recordCount++;total++;streams[b].write(`${JSON.stringify({...compact(row),o:position})}\n`)}position++}
  await Promise.all(streams.map(s=>new Promise((resolve,reject)=>s.end(e=>e?reject(e):resolve()))));
  const buckets=[];for(let i=0;i<BUCKETS;i++){const id=bucketId(i),bytes=gzipSync(await readFile(raw[i]),{level:9,mtime:0}),file=join(staging,`${id}.jsonl.gz`);await atomicWrite(file,bytes);const hash=createHash('sha256').update(bytes).digest('hex');buckets.push({bucketId:id,objectPath:`${BUCKET_PREFIX}/${id}.jsonl.gz`,compressedSizeBytes:bytes.length,compressedSha256:hash,...stats[i]})}
  await Promise.all(raw.map(p=>rm(p,{force:true})));await rm(outputDirectory,{recursive:true,force:true});await mkdir(dirname(outputDirectory),{recursive:true});await rename(staging,outputDirectory);
  const manifest={formatVersion:FORMAT,county:'Harris County',fips:HARRIS_FIPS,sourcePackageObjectPath,sourcePackageSizeBytes:source.sizeBytes,sourcePackageSha256:source.sha256,normalizationContract:NORMALIZATION,bucketSelectionAlgorithm:'first-byte-of-sha256-of-exact-normalized-address-key',totalRecordCount:total,bucketCount:BUCKETS,buckets,interpolation:false,nearbyNumberSubstitution:false,roadOnlyPromotion:false};
  await atomicWrite(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);return manifest;
 }catch(e){streams.forEach(s=>s.destroy());await rm(staging,{recursive:true,force:true});throw e}
}
export async function verifyBuckets({outputDirectory,manifest,sourceCertificate}){if(manifest.sourcePackageSizeBytes!==sourceCertificate.sizeBytes||manifest.sourcePackageSha256!==sourceCertificate.sha256)throw new Error('manifest_source_identity_mismatch');if(manifest.bucketCount!==BUCKETS||manifest.buckets?.length!==BUCKETS)throw new Error('manifest_bucket_count_mismatch');let records=0;for(const b of manifest.buckets){const file=join(outputDirectory,`${b.bucketId}.jsonl.gz`),d=await digest(file);if(d.sizeBytes!==b.compressedSizeBytes)throw new Error(`bucket_size_mismatch:${b.bucketId}`);if(d.sha256!==b.compressedSha256)throw new Error(`bucket_sha256_mismatch:${b.bucketId}`);const lines=gunzipSync(await readFile(file)).toString().split('\n').filter(Boolean);if(lines.length!==b.recordCount)throw new Error(`bucket_record_count_mismatch:${b.bucketId}`);for(const line of lines){const row=JSON.parse(line);if(bucketId(bucketForKey(exactKey({...row,f:HARRIS_FIPS})))!==b.bucketId)throw new Error(`wrong_bucket:${b.bucketId}`)}records+=lines.length}if(records!==manifest.totalRecordCount)throw new Error('manifest_record_count_mismatch');return{bucketCount:BUCKETS,recordCount:records,sourcePackageSha256:manifest.sourcePackageSha256}}
// Compatibility names now implement the independent-object architecture.
export const buildSidecar=opts=>buildBuckets({...opts,outputDirectory:opts.outputDirectory||dirname(opts.outputPath),manifestPath:opts.manifestPath||opts.certificatePath});
export const verifySidecar=(path,manifest,sourceCertificate)=>verifyBuckets({outputDirectory:path,manifest,sourceCertificate});
