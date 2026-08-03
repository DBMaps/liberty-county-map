import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createGunzip, gzipSync } from 'node:zlib';
import { createInterface } from 'node:readline';

export const HARRIS_FIPS='48201', FORMAT='gridly-harris-bucketed-jsonl-gzip-v1', BUCKETS=256;
export const SIDECAR_OBJECT='lp108/harris-48201.certified-lookup.bin';
export const SIDECAR_CERTIFICATE_OBJECT='lp108/harris-48201.certified-lookup-certificate.json';
export const NORMALIZATION='lp105.2-exact-address-v1';
const clean=v=>String(v??'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
export const canonicalRoad=v=>clean(v).replace(/\b(?:county road|county rd|co rd|cr)\s*(\d+[a-z]?)\b/g,'cr $1');
export const exactKey=row=>[clean(row.h),canonicalRoad(row.r),clean(row.p),String(row.z||'').slice(0,5),String(row.f).padStart(5,'0')].join('|');
export const bucketForKey=key=>Number.parseInt(createHash('sha256').update(key).digest('hex').slice(0,2),16);
export const eligible=row=>String(row.f).padStart(5,'0')===HARRIS_FIPS&&clean(row.h)&&canonicalRoad(row.r)&&Number.isFinite(Number(row.x))&&Number.isFinite(Number(row.y))&&Boolean(String(row.i||''));
export const compact=row=>({i:String(row.i),h:String(row.h),r:String(row.r),a:String(row.a||''),p:String(row.p||''),z:String(row.z||''),x:Number(row.x),y:Number(row.y)});
export const digest=async path=>{const h=createHash('sha256');let n=0;for await(const b of createReadStream(path)){h.update(b);n+=b.length}return{sizeBytes:n,sha256:h.digest('hex')}};
export async function buildSidecar({sourcePath,sourceCertificate,outputPath,certificatePath}){
 const source=await digest(sourcePath);if(source.sizeBytes!==sourceCertificate.sizeBytes)throw new Error('source_package_size_mismatch');if(source.sha256!==sourceCertificate.sha256)throw new Error('source_package_sha256_mismatch');
 const tmp=`${outputPath}.build-${process.pid}`;await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});const paths=Array.from({length:BUCKETS},(_,i)=>join(tmp,`${i}.jsonl`));const streams=paths.map(p=>createWriteStream(p));let count=0,position=0;
 const input=createReadStream(sourcePath).pipe(createGunzip());for await(const line of createInterface({input,crlfDelay:Infinity})){if(!line.trim())continue;const row=JSON.parse(line);if(eligible(row)){const value={...compact(row),o:position};streams[bucketForKey(exactKey(row))].write(`${JSON.stringify(value)}\n`);count++}position++}
 await Promise.all(streams.map(s=>new Promise((res,rej)=>s.end(e=>e?rej(e):res()))));
 const members=[],lengths=[];for(const p of paths){const zipped=gzipSync(await readFile(p),{level:9,mtime:0});members.push(zipped);lengths.push(zipped.length)}
 const header=Buffer.from(`${JSON.stringify({format:FORMAT,buckets:BUCKETS,lengths})}\n`);await mkdir(dirname(outputPath),{recursive:true});const temporary=`${outputPath}.${process.pid}.tmp`;const handle=await open(temporary,'w');try{await handle.write(header);for(const member of members)await handle.write(member);await handle.sync();await handle.close();await rename(temporary,outputPath)}catch(e){await handle.close().catch(()=>{});throw e}finally{await rm(tmp,{recursive:true,force:true})}
 const sidecar=await digest(outputPath);const certificate={schemaVersion:1,milestone:'LP108.11',county:'Harris County',fips:HARRIS_FIPS,objectPath:SIDECAR_OBJECT,format:FORMAT,sizeBytes:sidecar.sizeBytes,sha256:sidecar.sha256,recordCount:count,sourcePackageObjectPath:'lp104/txgio-addresses/harris-48201.addresses.jsonl.gz',sourcePackageSizeBytes:source.sizeBytes,sourcePackageSha256:source.sha256,normalizationContract:NORMALIZATION,acceptedPrecision:'address_point',resultType:'address',interpolation:false,nearbyNumberSubstitution:false,roadOnlyPromotion:false};
 const certText=`${JSON.stringify(certificate,null,2)}\n`,certTmp=`${certificatePath}.${process.pid}.tmp`;await mkdir(dirname(certificatePath),{recursive:true});const certHandle=await open(certTmp,'w');await certHandle.writeFile(certText);await certHandle.sync();await certHandle.close();await rename(certTmp,certificatePath);return{certificate,uncompressedSourceBytes:(await stat(sourcePath)).size};
}
export async function verifySidecar(path,certificate,sourceCertificate){const d=await digest(path);if(d.sizeBytes!==certificate.sizeBytes)throw new Error('sidecar_size_mismatch');if(d.sha256!==certificate.sha256)throw new Error('sidecar_sha256_mismatch');if(certificate.sourcePackageSizeBytes!==sourceCertificate.sizeBytes||certificate.sourcePackageSha256!==sourceCertificate.sha256)throw new Error('sidecar_source_identity_mismatch');return d}
