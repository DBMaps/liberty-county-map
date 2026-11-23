// Inject a server-only Supabase client created with its secret/service-role key.
// The adapter never surfaces PostgREST errors (which can contain SQL arguments).
export function subscriptionRpcPorts(client) {
 if(typeof client?.rpc!=='function')throw Error('subscription_unavailable');
 async function call(name,args) {
  try {const request=client.rpc(name,args);
  if(typeof request?.abortSignal!=='function')throw Error('subscription_unavailable');
  const result=await request.abortSignal(AbortSignal.timeout(8000));
  if(result?.error)throw Error('subscription_unavailable');return result?.data;}catch{throw Error('subscription_unavailable');}
 }
 const boolean=async(name,args)=>{const value=await call(name,args);if(typeof value!=='boolean')throw Error('subscription_unavailable');return value;};
 return Object.freeze({cache:Object.freeze({apply:(record,lineage=[])=>record?.platform==='google'?
  boolean('gridly_reconcile_google_entitlement',{p_record:record,p_lineage:lineage}):
  boolean('gridly_reconcile_store_entitlement',{p_record:record})}),
 store:Object.freeze({enqueue:record=>boolean('gridly_enqueue_google_ack',{p_record:record}),
 claim:async input=>{const rows=await call('gridly_claim_google_ack',{p_environment:input.environment,p_limit:input.limit,p_fingerprint:input.chain_fingerprint});if(!Array.isArray(rows)||rows.length>input.limit)throw Error('subscription_unavailable');return rows;},
 resolve:input=>boolean('gridly_resolve_google_ack',{p_environment:input.environment,p_fingerprint:input.chain_fingerprint,p_lease:input.lease,p_outcome:input.outcome,p_error_category:input.error_category}),
 health:()=>call('gridly_google_ack_health',{}),
 completeRun:input=>boolean('gridly_complete_google_ack_run',{p_environment:input.environment,p_error_category:input.error_category}),
 housekeeping:()=>call('gridly_subscription_housekeeping',{})})});
}
