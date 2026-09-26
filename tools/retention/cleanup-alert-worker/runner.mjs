import { classifyHealth, monitorError, SUBSYSTEMS } from './logic.mjs';
import { sendAlert } from './resend.mjs';


const REMINDER_MS = 60 * 60_000;

function signature(payload) {
  return JSON.stringify([
    payload.cleanup_subsystem, payload.health_state,
    payload.overdue_count, payload.breached_count, payload.error_category,
  ]);
}

async function deliverOnce(payload, { env, now, send }) {
  const key = `gridly-cleanup-alert:${payload.cleanup_subsystem}`;
  const prior = await env.ALERT_STATE.get(key, 'json');
  if (payload.health_state === 'healthy') {
    if(prior?.sent_at) await send({...payload,error_category:'recovery'}, {apiKey:env.RESEND_API_KEY,from:env.ALERT_FROM,to:env.ALERT_TO,idempotencyKey:'gridly-cleanup-'+prior.recovery_id,recovery:true});
    if (prior !== null) await env.ALERT_STATE.delete(key);
    return 'healthy';
  }
  const currentSignature = signature(payload);
  const priorSentAt = Date.parse(prior?.sent_at ?? '');
  if (prior?.signature === currentSignature && Number.isFinite(priorSentAt)
      && now.getTime() - priorSentAt < REMINDER_MS) return 'suppressed';

  // Save the exact payload and idempotency key before delivery. A retry uses
  // the same request even if the Resend response is lost.
  const pending = prior?.signature === currentSignature && prior?.sent_at === null
    && /^gridly-cleanup-[a-f0-9-]{36}$/.test(prior?.idempotency_key ?? '')
    ? prior : {
      signature: currentSignature,
      recovery_id: crypto.randomUUID(),
      sent_at: null,
      idempotency_key: `gridly-cleanup-${crypto.randomUUID()}`,
      payload,
    };
  if (pending !== prior) await env.ALERT_STATE.put(key, JSON.stringify(pending));
  await send(pending.payload, {
    apiKey: env.RESEND_API_KEY,
    from: env.ALERT_FROM,
    to: env.ALERT_TO,
    idempotencyKey: pending.idempotency_key,
  });
  await env.ALERT_STATE.put(key, JSON.stringify({ ...pending, sent_at: now.toISOString() }));
  return 'accepted';
}

export async function runScheduled({ env, queryHealth, now = new Date(), send = sendAlert }) {
  if (!env?.ALERT_STATE || !env?.RESEND_API_KEY || !env?.ALERT_FROM || !env?.ALERT_TO) {
    throw new Error('monitor_configuration_missing');
  }
  let states;
  try {
    const rows = await queryHealth();
    states = classifyHealth(rows, now);
  } catch (error) {
    states = [monitorError(now, error?.message === 'invalid_health_projection'
      ? 'invalid_status' : 'query_failed')];
  }
  if (states.length === SUBSYSTEMS.length) {
    const monitorKey = 'gridly-cleanup-alert:cleanup_monitor';
    if (await env.ALERT_STATE.get(monitorKey, 'json') !== null) {
      await deliverOnce({ ...monitorError(now),health_state:'healthy',error_category:'recovery' },{env,now,send});
    }
  }
  const outcomes = [];
  for (const payload of states) {
    outcomes.push(await deliverOnce(payload, { env, now, send }));
  }
  return { health_states: states.map(value => value.health_state), delivery: outcomes };
}
