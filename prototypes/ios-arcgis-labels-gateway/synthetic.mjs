import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createMockGateway, publicKeyFingerprint, tileProofBytes } from './gateway.mjs';

export const START = Date.UTC(2026, 10, 12, 12);
export const TARGET = '/v1/imagery-labels/12/1689/968';

export function syntheticScenario({ start = START, environment = 'production', ...options } = {}) {
  let current = start;
  const now = () => current;
  const paidRecords = new Map(), integrityRecords = new Map();
  const gateway = createMockGateway({ environment, now, ...options,
    verifyPaid: evidence => paidRecords.get(evidence),
    verifyIntegrity: evidence => integrityRecords.get(evidence) });

  function client({ installation = randomUUID(), lineage = randomUUID() } = {}) {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    return {
      publicKey,
      evidence({ paid = {}, integrity = {}, requested = environment } = {}) {
        const paidEvidence = randomUUID(), integrityEvidence = randomUUID();
        paidRecords.set(paidEvidence, { verified: true, kind: 'paid_admission', revoked: false,
          environment, lineage, evidenceId: paidEvidence, verifiedAt: now(), periodEnd: now() + 86_400_000, ...paid });
        integrityRecords.set(integrityEvidence, { verified: true, environment, installation, challengeId: integrityEvidence,
          verifiedAt: now(), paidEvidenceId: paidEvidence, keyFingerprint: publicKeyFingerprint(publicKey), ...integrity });
        return { environment: requested, paidEvidence, integrityEvidence, publicKey };
      },
      request(lease, overrides = {}) {
        const request = { method: 'GET', target: TARGET, leaseId: lease.leaseId, timestamp: now(), requestId: randomUUID(), ...overrides };
        const signature = sign('sha256', tileProofBytes(request), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
        return { ...request, signature };
      }
    };
  }
  return { gateway, client, now, advance: ms => { current += ms; },
    clearEvidence: () => { paidRecords.clear(); integrityRecords.clear(); } };
}
