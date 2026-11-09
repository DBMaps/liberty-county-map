// Owner-side primitive. No filesystem, console, clipboard, or network access.
// The caller must first enforce the existing private-file intake contract.
import {createCipheriv, createHash, randomBytes, sign} from 'node:crypto';
import {validateProviderPair} from './contracts.mjs';

export function sealBuild18Candidate({originalBytes, candidateBytes, run, signingKey, now = Date.now()}) {
  validateProviderPair({originalBytes, candidateBytes});
  const tokenText = JSON.parse(candidateBytes).arcgisStaticBasemapApiKey;
  const expires = Math.floor(now / 1000) + 900;
  if (typeof run !== 'string' || run.length !== 38 || !/^owner-[a-f0-9]{32}$/.test(run) ||
      signingKey?.type !== 'private' || signingKey?.asymmetricKeyType !== 'ed25519' ||
      !Number.isSafeInteger(expires) || !/^[0-9]{10}$/.test(String(expires)) ||
      !/^[A-Za-z0-9_.~-]{16,4096}$/.test(tokenText) || /[^A-Za-z0-9_.~-]/.test(tokenText)) {
    throw new Error('BUILD18_PRIVATE_INPUT_REJECTED');
  }
  const token = Buffer.from(tokenText, 'ascii');
  const key = randomBytes(32);
  let plaintext;
  try {
    const digest = createHash('sha256').update(token).digest('hex');
    const aad = Buffer.from(['GRIDLY_BUILD18_CANDIDATE_V1','com.gridlygo.gridly','1.0.2','18',run,digest,''].join('\n'));
    const nonce = randomBytes(12);
    plaintext = Buffer.concat([Buffer.from(String(expires) + '\n'), token]);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const envelope = Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]);
    const grantFields = [run, digest, key.toString('hex')];
    const envelopeDigest = createHash('sha256').update(envelope).digest('hex');
    const authorization = Buffer.from(['GRIDLY_BUILD18_OWNER_GRANT_V1', ...grantFields, envelopeDigest, ''].join('\n'));
    try {
      const signature = sign(null, authorization, signingKey);
      // The signed grant is private and travels separately from the envelope.
      return {envelope, grant: [...grantFields, signature.toString('hex')].join('.')};
    } finally {
      authorization.fill(0);
    }
  } finally {
    key.fill(0);
    token.fill(0);
    plaintext?.fill(0);
  }
}
