import {googlePubSubAuthenticator} from './rtdn-auth.mjs';
import {createGoogleRtdnHandler} from './rtdn.mjs';
import {googleRtdnReceiptPorts} from './rtdn-ports.mjs';
import {subscriptionRpcPorts} from './rpc-ports.mjs';
import {googleServiceAccessToken} from './google-oauth.mjs';
import {GOOGLE_PLAY_CLOUD_PROJECT_ID} from './google-integrity.mjs';
import {googleAdapter} from './providers.mjs';
import {tokenCipher,acknowledgmentQueue} from './acknowledgment.mjs';
const endpoint='https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-google-rtdn';
const decode=(value,max=16384)=>{
 if(typeof value!=='string'||!value||value.length>max||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error();
 return Uint8Array.from(atob(value),c=>c.charCodeAt(0));
};
// All credentials come from server-held secrets. Missing configuration is 503.
export async function createGoogleRtdnRuntime({readSecret,makeSupabaseClient,fetchImpl=fetch,crypto=globalThis.crypto}={}){
 try{
  if(typeof readSecret!=='function'||typeof makeSupabaseClient!=='function')throw Error();
  const required=name=>{const value=readSecret(name);if(typeof value!=='string'||!value)throw Error();return value;};
  const url=new URL(required('SUPABASE_URL'));
  if(url.origin!=='https://nhwhkbkludzkuyxmkkcj.supabase.co'||url.pathname!=='/'||url.search||url.hash||url.username||url.password||
   required('GRIDLY_STORE_ENVIRONMENT')!=='production'||required('GRIDLY_STORE_BUNDLE_ID')!=='com.gridlygo.gridly')throw Error();
  const account=JSON.parse(required('GRIDLY_GOOGLE_SERVICE_ACCOUNT_JSON'));
  if(account.type!=='service_account'||account.project_id!==GOOGLE_PLAY_CLOUD_PROJECT_ID||
   !/^[a-zA-Z0-9._-]+@gridly-play-billing\.iam\.gserviceaccount\.com$/.test(account.client_email)||
   (account.token_uri!==undefined&&account.token_uri!=='https://oauth2.googleapis.com/token'))throw Error();
  const der=decode(account.private_key.split(/\r?\n/).filter(line=>line&&!line.startsWith('-----')).join(''));
  const privateKey=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const fingerprint=decode(required('GRIDLY_ENTITLEMENT_FINGERPRINT_KEY_B64'));if(fingerprint.length!==32)throw Error();
  const fingerprintKey=await crypto.subtle.importKey('raw',fingerprint,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const currentBytes=decode(required('GRIDLY_GOOGLE_ACK_AES_CURRENT_KEY_B64'));if(currentBytes.length!==32)throw Error();
  const current={version:required('GRIDLY_GOOGLE_ACK_AES_CURRENT_VERSION'),key:await crypto.subtle.importKey('raw',currentBytes,'AES-GCM',false,['encrypt','decrypt'])};
  let previous;const pv=readSecret('GRIDLY_GOOGLE_ACK_AES_PREVIOUS_VERSION'),pk=readSecret('GRIDLY_GOOGLE_ACK_AES_PREVIOUS_KEY_B64'),until=readSecret('GRIDLY_GOOGLE_ACK_AES_PREVIOUS_RETIRE_AT');
  if(pv||pk||until){const bytes=decode(pk);if(bytes.length!==32)throw Error();previous={version:pv,key:await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']),retireAt:until};}
  const db=makeSupabaseClient(url.origin,required('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
  const ports=subscriptionRpcPorts(db),receipts=googleRtdnReceiptPorts(db);
  const provider=googleAdapter({env:'auto',accessToken:googleServiceAccessToken({clientEmail:account.client_email,privateKey,crypto,fetchImpl}),fetchImpl});
  const cipher=tokenCipher({current,previous,crypto});
  const ackQueues=Object.fromEntries(['production','sandbox/test'].map(environment=>[environment,
   acknowledgmentQueue({environment,store:ports.store,cipher,provider,cache:ports.cache,fingerprintKey,crypto})]));
  const authenticate=googlePubSubAuthenticator({serviceAccountEmail:required('GRIDLY_GOOGLE_RTDN_PUSH_IDENTITY_EMAIL'),audience:endpoint,fetchImpl,crypto});
  const subscription=required('GRIDLY_GOOGLE_RTDN_SUBSCRIPTION');
  if(!subscription.startsWith('projects/gridly-play-billing/subscriptions/'))throw Error();
  return createGoogleRtdnHandler({authenticate,subscription,receipts,provider,cache:ports.cache,ackQueues,fingerprintKey,crypto});
 }catch{return createGoogleRtdnHandler();}
}
