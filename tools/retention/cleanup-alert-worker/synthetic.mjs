import { sendAlert } from './resend.mjs';
import { safePayload } from './logic.mjs';
// Local owner-only entrypoint; no database/Edge read, no public HTTP trigger.
export async function syntheticEmail(env,{now=new Date(),send=sendAlert}={}) {
 return send(safePayload({subsystem:'cleanup_monitor',state:'monitor_error',observedAt:now,errorCategory:'synthetic_test'}),{apiKey:env.RESEND_API_KEY,from:env.ALERT_FROM,to:env.ALERT_TO,idempotencyKey:'gridly-cleanup-'+crypto.randomUUID(),synthetic:true});
}
