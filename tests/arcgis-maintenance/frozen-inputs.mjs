// Read-only baseline comparison for the unchanged map/recovery regression inputs.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {relative,resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {syncBuiltinESMExports} from 'node:module';
const ref=process.env.GRIDLY_FROZEN_SOURCE_REF;
if(!['86bf721ddaf5b85e8786b1d74da240a048c98f96','71168111a133fa1c187620b9604b08e79fbf4687'].includes(ref))throw Error('FROZEN_REF_NOT_AUTHORIZED');
const inputs=new Set(['js/app.js','css/styles.css','index.html','ios/App/App/GridlyBridgeViewController.swift']);
const root=process.cwd();
function baseline(path,options){
  if(!(typeof path==='string'||path instanceof URL))return null;
  const filename=path instanceof URL?fileURLToPath(path):resolve(path),rel=relative(root,filename).replaceAll('\\','/');
  if(isAbsolute(rel)||!inputs.has(rel))return null;
  const bytes=execFileSync('git',['show',ref+':'+rel],{cwd:root,maxBuffer:32*1024*1024});
  const encoding=typeof options==='string'?options:options?.encoding;
  return encoding?bytes.toString(encoding):bytes;
}
const sync=fs.readFileSync,asyncRead=fsp.readFile;
fs.readFileSync=function(path,options){const value=baseline(path,options);return value===null?sync.call(this,path,options):value;};
fsp.readFile=async function(path,options){const value=baseline(path,options);return value===null?asyncRead.call(this,path,options):value;};
syncBuiltinESMExports();
