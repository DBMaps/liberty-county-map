import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {TextDecoder} from 'node:util';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const ARTIFACT_PATH=path.join(ROOT,'evidence/san-antonio-sa-tomorrow-derived-repairs/west-northwest/repaired.geojson');
export const WRAPPER_IDENTITY={bytes:6735560,sha256:'d46219d2f61d26d40111bb375651ec91a6ba286b2331e421d19d35f17d881c16'};
export const RECOVERED_IDENTITY={bytes:427909,sha256:'1eed04031d6a0ccb13c5749fbcc7af3c829e2bc959db065a2dd7b78c324ec181'};
export const WEST={name:'West Northwest',globalId:'4c5f3a02-22b0-4af8-8d74-b1bc35a8e03e'};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

function identifyWrapper(raw,expected){
  const rawSha256=sha(raw);
  if(raw.length===expected.bytes&&rawSha256===expected.sha256)return {rawWrapperBytes:raw.length,rawWrapperSha256:rawSha256,wrapperMaterialization:'CANONICAL_LF_WRAPPER',normalized:raw};

  // Decode strictly before considering line endings. Buffer.toString() would silently
  // replace malformed UTF-8 and is therefore not an acceptable identity gate.
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(raw);}catch{throw Error('ACCIDENTAL_WRAPPER_INVALID_UTF8');}
  let crlfCount=0;
  for(let i=0;i<raw.length;i++){
    if(raw[i]===13){
      if(raw[i+1]!==10)throw Error('ACCIDENTAL_WRAPPER_LONE_CR');
      crlfCount++;i++;
    }
  }
  if(crlfCount===0)throw Error('ACCIDENTAL_WRAPPER_IDENTITY_MISMATCH');
  const normalized=Buffer.from(text.replaceAll('\r\n','\n'),'utf8');
  const normalizedSha256=sha(normalized);
  if(normalized.length!==expected.bytes||normalizedSha256!==expected.sha256)throw Error('ACCIDENTAL_WRAPPER_IDENTITY_MISMATCH');
  return {rawWrapperBytes:raw.length,rawWrapperSha256:rawSha256,wrapperMaterialization:'WINDOWS_CRLF_MATERIALIZATION_OF_CANONICAL_WRAPPER',normalized};
}

export function reconstructWrapper(wrapper,{bytes=RECOVERED_IDENTITY.bytes,sha256=RECOVERED_IDENTITY.sha256,validateGeoJson=true}={}){
  if(!wrapper||typeof wrapper!=='object'||Array.isArray(wrapper))throw Error('BUFFER_WRAPPER_JSON_OBJECT_REQUIRED');
  const keys=Object.keys(wrapper);
  if(keys.length!==bytes)throw Error(`BUFFER_WRAPPER_PROPERTY_COUNT_MISMATCH: expected ${bytes}, received ${keys.length}`);
  for(const key of keys){
    if(!/^(0|[1-9]\d*)$/.test(key))throw Error(`BUFFER_WRAPPER_NONNUMERIC_OR_NONCANONICAL_KEY: ${key}`);
    const index=Number(key);
    if(!Number.isSafeInteger(index)||index<0||index>=bytes)throw Error(`BUFFER_WRAPPER_INDEX_OUT_OF_RANGE: ${key}`);
  }
  const recovered=Buffer.alloc(bytes);
  for(let i=0;i<bytes;i++){
    const key=String(i);
    if(!Object.hasOwn(wrapper,key))throw Error(`BUFFER_WRAPPER_MISSING_INDEX: ${i}`);
    const value=wrapper[key];
    if(!Number.isInteger(value)||value<0||value>255)throw Error(`BUFFER_WRAPPER_INVALID_BYTE: ${i}`);
    recovered[i]=value;
  }
  if(recovered.length!==bytes)throw Error('RECOVERED_BYTE_LENGTH_MISMATCH');
  const actualHash=sha(recovered);
  if(actualHash!==sha256)throw Error(`RECOVERED_SHA256_MISMATCH: expected ${sha256}, received ${actualHash}`);
  if(validateGeoJson){
    let geojson;try{geojson=JSON.parse(recovered);}catch{throw Error('RECOVERED_BYTES_NOT_JSON');}
    if(geojson?.type!=='FeatureCollection'||geojson.features?.length!==1)throw Error('RECOVERED_FEATURE_COLLECTION_IDENTITY_MISMATCH');
    const feature=geojson.features[0];
    if(feature?.properties?.Name!==WEST.name||feature?.properties?.GlobalID!==WEST.globalId||feature?.geometry?.type!=='Polygon')throw Error('RECOVERED_WEST_NORTHWEST_IDENTITY_MISMATCH');
    if(!Array.isArray(feature.geometry.coordinates)||feature.geometry.coordinates.length===0)throw Error('RECOVERED_GEOMETRY_EMPTY');
  }
  return recovered;
}

export function verifyWrapperFile(file=ARTIFACT_PATH,options={}){
  const raw=fs.readFileSync(file);
  const expectedWrapper=options.wrapperIdentity??WRAPPER_IDENTITY;
  const identity=identifyWrapper(raw,expectedWrapper);
  let wrapper;try{wrapper=JSON.parse(identity.normalized);}catch{throw Error('ACCIDENTAL_WRAPPER_NOT_JSON');}
  const recovered=reconstructWrapper(wrapper,options.recoveredIdentity);
  return {status:'RECOVERY_METHOD_CERTIFIED',mode:'VERIFY_NON_DESTRUCTIVE',artifactPath:file,rawWrapperBytes:identity.rawWrapperBytes,rawWrapperSha256:identity.rawWrapperSha256,wrapperMaterialization:identity.wrapperMaterialization,normalizedWrapperBytes:identity.normalized.length,normalizedWrapperSha256:sha(identity.normalized),recoveredBytes:recovered.length,recoveredSha256:sha(recovered),buffer:recovered};
}

export function recoverWrapperFile(file=ARTIFACT_PATH,options={}){
  const result=verifyWrapperFile(file,options);
  fs.writeFileSync(file,result.buffer);
  const written=fs.readFileSync(file);
  if(!written.equals(result.buffer))throw Error('RECOVERY_POST_WRITE_IDENTITY_MISMATCH');
  return {...result,status:'CERTIFIED_ARTIFACT_REPRESENTATION_RECOVERED',mode:'RECOVER'};
}

function main(){
  const recover=process.argv.includes('--recover'),verify=process.argv.includes('--verify');
  if(recover&&verify)throw Error('RECOVERY_MODES_MUTUALLY_EXCLUSIVE');
  const result=recover?recoverWrapperFile():verifyWrapperFile();
  const output={...result,buffer:undefined};
  console.log(process.argv.includes('--json')?JSON.stringify(output,null,2):`${output.status}: ${output.recoveredBytes}/${output.recoveredSha256}`);
}
if(process.argv[1]===fileURLToPath(import.meta.url))try{main();}catch(error){console.error(error.message);process.exitCode=1;}
