import {createClient} from 'npm:@supabase/supabase-js@2.112.4';
import {createSandboxAcceptanceServer} from './server-setup.mjs';
import {createNativeAuthorizer} from './native-authorization.mjs';
import {nativeAuthorizationRpcPorts} from './native-rpc-ports.mjs';
import {createGoogleIntegrityVerifier,GOOGLE_PLAY_CLOUD_PROJECT_ID} from './google-integrity.mjs';
import {googleIntegrityAccessToken} from './google-oauth.mjs';
import {createHandler} from './handler.mjs';

const closed=()=>createHandler({platform:'google'});
const origin='https://nhwhkbkludzkuyxmkkcj.supabase.co';
const from64=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const readSecret=(name:string)=>Deno.env.get(name==='GRIDLY_STORE_ENVIRONMENT'?'GRIDLY_SANDBOX_STORE_ENVIRONMENT':
  name==='GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64'?'GRIDLY_SANDBOX_ENTITLEMENT_SIGNING_PKCS8_B64':name);

// A separate endpoint and signing key bind this deployment to sandbox/test.
// The existing Google credential, fingerprint and ack cipher remain shared with
// RTDN so both paths reconcile the same verified purchase in the same database.
export async function sandboxGoogleEdgeRuntime() {
  try {
    if(readSecret('GRIDLY_STORE_ENVIRONMENT')!=='sandbox/test'||readSecret('SUPABASE_URL')!==origin)throw Error();
    const role=readSecret('SUPABASE_SERVICE_ROLE_KEY');if(!role)throw Error();
    const db=createClient(origin,role,{auth:{persistSession:false,autoRefreshToken:false}});
    const account=JSON.parse(readSecret('GRIDLY_GOOGLE_SERVICE_ACCOUNT_JSON')||'');
    if(account.type!=='service_account'||account.project_id!==GOOGLE_PLAY_CLOUD_PROJECT_ID||
      !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com$/.test(account.client_email)||
      typeof account.private_key!=='string')throw Error();
    const der=from64(account.private_key.split(/\r?\n/).filter((line:string)=>line&&!line.startsWith('-----')).join(''));
    const privateKey=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
    const googleVerifier=createGoogleIntegrityVerifier({accessToken:googleIntegrityAccessToken({clientEmail:account.client_email,privateKey}),
      acceptedEnvironment:'sandbox/test'});
    const authorizeNative=createNativeAuthorizer({store:nativeAuthorizationRpcPorts(db),googleVerifier});
    const server=await createSandboxAcceptanceServer({readSecret,authorizeNative,
      makeSupabaseClient:(url:string,key:string,options:object)=>createClient(url,key,options)});
    return server.google;
  } catch {return closed();}
}
