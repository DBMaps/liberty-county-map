// Read-only macOS checks. No credential bytes or command output are returned.
import {lstat,realpath} from 'node:fs/promises';
import {isAbsolute,resolve,dirname,join,parse} from 'node:path';
import {execFileSync} from 'node:child_process';
import {assertPlainPath,assertOutsideRepository} from './staging.mjs';

export function macAclSafe(text) {
  if(typeof text!=='string'||!text.trim()||text.length>16384)return false;
  const lines=text.trimEnd().split('\n');
  if(!/^[-d][rwxStTs-]{9}[+@ ]?\s/.test(lines[0])||/\b(dataless|offline)\b/i.test(lines[0]))return false;
  // Deny-only ACLs (e.g. macOS home deny-delete) grant no extra access.
  return lines.slice(1).every(line=>! /\ballow\b/.test(line)&&/^\s*\d+:\s+(?:user|group):[^\r\n]+\sdeny\s+[a-z_,]+\s*$/.test(line));
}
export function macEntrySafe({uid,mode,nlink,regular,directory,acl},ownerUid,privateKind=null) {
  if(!Number.isInteger(ownerUid)||ownerUid<0||!Number.isInteger(uid)||!Number.isInteger(mode)||!macAclSafe(acl))return false;
  if(privateKind==='File')return uid===ownerUid&&regular===true&&nlink===1&&(mode&0o7777)===0o600;
  if(privateKind==='Directory')return uid===ownerUid&&directory===true&&(mode&0o7777)===0o700;
  return directory===true&&[0,ownerUid].includes(uid)&&(mode&0o022)===0;
}
export function macMountRows(text) {
  if(typeof text!=='string'||!text.trim()||text.length>131072)throw Error('MAC_VOLUME_UNVERIFIED');
  return text.trimEnd().split('\n').map(line=>{
    const match=line.match(/^.+ on (\/[^\r\n]*) \(([^()\r\n]+)\)$/);
    if(!match)throw Error('MAC_VOLUME_UNVERIFIED');
    return {mountpoint:match[1],options:match[2].split(',').map(value=>value.trim())};
  });
}
export function macVolumeSafe(rows) {
  return Array.isArray(rows)&&rows.length>0&&rows.every(row=>Array.isArray(row.options)&&['apfs','hfs'].includes(row.options[0])&&row.options.includes('local')&&!row.options.some(option=>['noowners','read-only'].includes(option)));
}
function lexicalPath(path) {
  return typeof path==='string'&&isAbsolute(path)&&!path.includes('\\')&&!/[\u0000-\u001f\u007f]/.test(path)
    &&!path.split('/').some(part=>part==='.'||part==='..')&&resolve(path)===path
    &&!/(^|\/)(CloudStorage|Mobile Documents|com\.apple\.CloudDocs)(\/|$)/i.test(path);
}
export async function macPrivatePathVerified(path,kind='File',{authorizedRoot}={}) {
  if(process.platform!=='darwin'||typeof process.getuid!=='function'||!['File','Directory'].includes(kind)||!lexicalPath(path)||!lexicalPath(authorizedRoot))return false;
  if(path!==(kind==='File'?join(authorizedRoot,'native-provider-config.json'):authorizedRoot))return false;
  if(authorizedRoot===parse(authorizedRoot).root)return false;
  try {
    await assertPlainPath(path);await assertPlainPath(authorizedRoot);await assertOutsideRepository(authorizedRoot);
    if(await realpath(path)!==path||await realpath(authorizedRoot)!==authorizedRoot)return false;
    const first=await lstat(path);
    const mounted=()=>execFileSync('/sbin/mount',[],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:3000,maxBuffer:131072,env:{...process.env,LC_ALL:'C'}});
    const mountTable=mounted(),matching=[];
    for(const row of macMountRows(mountTable)){
      if(!row.options.includes('local'))continue; // Never probe remote mounts.
      try{if((await lstat(row.mountpoint)).dev===first.dev)matching.push(row);}catch{return false;}
    }
    if(!macVolumeSafe(matching))return false;
    let current=path;
    while(true){
      const info=await lstat(current);
      if(info.isSymbolicLink())return false;
      const acl=execFileSync('/bin/ls',['-ldeO',current],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:3000,maxBuffer:16384,env:{...process.env,LC_ALL:'C'}});
      const privateKind=current===path?kind:current===authorizedRoot?'Directory':null;
      if(!macEntrySafe({uid:info.uid,mode:info.mode,nlink:info.nlink,regular:info.isFile(),directory:info.isDirectory(),acl},process.getuid(),privateKind))return false;
      const parent=dirname(current);if(parent===current)break;current=parent;
    }
    const end=await lstat(path);
    if(['dev','ino','uid','mode','nlink','size','mtimeMs','ctimeMs'].some(field=>first[field]!==end[field]))return false;
    if(mounted()!==mountTable)return false;
    if(!end.isFile()&&kind==='File')return false;
    return kind!=='File'||(end.size>0&&end.size<=16384);
  }catch{return false;}
}
