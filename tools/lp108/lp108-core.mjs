import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

export const BUCKET = 'certified-addresses';
export const PREFIX = 'lp104/txgio-addresses';
export const objectPaths = county => ({
  package: `${PREFIX}/${county.slug}-${county.fips}.addresses.jsonl.gz`,
  certificate: `${PREFIX}/${county.slug}-${county.fips}.runtime-certificate.json`
});
export const redact = value => String(value || '')
  .replace(/(authorization|apikey)(\s*[:=]\s*)\S+/gi, '$1$2[REDACTED]')
  .replace(/(?:eyJ|sb_secret_)[A-Za-z0-9._-]+/g, '[REDACTED]')
  .replace(/[A-Za-z]:\\[^\s"']+|\/(?:home|workspace|root)\/[^\s"']+/g, '[LOCAL_PATH]');
export async function stableDigest(path) {
  const before = await stat(path, { bigint: true }); const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  const after = await stat(path, { bigint: true });
  for (const key of ['dev','ino','size','mtimeNs','ctimeNs']) if (before[key] !== after[key]) throw new Error('local package changed during processing');
  return { sizeBytes: Number(after.size), sha256: hash.digest('hex') };
}
export async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const text = `${JSON.stringify(value, null, 2)}\n`; const temporary = `${path}.${process.pid}.${createHash('sha256').update(text).digest('hex').slice(0, 8)}.tmp`;
  const handle = await open(temporary, 'wx');
  try { await handle.writeFile(text); await handle.sync(); await handle.close(); await rename(temporary, path); }
  catch (error) { await handle.close().catch(() => {}); await unlink(temporary).catch(() => {}); throw error; }
}
export function readiness(summary) {
  return summary.localPackagesValid === 28 && summary.localCertificatesValid === 28 && summary.remoteObjectsMatching === 56
    && (!summary.edgeFunctionDeploymentRequired || summary.edgeFunctionDeployed) && summary.countiesRuntimeCertified === 28
    && summary.exactCasesPassed === 28 && summary.negativeControlsPassed >= 4 && summary.businessControlPassed === true;
}
