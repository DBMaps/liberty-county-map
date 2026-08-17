#!/usr/bin/env node
/** Read-only LP206 Supabase inventory. This program performs HTTP GET requests only. */
import fs from "node:fs";
const WHATIF=process.argv.includes("--whatif");
const wi=process.argv.indexOf("--write");
const outputPath=wi>=0?process.argv[wi+1]:null;
const base=(process.env.SUPABASE_URL||"https://nhwhkbkludzkuyxmkkcj.supabase.co").replace(/\/$/,"");
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_READ_ONLY_KEY;
const bucket=process.env.GRIDLY_ROADWAY_BUCKET||"gridly-roadways";
const prefix=process.env.GRIDLY_ROADWAY_PREFIX||"roadways/";
if(WHATIF){console.log(JSON.stringify({auditOnly:true,httpMethods:["GET"],base,bucket,prefix,credentialPresent:!!key,outputPath},null,2));process.exit(0);}
if(!key) throw new Error("Fail closed: set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_READ_ONLY_KEY; no request was sent.");
const headers={apikey:key,Authorization:`Bearer ${key}`,Accept:"application/json"};
const objects=[]; const pageSize=1000;
for(let offset=0;;offset+=pageSize){
 const params=new URLSearchParams({select:"name,bucket_id,metadata,created_at,updated_at",bucket_id:`eq.${bucket}`,name:`like.${prefix}%`,order:"name.asc",offset:String(offset),limit:String(pageSize)});
 const response=await fetch(`${base}/rest/v1/objects?${params}`,{method:"GET",headers});
 if(!response.ok) throw new Error(`Read-only storage.objects inventory failed: HTTP ${response.status} ${await response.text()}`);
 const page=await response.json(); objects.push(...page); if(page.length<pageSize) break;
}
const rows=objects.map(o=>{const m=o.name.match(/^roadways\/([^/]+)\//); const lower=o.name.toLowerCase(); return {name:o.name,countyId:m?.[1]||null,kind:/manifest[^/]*\.json$/.test(lower)?"manifest":/\.(geojson|json)(\.gz)?$/.test(lower)?"package":"other",bytes:Number(o.metadata?.size??o.metadata?.contentLength) || null,etag:o.metadata?.eTag||o.metadata?.etag||null,sha256:o.metadata?.sha256||null,createdAt:o.created_at,updatedAt:o.updated_at};});
const countyIds=[...new Set(rows.map(x=>x.countyId).filter(Boolean))].sort();
const result={schemaVersion:"gridly.lp206.owner-remote-roadway-inventory.v1",generatedAt:new Date().toISOString(),auditOnly:true,httpMethodsUsed:["GET"],projectUrl:base,bucket,prefix,counts:{objects:rows.length,uniqueCountyIds:countyIds.length,packages:rows.filter(x=>x.kind==="package").length,manifests:rows.filter(x=>x.kind==="manifest").length,other:rows.filter(x=>x.kind==="other").length},countyIds,objects:rows};
const rendered=`${JSON.stringify(result,null,2)}\n`; if(outputPath) fs.writeFileSync(outputPath,rendered); else process.stdout.write(rendered);
