import {createClient} from 'npm:@supabase/supabase-js@2.112.4';
import * as appleLibrary from 'npm:@apple/app-store-server-library@3.1.0';
import {createProductionServer} from './server-setup.mjs';
import {createNativeAuthorizer} from './native-authorization.mjs';
import {nativeAuthorizationRpcPorts} from './native-rpc-ports.mjs';
import {subscriptionRpcPorts} from './rpc-ports.mjs';
import {createAppleAppAttestVerifier} from './apple-app-attest.mjs';
import {createGoogleIntegrityVerifier,GOOGLE_PLAY_CLOUD_PROJECT_ID} from './google-integrity.mjs';
import {googleIntegrityAccessToken} from './google-oauth.mjs';
import {createHandler} from './handler.mjs';

const closed=(platform:string)=>createHandler({platform});
const validUrl=(value:string)=>{const url=new URL(value);
  if(url.protocol!=='https:'||! /^[a-z0-9]+\.supabase\.co$/.test(url.hostname)||url.pathname!=='/'||url.search||url.hash)throw Error();
  return url.origin;};
const from64=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const readSecret=(name:string)=>Deno.env.get(name);
const makeSupabaseClient=(url:string,key:string,options:object)=>createClient(url,key,options);

// An import does not read secrets or deploy anything. Each isolate builds only
// server-held ports; malformed or absent config leaves the endpoint closed.
export async function productionEdgeRuntime() {
  try {
    const url=validUrl(readSecret('SUPABASE_URL')||''),role=readSecret('SUPABASE_SERVICE_ROLE_KEY');
    if(!role)throw Error();
    const db=createClient(url,role,{auth:{persistSession:false,autoRefreshToken:false}});
    const nativeStore=nativeAuthorizationRpcPorts(db);
    const appleVerifier=createAppleAppAttestVerifier();
    let googleVerifier;
    try {
      const account=JSON.parse(readSecret('GRIDLY_GOOGLE_SERVICE_ACCOUNT_JSON')||'');
      if(account.type!=='service_account'||account.project_id!==GOOGLE_PLAY_CLOUD_PROJECT_ID||
        !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com$/.test(account.client_email)||
        typeof account.private_key!=='string')throw Error();
      const der=from64(account.private_key.split(/\r?\n/).filter((line:string)=>line&&!line.startsWith('-----')).join(''));
      const privateKey=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
      googleVerifier=createGoogleIntegrityVerifier({accessToken:googleIntegrityAccessToken({clientEmail:account.client_email,privateKey})});
    } catch {googleVerifier=undefined;}
    const authorizeNative=createNativeAuthorizer({store:nativeStore,appleVerifier,googleVerifier});
    let roots=[];
    try {const encoded=JSON.parse(readSecret('GRIDLY_APPLE_STORE_ROOTS_B64')||'');
      if(!Array.isArray(encoded)||encoded.length<1||encoded.length>8)throw Error();
      roots=encoded.map((item:string)=>from64(item));}catch{roots=[];}
    const server=await createProductionServer({readSecret,authorizeNative,makeSupabaseClient,appleLibrary,appleRoots:roots});
    return Object.freeze({apple:server.apple,google:googleVerifier?server.google:closed('google'),
      retryGoogle:googleVerifier?server.retryGoogle:null,store:subscriptionRpcPorts(db).store});
  } catch {return Object.freeze({apple:closed('apple'),google:closed('google'),retryGoogle:null,store:null});}
}
