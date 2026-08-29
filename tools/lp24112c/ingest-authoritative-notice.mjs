import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(import.meta.dirname,'../..');
export const FOURSQUARE_URL='https://opensource.foursquare.com/places-notice-txt/';
export const OVERTURE_URL='https://docs.overturemaps.org/attribution/';
const AMBIGUOUS='FOURSQUARE_NOTICE_EXTRACTION_AMBIGUOUS';
const stable=value=>`${JSON.stringify(value,null,2)}\n`;
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

function decodeEntities(value){
 const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
 return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(all,key)=>{
  if(key[0]==='#')return String.fromCodePoint(Number.parseInt(key.slice(key[1]?.toLowerCase()==='x'?2:1),key[1]?.toLowerCase()==='x'?16:10));
  return named[key.toLowerCase()]??all;
 });
}

function bodyCandidates(html,tag){
 const values=[];const re=new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,'gi');
 for(const match of html.matchAll(re))values.push(match[1]);
 return values;
}

function recognizableNotice(value){return /foursquare/i.test(value)&&/\bnotice\b/i.test(value)&&/places/i.test(value);}

export function extractFoursquareNotice(html){
 if(typeof html!=='string'||!/<html\b/i.test(html)||!/<\/html>/i.test(html))throw Error('FOURSQUARE_SNAPSHOT_MALFORMED');
 const articles=bodyCandidates(html,'article').filter(recognizableNotice);
 const candidates=articles.length?articles:bodyCandidates(html,'main').filter(recognizableNotice);
 if(candidates.length!==1)throw Error(AMBIGUOUS);
 let text=candidates[0]
  .replace(/<(script|style|nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
  .replace(/<br\s*\/?>/gi,'\n').replace(/<li\b[^>]*>/gi,'- ')
  .replace(/<\/(?:p|div|section|article|h[1-6]|li|ul|ol|pre|blockquote)>/gi,'\n')
  .replace(/<[^>]+>/g,'');
 text=decodeEntities(text).replace(/\r\n?/g,'\n').split('\n').map(line=>line.replace(/[ \t]+/g,' ').trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim();
 if(!text||!recognizableNotice(text))throw Error(AMBIGUOUS);
 return `${text}\n`;
}

export function crossCheckOverture(html){
 if(typeof html!=='string'||!/<html\b/i.test(html)||!/<\/html>/i.test(html))throw Error('OVERTURE_SNAPSHOT_MALFORMED');
 const text=decodeEntities(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ');
 const facts={provider:/Foursquare/i.test(text),license:/Apache(?:-| )2\.0/i.test(text),transformation:/Foursquare data transformed to Overture schema/i.test(text),changed:/2026-03-18/.test(text),noticeReference:html.includes(FOURSQUARE_URL)||/places-notice-txt/i.test(html)};
 if(Object.values(facts).some(value=>!value))throw Error('OVERTURE_ATTRIBUTION_CROSS_CHECK_FAILED');
 return {status:'VERIFIED_FROM_OWNER_AUTHORITATIVE_SNAPSHOT',facts:{provider:'Foursquare',license:'Apache 2.0',transformation:'Foursquare data transformed to Overture schema',changed:'2026-03-18',noticeReference:FOURSQUARE_URL}};
}

function readSnapshot(file,label){
 let bytes;try{bytes=fs.readFileSync(file);}catch{throw Error(`${label}_SNAPSHOT_MISSING`);}
 if(bytes.length===0)throw Error(`${label}_SNAPSHOT_EMPTY`);
 return {bytes,html:bytes.toString('utf8'),contentBytes:bytes.length,contentSha256:sha256(bytes)};
}

export function ingest({foursquareHtml,overtureHtml,outputRoot=root,write=true}){
 const f=readSnapshot(foursquareHtml,'FOURSQUARE');const o=readSnapshot(overtureHtml,'OVERTURE');
 const notice=Buffer.from(extractFoursquareNotice(f.html),'utf8');const overtureCrossCheck=crossCheckOverture(o.html);
 const provenance={schemaVersion:'gridly.lp24112c.foursquare-notice-provenance.v2',sourceUrl:FOURSQUARE_URL,sourceAuthority:'FOURSQUARE_OFFICIAL',documentRole:'FOURSQUARE_OS_PLACES_NOTICE',licenseContext:'APACHE_2_0',retrievedEvidenceState:'OWNER_AUTHORITATIVE_SNAPSHOT',retrievedAt:'OWNER_RECORDED_OR_FILE_ACQUISITION_TIMESTAMP',sourceSnapshotBytes:f.contentBytes,sourceSnapshotSha256:f.contentSha256,noticeBytes:notice.length,noticeSha256:sha256(notice),provenanceStatus:'ACQUIRED_FROM_AUTHORITATIVE_SOURCE',extractionMethod:'DETERMINISTIC_OFFICIAL_HTML_NOTICE_EXTRACTION',overtureAttribution:{sourceUrl:OVERTURE_URL,retrievedEvidenceState:'OWNER_AUTHORITATIVE_SNAPSHOT',sourceSnapshotBytes:o.contentBytes,sourceSnapshotSha256:o.contentSha256,crossCheck:overtureCrossCheck},legalApprovalImplied:false};
 if(write){
  const noticePath=path.join(outputRoot,'legal/third-party/foursquare/NOTICE.txt');const provenancePath=path.join(outputRoot,'reports/lp24112c/lp24112c-foursquare-notice-provenance.json');
  fs.mkdirSync(path.dirname(noticePath),{recursive:true});fs.mkdirSync(path.dirname(provenancePath),{recursive:true});
  fs.writeFileSync(noticePath,notice);fs.writeFileSync(provenancePath,stable(provenance));
 }
 return provenance;
}

function argument(name,fallback){const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const provenance=ingest({foursquareHtml:path.resolve(argument('--foursquare-html',path.join(root,'owner-local/lp24112c/foursquare-notice-authoritative.html'))),overtureHtml:path.resolve(argument('--overture-html',path.join(root,'owner-local/lp24112c/overture-attribution-authoritative.html')))});
 console.log(stable({status:'OWNER_AUTHORITATIVE_SNAPSHOT_INGESTED',sourceSnapshotBytes:provenance.sourceSnapshotBytes,sourceSnapshotSha256:provenance.sourceSnapshotSha256,noticeBytes:provenance.noticeBytes,noticeSha256:provenance.noticeSha256,overtureSnapshotBytes:provenance.overtureAttribution.sourceSnapshotBytes,overtureSnapshotSha256:provenance.overtureAttribution.sourceSnapshotSha256}).trim());
}
