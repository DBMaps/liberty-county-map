import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_DESTINATION = path.join(ROOT, 'evidence/lp169/supabase-sql-editor-metadata.json');
export const METADATA_KEYS = ['schemas','tables','columns','routines','constraints','indexes','triggers','policies','storageBuckets','storageCounts'];
const secretRules = [
  ['PRIVATE_KEY_BLOCK', /-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
  ['CREDENTIAL_CONNECTION_URI', /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/[^\s,:/]+:[^\s@/]+@[^\s/]+/i],
  ['JWT', /(?:^|[^a-zA-Z0-9_-])eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}(?:$|[^a-zA-Z0-9_-])/],
  ['BEARER_TOKEN', /\bbearer\s+[a-z0-9._~+/=-]{8,}/i],
  ['AUTHORIZATION_HEADER', /\bauthorization\s*["']?\s*[:=]\s*["']?\s*\S+/i],
  ['SUPABASE_SECRET_KEY', /\bsb_(?:secret|service_role)_[a-zA-Z0-9_-]{8,}/i],
  ['SECRET_ASSIGNMENT', /\b(?:password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|cookie)\s*["']?\s*[:=]\s*["']?\s*\S+/i]
];
const rawSecretRuleNames = new Set(['PRIVATE_KEY_BLOCK','CREDENTIAL_CONNECTION_URI','JWT','BEARER_TOKEN','AUTHORIZATION_HEADER','SUPABASE_SECRET_KEY']);
const allowedFields = {
  schemas: ['name'], tables: ['schema','name','type'], columns: ['schema','table','name','dataType'],
  routines: ['schema','name','type'], constraints: ['schema','table','name','type'],
  indexes: ['schema','table','name'], triggers: ['schema','table','name','event'],
  policies: ['schema','table','name','command','roles'], storageBuckets: ['id','public'],
  storageCounts: ['bucketId','objectCount','addressPackageCount','runtimeCertificateCount','unclassifiedCount']
};
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
const canonicalItem = item => JSON.stringify(stable(item));
export const encode = value => `${JSON.stringify(stable(value), null, 2)}\n`;

export class SanitizationError extends Error {
  constructor(rule, metadataPath, classification='SECRET_SHAPED_VALUE') {
    super('SANITIZATION_FAILED');
    this.name='SanitizationError'; this.rule=rule; this.metadataPath=metadataPath; this.classification=classification;
  }
}

function sanitizeValue(value, metadataPath, raw=false) {
  for(const [rule,pattern] of secretRules) if((!raw || rawSecretRuleNames.has(rule)) && pattern.test(value)) throw new SanitizationError(rule,metadataPath);
}

export function parseCsv(text) {
  const rows=[]; let row=[], field='', quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) { if(c==='"' && text[i+1]==='"'){field+='"';i++;} else if(c==='"') quoted=false; else field+=c; continue; }
    if(c==='"') { if(field!=='') throw new Error('MALFORMED_CSV'); quoted=true; }
    else if(c===',') { row.push(field); field=''; }
    else if(c==='\n') { row.push(field); rows.push(row); row=[]; field=''; }
    else if(c==='\r') { if(text[i+1]==='\n') i++; row.push(field); rows.push(row); row=[]; field=''; }
    else field+=c;
  }
  if(quoted) throw new Error('MALFORMED_CSV');
  if(field!=='' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function validateMetadata(metadata) {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw new Error('INVALID_METADATA');
  if (Object.keys(metadata).some(k=>!METADATA_KEYS.includes(k))) throw new Error('UNKNOWN_METADATA_FIELD');
  const normalized={};
  for(const key of METADATA_KEYS) {
    const value=metadata[key] ?? [];
    if(!Array.isArray(value)) throw new Error('INVALID_METADATA_ARRAY');
    normalized[key]=value.map((item,index)=>{
      if(!item || Array.isArray(item) || typeof item!=='object') throw new Error('INVALID_METADATA_ITEM');
      if(Object.keys(item).some(k=>!allowedFields[key].includes(k))) throw new Error('UNKNOWN_METADATA_ITEM_FIELD');
      for(const [field,fieldValue] of Object.entries(item)) {
        const expectedType=key==='storageBuckets' && field==='public'?'boolean':key==='storageCounts' && field!=='bucketId'?'number':'string';
        if(typeof fieldValue!==expectedType) throw new Error('INVALID_METADATA_FIELD_TYPE');
      }
      if(key==='storageCounts') {
        for(const k of allowedFields.storageCounts.slice(1)) if(k in item && (!Number.isSafeInteger(item[k]) || item[k]<0)) throw new Error('INVALID_STORAGE_COUNT');
      }
      for(const [field,fieldValue] of Object.entries(item)) if(typeof fieldValue==='string') sanitizeValue(fieldValue,`metadata.${key}[${index}].${field}`);
      return stable(item);
    }).sort((a,b)=>canonicalItem(a).localeCompare(canonicalItem(b)));
  }
  return normalized;
}

export function buildEvidence(csvBytes) {
  const decoded=new TextDecoder('utf-8',{fatal:true}).decode(csvBytes);
  const text=decoded.charCodeAt(0)===0xfeff?decoded.slice(1):decoded;
  sanitizeValue(text,'sourceCsv',true);
  const rows=parseCsv(text);
  if(rows.length!==2) throw new Error('EXPECTED_EXACTLY_ONE_RESULT');
  const matches=rows[0].map((x,i)=>[x,i]).filter(([x])=>x==='lp169_owner_metadata');
  if(matches.length!==1) throw new Error(matches.length?'DUPLICATE_RESULT_COLUMN':'MISSING_RESULT_COLUMN');
  if(rows[1].length!==rows[0].length) throw new Error('MALFORMED_CSV');
  const cell=rows[1][matches[0][1]];
  if(!cell.trim()) throw new Error('BLANK_RESULT');
  let parsed; try { parsed=JSON.parse(cell); } catch { throw new Error('MALFORMED_JSON'); }
  const metadata=validateMetadata(parsed);
  const contentSha256=crypto.createHash('sha256').update(encode(metadata)).digest('hex');
  return {schemaVersion:1,evidenceIdentifier:'LP169.3-SUPABASE-SQL-EDITOR-METADATA',sourceSystem:'SUPABASE_SQL_EDITOR',captureMethod:'DASHBOARD_READ_ONLY_SQL_EXPORT',authenticated:true,ownerSupplied:true,readOnly:true,redactionStatus:'SANITIZED',sourceFormat:'CSV',contentSha256,evidenceStatus:METADATA_KEYS.every(k=>Object.hasOwn(parsed,k))?'COMPLETE_METADATA_EXPORT':'PARTIAL_METADATA_EXPORT',metadata};
}

export function ingest(source,destination=DEFAULT_DESTINATION) {
  const evidence=buildEvidence(fs.readFileSync(source));
  const parent=path.dirname(destination); fs.mkdirSync(parent,{recursive:true});
  const temporary=path.join(parent,`.${path.basename(destination)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
  try { fs.writeFileSync(temporary,encode(evidence),{encoding:'utf8',flag:'wx'}); fs.renameSync(temporary,destination); }
  finally { fs.rmSync(temporary,{force:true}); }
  return evidence;
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const diagnose=process.argv.includes('--diagnose-sanitization');
  const args=process.argv.slice(2).filter(arg=>arg!=='--diagnose-sanitization');
  if(args.length!==1){console.error('Usage: node tools/lp169/ingest-sql-editor-evidence.mjs [--diagnose-sanitization] <Supabase-SQL-Editor-export.csv>');process.exitCode=2;}
  else try { const result=ingest(path.resolve(args[0])); console.log(`LP169 SQL Editor evidence ingestion: ${result.evidenceStatus} (sanitized canonical evidence written; no values displayed)`); }
  catch(error) {
    console.error('LP169 SQL Editor evidence ingestion: SANITIZATION_FAILED (input rejected; no input content displayed)');
    if(diagnose && error instanceof SanitizationError) console.error(`rule=${error.rule}\npath=${error.metadataPath}\nclassification=${error.classification}`);
    process.exitCode=1;
  }
}
