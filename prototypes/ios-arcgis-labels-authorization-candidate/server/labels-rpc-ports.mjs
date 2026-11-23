// Trusted server-only connection port. No URL, credentials or default connection.
// query(text, values, {signal}) must honor cancellation; destroy() fences unknown outcomes.
export function createLabelsRpcPorts({connect}={}) {
 async function call(sql,values,caller) {
  if(typeof connect!=='function')throw Error('labels_registry_unavailable');
  const signal=AbortSignal.any([AbortSignal.timeout(3000),...(caller?[caller]:[])]);
  let client,committed=false;
  const abort=new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('labels_registry_unavailable')),{once:true}));
  const work=(async()=>{
   signal.throwIfAborted();client=await connect({signal});signal.throwIfAborted();
   if(typeof client?.query!=='function'||typeof client?.destroy!=='function')throw Error();
   const query=(text,args=[])=>client.query(text,args,{signal});
   await query('BEGIN');
   await query("SET LOCAL statement_timeout='2000ms'; SET LOCAL lock_timeout='750ms'; SET LOCAL ROLE labels_auth_verifier");
   const result=await query(sql,values);signal.throwIfAborted();
   await query('COMMIT');committed=true;signal.throwIfAborted();
   return result?.rows?.[0]?.result;
  })();
  try{return await Promise.race([work,abort]);}
  catch{throw Error('labels_registry_unavailable');}
  finally{
   // Destruction closes/rolls back a live transaction. Never return an uncertain connection to a pool.
   if(client)client.destroy();
   void work.finally(()=>{if(client&&!committed)client.destroy();}).catch(()=>{});
  }
 }
 return Object.freeze({
  issue:({id,keyHash,fingerprint,paidDigest,signal})=>call('select labels_auth.issue_challenge($1,$2,$3,$4) as result',[id,keyHash,fingerprint,paidDigest],signal),
  read:({id,signal})=>call('select labels_auth.read_challenge($1) as result',[id],signal),
  consume:({id,keyHash,binding,counter,signal})=>call('select labels_auth.consume_challenge($1,$2,$3,$4) as result',[id,keyHash,binding,counter],signal)
 });
}
