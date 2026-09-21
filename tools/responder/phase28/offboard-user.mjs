// Server-side orchestration contract; no credentials, URLs, or automatic execution.
// This phase exercises it only against disposable loopback Auth.
export async function offboardUser({organizationId,userId,jobId,beginKey,completeKey,command,deleteAuthUser}) {
 for(const value of [organizationId,userId,jobId,beginKey,completeKey]) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value??''))throw new Error('Explicit UUID identities and retry keys required');
 }
 if(beginKey===completeKey)throw new Error('Distinct step retry keys required');
 // The database first checks ownership safeguards and disables Dispatch access.
 await command('begin_user_offboarding',{organization_id:organizationId,user_id:userId,object_id:jobId,idempotency_key:beginKey});
 const removed=await deleteAuthUser(userId);
 if(![200,204,404].includes(removed.status))throw new Error('Auth revocation failed; subject remains disabled and job incomplete');
 // Auth absence is verified in the database, not inferred from this HTTP result.
 return command('complete_user_offboarding',{organization_id:organizationId,object_id:jobId,expected_revision:1,idempotency_key:completeKey});
}
