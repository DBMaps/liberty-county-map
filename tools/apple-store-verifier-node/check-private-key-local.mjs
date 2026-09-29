import { readFileSync } from 'node:fs';
import { createPrivateKey, sign } from 'node:crypto';

function inspect(path) {
  if (typeof path !== 'string' || !path) return 'path_missing';
  let bytes;
  try { bytes=readFileSync(path); }
  catch { return 'file_unavailable'; }
  const pem=bytes.toString('utf8');
  if (!Buffer.from(pem,'utf8').equals(bytes)) return 'not_utf8_pem';
  let key;
  try { key=createPrivateKey(pem); }
  catch { return 'pem_parse_failed'; }
  if (key.asymmetricKeyType!=='ec') return 'key_type_not_ec';
  if (key.asymmetricKeyDetails?.namedCurve!=='prime256v1') return 'curve_not_p256';
  try { return sign('sha256',Buffer.from('lp24466s-source-key-v1'),key).length ? 'ready' : 'node_sign_failed'; }
  catch { return 'node_sign_failed'; }
}

// Local-only check. Never print file contents, key metadata, paths, signatures or parser errors.
console.log('sourceKeyStage:',inspect(process.argv[2]));
