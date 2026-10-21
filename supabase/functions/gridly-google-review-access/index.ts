import {createClient} from 'npm:@supabase/supabase-js@2.112.4';
import {importProductionEntitlementKey} from '../../../js/gridly-entitlement-public-key.mjs';
import {createGoogleReviewHandler,createGoogleReviewNativeAuthorizer} from '../_shared/google-review.mjs';
import {createGoogleReviewIntegrityVerifier,GOOGLE_PLAY_CLOUD_PROJECT_ID} from '../_shared/entitlement/google-integrity.mjs';
import {googleIntegrityAccessToken} from '../_shared/entitlement/google-oauth.mjs';
import {nativeAuthorizationRpcPorts} from '../_shared/entitlement/native-rpc-ports.mjs';
const from64=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
let handler=createGoogleReviewHandler();
try {
  if(Deno.env.get('GRIDLY_STORE_ENVIRONMENT')!=='production'||Deno.env.get('GRIDLY_STORE_BUNDLE_ID')!=='com.gridlygo.gridly')throw Error();
  const url=new URL(Deno.env.get('SUPABASE_URL')||''),role=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(url.origin!=='https://nhwhkbkludzkuyxmkkcj.supabase.co'||url.pathname!=='/'||url.search||url.hash||!role)throw Error();
  const db=createClient(url.origin,role,{auth:{persistSession:false,autoRefreshToken:false}});
  const rpc=async(name:string,args:Record<string,unknown>)=>{
    const result=await db.rpc(name,args).abortSignal(AbortSignal.timeout(5000));if(result.error)throw Error();return result.data;
  };
  const account=JSON.parse(Deno.env.get('GRIDLY_GOOGLE_SERVICE_ACCOUNT_JSON')||'');
  if(account.type!=='service_account'||account.project_id!==GOOGLE_PLAY_CLOUD_PROJECT_ID||
    !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com$/.test(account.client_email)||typeof account.private_key!=='string')throw Error();
  const serviceKey=await crypto.subtle.importKey('pkcs8',from64(account.private_key.split(/\r?\n/).filter((line:string)=>line&&!line.startsWith('-----')).join('')),
    {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const googleVerifier=createGoogleReviewIntegrityVerifier({accessToken:googleIntegrityAccessToken({clientEmail:account.client_email,privateKey:serviceKey})});
  const privateKey=await crypto.subtle.importKey('pkcs8',from64(Deno.env.get('GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64')||''),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const publicKey=await importProductionEntitlementKey();if(!publicKey)throw Error();
  handler=createGoogleReviewHandler({publicKey,privateKey,authorizeNative:createGoogleReviewNativeAuthorizer({store:nativeAuthorizationRpcPorts(db),googleVerifier}),
    credentialAuthority:({action,credentialId,digest,revision}:{action:string,credentialId:string,digest?:string,revision?:string})=>rpc('gridly_google_review_authorize',
      {p_action:action,p_credential:credentialId,p_digest:digest??null,p_revision:revision??null}),
    reportingStatus:()=>rpc('get_community_reporting_status',{})});
}catch{handler=createGoogleReviewHandler();}
Deno.serve(handler);
