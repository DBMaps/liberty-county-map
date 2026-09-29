// LP244.66S public-only Lambda capability probe. Invoke directly through AWS Lambda,
// without a Function URL, credentials, transaction data, or production integration.
import { Buffer } from 'node:buffer';
import { X509Certificate } from 'node:crypto';
import { SignedDataVerifier, Environment } from '@apple/app-store-server-library';
import {
  REAL_APPLE_ROOT_BASE64_ENCODED as rootB64,
  REAL_APPLE_INTERMEDIATE_BASE64_ENCODED as intermediateB64,
  REAL_APPLE_SIGNING_CERTIFICATE_BASE64_ENCODED as leafB64
} from './public-apple-fixture.mjs';

const cert = encoded => new X509Certificate(Buffer.from(encoded, 'base64'));
const b64url = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const emptySignature = Buffer.alloc(64).toString('base64url');
const publicChain = [leafB64, intermediateB64, rootB64];
const syntheticPayload = Object.freeze({
  originalTransactionId: 'public-probe-original',
  transactionId: 'public-probe-transaction',
  bundleId: 'com.gridlygo.gridly',
  productId: 'com.gridlygo.gridly.monthly',
  type: 'Auto-Renewable Subscription',
  environment: 'Sandbox',
  signedDate: Date.now()
});
const syntheticJws = chain => [b64url({alg: 'ES256', x5c: chain}), b64url(syntheticPayload), emptySignature].join('.');

const denies = async (verifier, value) => {
  try { await verifier.verifyAndDecodeTransaction(value); return false; }
  catch { return true; }
};

async function apiReachable(url, fetchImpl) {
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(8000)
    });
    await response.body?.cancel();
    // Without credentials, an Apple 4xx is the expected network-level result.
    return response.status >= 400 && response.status < 500;
  } catch { return false; }
}

export async function runPreflight({fetchImpl = fetch} = {}) {
  const result = {
    runtime: process.version,
    libraryBoot: typeof SignedDataVerifier === 'function',
    x509Raw: false,
    chainSignatures: false,
    onlineChecks: false,
    publicChainOcsp: false,
    malformedDenied: false,
    badChainDenied: false,
    badSignatureDenied: false,
    appleProductionApiReachable: false,
    appleSandboxApiReachable: false,
    pass: false
  };
  try {
    const root = cert(rootB64), intermediate = cert(intermediateB64), leaf = cert(leafB64);
    result.x509Raw = root.raw.length > 100 && intermediate.raw.length > 100 && leaf.raw.length > 100;
    result.chainSignatures = intermediate.verify(root.publicKey) && leaf.verify(intermediate.publicKey);
    const verifier = new SignedDataVerifier([root.raw], true, Environment.SANDBOX, 'com.gridlygo.gridly');
    result.onlineChecks = verifier.enableOnlineChecks === true;
    // Apple's implementation checks root, extensions, validity and both OCSP responses.
    try {
      await verifier.verifyCertificateChain(verifier.rootCertificates, leaf, intermediate, new Date());
      result.publicChainOcsp = true;
    } catch { /* No status cause or certificate material in output. */ }
    result.malformedDenied = await denies(verifier, 'a.b.c.d');
    result.badChainDenied = await denies(verifier, syntheticJws([leafB64, leafB64, rootB64]));
    if (result.publicChainOcsp) {
      // Valid Apple public chain, valid synthetic claim shape, deliberately bad ES256 signature.
      result.badSignatureDenied = await denies(verifier, syntheticJws(publicChain));
    }
    result.appleProductionApiReachable = await apiReachable('https://api.storekit.apple.com/inApps/v1/subscriptions/0', fetchImpl);
    result.appleSandboxApiReachable = await apiReachable('https://api.storekit-sandbox.apple.com/inApps/v1/subscriptions/0', fetchImpl);
  } catch { /* Fail closed; this function reports booleans only. */ }
  result.pass = Object.entries(result).filter(([key]) => key !== 'runtime' && key !== 'pass').every(([, value]) => value === true);
  return result;
}

export async function handler(event) {
  // Deliberately no Function URL/API Gateway path for this capability probe.
  if (!event || Object.keys(event).length !== 1 || event.probe !== 'lp24466s_public_chain') {
    return {accepted: false};
  }
  return runPreflight();
}
