// LOCAL DISPOSABLE PROTOTYPE ONLY
// NOT A PRODUCTION AUTH SERVICE.
import { createHash, randomBytes } from 'node:crypto';

export function normalizeInvitationEmail(value) {
  const normalized = String(value).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 248) {
    throw new Error('invalid invitation email');
  }
  return normalized;
}

export function issueInvitationToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, digestHex: createHash('sha256').update(token, 'utf8').digest('hex') };
}
