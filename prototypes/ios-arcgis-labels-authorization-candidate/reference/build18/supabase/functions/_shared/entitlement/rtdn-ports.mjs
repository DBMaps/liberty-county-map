// Fixed service-role RPCs. PostgREST errors never leave this server module.
export function googleRtdnReceiptPorts(client){
 if(typeof client?.rpc!=='function')throw Error('subscription_unavailable');
 const call=async(name,args)=>{
  try{const request=client.rpc(name,args);if(typeof request?.abortSignal!=='function')throw Error();
   const result=await request.abortSignal(AbortSignal.timeout(8000));
   if(result?.error)throw Error();return result?.data;
  }catch{throw Error('subscription_unavailable');}
 };
 return Object.freeze({
  claim:async messageId=>{const row=await call('gridly_claim_google_rtdn',{p_message_id:messageId});
   if(!row||typeof row!=='object'||!['claimed','done','terminal','busy'].includes(row.status))throw Error('subscription_unavailable');return row;},
  finish:async(messageId,lease,outcome,category)=>{
   const result=await call('gridly_finish_google_rtdn',{p_message_id:messageId,p_lease:lease,p_outcome:outcome,p_error_category:category});
   if(typeof result!=='boolean')throw Error('subscription_unavailable');return result;},
  health:()=>call('gridly_google_rtdn_health',{})
 });
}
