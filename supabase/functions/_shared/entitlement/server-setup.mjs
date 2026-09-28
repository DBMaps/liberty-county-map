import {productionComposition,sandboxAcceptanceComposition} from './composition.mjs';
import {subscriptionRpcPorts} from './rpc-ports.mjs';
import {googleServiceAccessToken} from './google-oauth.mjs';
import {GOOGLE_PLAY_CLOUD_PROJECT_ID} from './google-integrity.mjs';
const bundle='com.gridlygo.gridly';
function bytes(value,max=16384){if(typeof value!=='string'||value.length>max||! /^[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('configuration_unavailable');return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
// Operator supplied secrets, official Apple constructors and DER trust assets;
// never accept these ports, environment or verification keys from an HTTP body.
async function setup(environment,{readSecret,authorizeNative,makeSupabaseClient,appleLibrary,appleRoots,crypto=globalThis.crypto,fetchImpl=fetch}={}) {
 const factory=environment==='production'?productionComposition:sandboxAcceptanceComposition;
 try{
  if(typeof readSecret!=='function'||typeof authorizeNative!=='function'||typeof makeSupabaseClient!=='function')throw Error();
  const secret=name=>{const value=readSecret(name);if(typeof value!=='string'||!value)throw Error();return value;};
  // Read a separate deployment secret namespace; no request-driven test switch.
  if(secret('GRIDLY_STORE_ENVIRONMENT')!==environment||secret('GRIDLY_STORE_BUNDLE_ID')!==bundle)throw Error();
  const url=new URL(secret('SUPABASE_URL'));if(url.protocol!=='https:'||! /^[a-z0-9]+\.supabase\.co$/.test(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error();
  const privateKey=await crypto.subtle.importKey('pkcs8',bytes(secret('GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64')),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const fingerprintBytes=bytes(secret('GRIDLY_ENTITLEMENT_FINGERPRINT_KEY_B64'));if(fingerprintBytes.length!==32)throw Error();
  const fingerprintKey=await crypto.subtle.importKey('raw',fingerprintBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const rpc=subscriptionRpcPorts(makeSupabaseClient(url.origin,secret('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}}));
  const common={authorizeNative,cache:rpc.cache,signingKey:privateKey,fingerprintKey,crypto};let apple,google;
  // Platform configuration errors disable that platform independently.
  try{
   const issuer=secret('GRIDLY_APPLE_ISSUER_ID'),keyId=secret('GRIDLY_APPLE_KEY_ID'),p8=secret('GRIDLY_APPLE_PRIVATE_KEY_P8');
   if(! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(issuer)||! /^[A-Z0-9]{10}$/.test(keyId)||!Array.isArray(appleRoots)||appleRoots.length<1||appleRoots.length>8||appleRoots.some(root=>!(root instanceof Uint8Array)||root.length<100||root.length>8192))throw Error();
   const appIdText=readSecret('GRIDLY_APPLE_APP_ID');let appId;
   if(appIdText!==undefined&&appIdText!==''){if(! /^[1-9][0-9]{0,15}$/.test(appIdText)||!Number.isSafeInteger(Number(appIdText)))throw Error();appId=Number(appIdText);}
   if(environment==='production'&&appId===undefined)throw Error();
   const env=environment==='production'?appleLibrary.Environment.PRODUCTION:appleLibrary.Environment.SANDBOX;
   apple={apiClient:new appleLibrary.AppStoreServerAPIClient(p8,keyId,issuer,bundle,env),signedVerifier:new appleLibrary.SignedDataVerifier(appleRoots,true,env,bundle,appId)};
  }catch{apple=undefined;}
  try{
   const account=JSON.parse(secret('GRIDLY_GOOGLE_SERVICE_ACCOUNT_JSON'));
   if(account.type!=='service_account'||account.project_id!==GOOGLE_PLAY_CLOUD_PROJECT_ID||typeof account.private_key!=='string'||(account.token_uri!==undefined&&account.token_uri!=='https://oauth2.googleapis.com/token'))throw Error();
   const der=bytes(account.private_key.split(/\r?\n/).filter(line=>line&&!line.startsWith('-----')).join(''));
   const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
   const aes=bytes(secret('GRIDLY_GOOGLE_ACK_AES_CURRENT_KEY_B64'));if(aes.length!==32)throw Error();
   const current={version:secret('GRIDLY_GOOGLE_ACK_AES_CURRENT_VERSION'),key:await crypto.subtle.importKey('raw',aes,'AES-GCM',false,['encrypt','decrypt'])};
   let previous;const pv=readSecret('GRIDLY_GOOGLE_ACK_AES_PREVIOUS_VERSION'),pk=readSecret('GRIDLY_GOOGLE_ACK_AES_PREVIOUS_KEY_B64'),until=readSecret('GRIDLY_GOOGLE_ACK_AES_PREVIOUS_RETIRE_AT');
   if(pv||pk||until){const old=bytes(pk);if(old.length!==32)throw Error();previous={version:pv,key:await crypto.subtle.importKey('raw',old,'AES-GCM',false,['encrypt','decrypt']),retireAt:until};}
   google={accessToken:googleServiceAccessToken({clientEmail:account.client_email,privateKey:key,crypto,fetchImpl}),store:rpc.store,encryptionKeys:{current,previous},fetchImpl};
  }catch{google=undefined;}
  return factory({...common,apple,google});
 }catch{return factory();}
}
export const createProductionServer=ports=>setup('production',ports);
export const createSandboxAcceptanceServer=ports=>setup('sandbox/test',ports);
