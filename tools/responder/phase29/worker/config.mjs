import {Buffer} from 'node:buffer';
import {FROM,ORIGIN} from '../invitation-delivery.mjs';
export const WEBHOOK_URL=ORIGIN+'/api/resend/webhook';
export class Refusal extends Error {constructor(code){super(code);this.code=code;}}
export function settings(env){
 if(env.GRIDLY_DISPATCH_EMAIL_FROM!==FROM||env.GRIDLY_DISPATCH_ORIGIN!==ORIGIN||env.GRIDLY_DISPATCH_WEBHOOK_URL!==WEBHOOK_URL||!['TEST','PRODUCTION'].includes(env.GRIDLY_DISPATCH_ENVIRONMENT)||!['false','true'].includes(env.GRIDLY_DISPATCH_SENDING_ENABLED))throw new Refusal('CONFIGURATION_REFUSED');
 return Object.freeze({environment:env.GRIDLY_DISPATCH_ENVIRONMENT,sending:env.GRIDLY_DISPATCH_SENDING_ENABLED==='true'});
}
export function signingKey(env){
 const v=env.GRIDLY_DISPATCH_RESEND_WEBHOOK_SECRET;
 if(typeof v!=='string'||!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(v))throw new Refusal('CONFIGURATION_REFUSED');
 const b=Buffer.from(v.slice(6),'base64');
 if(b.length<16||b.length>128||b.toString('base64').replace(/=+$/,'')!==v.slice(6).replace(/=+$/,''))throw new Refusal('CONFIGURATION_REFUSED');
 return b;
}
export function databaseBinding(env){
 const b=env.DISPATCH_DELIVERY_DB;
 if(!b||typeof b.connectionString!=='string'||env.GRIDLY_DISPATCH_DB_CACHING_DISABLED!=='true'||env.GRIDLY_DISPATCH_DB_TLS_REQUIRED!=='true')throw new Refusal('CONFIGURATION_REFUSED');
 let u;try{u=new URL(b.connectionString)}catch{throw new Refusal('CONFIGURATION_REFUSED')}
 if(u.protocol!=='postgres:'&&u.protocol!=='postgresql:'||decodeURIComponent(u.username)!=='dispatch_delivery_connection'||!u.password||u.searchParams.has('sslmode')&&u.searchParams.get('sslmode')!=='verify-full')throw new Refusal('CONFIGURATION_REFUSED');
 // Account-side caching, dedicated project and TLS must also be verified before deployment.
 return b.connectionString;
}

export function apiKey(env){
 const key=env.GRIDLY_DISPATCH_RESEND_API_KEY;
 if(typeof key!=='string'||!/^re_[A-Za-z0-9_-]{8,200}$/.test(key))throw new Refusal('CONFIGURATION_REFUSED');
 return key;
}