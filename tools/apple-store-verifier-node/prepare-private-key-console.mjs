import { spawnSync } from 'node:child_process';
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function encodePrivateKeyBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length===0 || bytes.length>4096) throw Error('source_key_unusable');
  const pem=bytes.toString('utf8');
  if (!Buffer.from(pem,'utf8').equals(bytes)) throw Error('source_key_unusable');
  let key;
  try {key=createPrivateKey(pem);} catch {throw Error('source_key_unusable');}
  if (key.asymmetricKeyType!=='ec' || key.asymmetricKeyDetails?.namedCurve!=='prime256v1')
    throw Error('source_key_unusable');
  try {if(!sign('sha256',Buffer.from('lp24466s-console-key-v1'),key).length) throw Error('source_key_unusable');}
  catch {throw Error('source_key_unusable');}
  const encoded='b64:'+bytes.toString('base64');
  if (!Buffer.from(encoded.slice(4),'base64').equals(bytes)) throw Error('source_key_unusable');
  return encoded;
}

function prepare(path) {
  if (typeof path!=='string' || !path) return 'path_missing';
  const clipboard=process.platform==='win32' ? 'clip.exe' : process.platform==='darwin' ? 'pbcopy' : null;
  if (!clipboard) return 'clipboard_unavailable';
  let value;
  try {value=encodePrivateKeyBytes(readFileSync(path));}
  catch {return 'source_key_unusable';}
  const result=spawnSync(clipboard,[],{input:value,encoding:'utf8',stdio:['pipe','ignore','ignore'],windowsHide:true});
  return result.status===0 ? 'ready' : 'clipboard_unavailable';
}

if (process.argv[1] && resolve(process.argv[1]).toLowerCase()===fileURLToPath(import.meta.url).toLowerCase()) {
  // Copy only into the owner's local clipboard. Never print the key, encoding or path.
  const stage=prepare(process.argv[2]);
  console.log('consoleCopy:',stage);
  if(stage!=='ready') process.exitCode=1;
}
