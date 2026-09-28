// Only a server-side client with its service-role credential may call these RPCs.
export function nativeAuthorizationRpcPorts(client) {
  if(typeof client?.rpc !== 'function') throw Error('native_authorization_unavailable');
  async function rpc(name,args) {
    try {const query=client.rpc(name,args);if(typeof query?.abortSignal !== 'function')throw Error();
      const result=await query.abortSignal(AbortSignal.timeout(5000));
      if(result?.error)throw Error();return result?.data;
    } catch {throw Error('native_authorization_unavailable');}
  }
  return Object.freeze({
    issue:async ({hash,platform,purpose,expiresAt})=>
      (await rpc('gridly_issue_native_challenge',{p_hash:hash,p_platform:platform,p_purpose:purpose,p_expires_at:expiresAt}))===true,
    readAppleKey:async keyHash=>{
      const data=await rpc('gridly_read_app_attest_key',{p_key_hash:keyHash});
      return data && typeof data==='object' && !Array.isArray(data) ? data : null;
    },
    consume:async ({hash,platform,purpose,verdict})=>{
      if(verdict?.verified!==true || verdict.platform!==platform) return false;
      const kind=verdict.kind;
      if(!['apple_initial','apple_assertion','google_standard'].includes(kind))return false;
      if((platform==='google') !== (kind==='google_standard'))return false;
      return (await rpc('gridly_consume_native_challenge',{p_hash:hash,p_platform:platform,p_purpose:purpose,
        p_kind:kind,p_key_hash:verdict.keyHash??null,p_public_spki:verdict.publicSpki??null,
        p_counter:verdict.counter??null}))===true;
    }
  });
}
