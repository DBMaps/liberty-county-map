import { randomUUID } from 'node:crypto';
import { safePayload } from './logic.mjs';
import { sendAlert } from './resend.mjs';

// Owner-run outside Codex after Resend setup. No production database access.
const now = new Date();
const payload = safePayload({ subsystem: 'report_retention', state: 'stale',
  observedAt: now, errorCategory: 'synthetic_test' });
await sendAlert(payload, {
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.ALERT_FROM,
  to: process.env.ALERT_TO,
  idempotencyKey: `gridly-cleanup-${randomUUID()}`,
  synthetic: true,
});
console.log(`Synthetic Gridly cleanup alert accepted at ${now.toISOString()}; owner inbox receipt still required.`);
