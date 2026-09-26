import { safePayload } from './logic.mjs';

export function formatAlert(input, { synthetic = false } = {}) {
  // Reconstruct the payload from an allowlist; never serialize input or an error object.
  const payload = safePayload({
    subsystem: input?.cleanup_subsystem,
    state: input?.health_state,
    observedAt: input?.observed_at,
    lastSuccessAt: input?.last_success_at,
    overdueCount: input?.overdue_count,
    breachedCount: input?.breached_count,
    errorCategory: input?.error_category,
  });
  const subject = `[Gridly PROD${synthetic ? ' TEST' : input?.error_category==='recovery' ? ' RECOVERY' : ''}] ${payload.cleanup_subsystem}: ${payload.health_state}`;
  const text = [
    `Environment: ${payload.environment}`,
    `Cleanup subsystem: ${payload.cleanup_subsystem}`,
    `Health state: ${payload.health_state}`,
    `Observed at UTC: ${payload.observed_at}`,
    `Last success UTC: ${payload.last_success_at ?? 'unavailable'}`,
    `Overdue count: ${payload.overdue_count}`,
    `Breach count: ${payload.breached_count}`,
    `Error category: ${payload.error_category ?? 'none'}`,
  ].join('\n');
  return { subject, text };
}

export async function sendAlert(input, { apiKey, from, to, idempotencyKey,
  synthetic = false, fetchImpl = fetch } = {}) {
  const { subject, text } = formatAlert(input, { synthetic });
  if (!apiKey || !from || !to || !idempotencyKey || !/^gridly-cleanup-[a-f0-9-]{36}$/.test(idempotencyKey)) {
    throw new Error('delivery_configuration_missing');
  }
  let response;
  try {
    response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
  } catch {
    throw new Error('delivery_failed');
  }
  if (!response?.ok) throw new Error('delivery_failed');
  try {
    const result = await response.json();
    if (typeof result?.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(result.id)) {
      throw new Error('delivery_failed');
    }
  } catch {
    throw new Error('delivery_failed');
  }
  return { accepted: true };
}
