import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {APPLE_APP_ID} from '../reference/build18/supabase/functions/_shared/entitlement/apple-app-attest.mjs';
import {normalizeApple} from '../reference/build18/supabase/functions/_shared/entitlement/core.mjs';
export const sha=b=>createHash('sha256').update(b).digest('base64url');
export const hex=b=>createHash('sha256').update(b).digest('hex');
function cbor(value){const len=n=>n<24?Buffer.from([n]):n<256?Buffer.from([24,n]):Buffer.from([25,n>>8,n&255]);
 if(Buffer.isBuffer(value)){const h=len(value.length);h[0]|=0x40;return Buffer.concat([h,value]);}
 if(typeof value==='string'){const b=Buffer.from(value),h=len(b.length);h[0]|=0x60;return Buffer.concat([h,b]);}
 if(value instanceof Map){const h=len(value.size);h[0]|=0xa0;return Buffer.concat([h,...[...value].flatMap(([k,v])=>[cbor(k),cbor(v)])]);}throw Error();}
export function nativeFixture(){
 const attest=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),tile=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const id=Buffer.alloc(32,17),keyId=id.toString('base64'),keyHash=hex(id),spki=tile.publicKey.export({format:'der',type:'spki'}).toString('base64url');
 return {attest,tile,keyId,keyHash,spki,fingerprint:sha(Buffer.from(spki,'base64url')),
 publicSpki:attest.publicKey.export({format:'der',type:'spki'}).toString('base64'),
 assertion(binding,counter=1,app=APPLE_APP_ID){const auth=Buffer.alloc(37);Buffer.from(hex(app),'hex').copy(auth);auth.writeUInt32BE(counter,33);
 const nonce=createHash('sha256').update(Buffer.concat([auth,Buffer.from(binding,'base64url')])).digest();
 return JSON.stringify({type:'apple_assertion',keyId,object:cbor(new Map([['signature',sign('sha256',nonce,attest.privateKey)],['authenticatorData',auth]])).toString('base64')});}};
}
export function appleRecord(now,{status=1,end=now+3600000,revoked=false,env='Sandbox',cancel=false}={}){
 return normalizeApple({bundleId:'com.gridlygo.gridly',productId:'com.gridlygo.gridly.monthly',type:'Auto-Renewable Subscription',environment:env,
 originalTransactionId:'synthetic-purchase',expiresDate:end,revocationDate:revoked?now:null},
 {originalTransactionId:'synthetic-purchase',productId:'com.gridlygo.gridly.monthly',environment:env,autoRenewStatus:cancel?0:1},status,
 {env:env==='Sandbox'?'sandbox/test':'production',originalReference:'synthetic-purchase',now});
}
export const fingerprintKey=()=>crypto.subtle.importKey('raw',Buffer.alloc(32,4),{name:'HMAC',hash:'SHA-256'},false,['sign']);
