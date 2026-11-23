import {createHash} from 'node:crypto';
import {createAppleAppAttestVerifier} from '../reference/build18/supabase/functions/_shared/entitlement/apple-app-attest.mjs';
import {policy,exact,digest43,live} from './policy.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function keyHash(keyId){
 if(typeof keyId!=='string'||! /^[A-Za-z0-9+/_-]+={0,2}$/.test(keyId)||keyId.length>128)throw Error();
 const b=Buffer.from(keyId,'base64');if(b.length!==32||b.toString('base64url')!==keyId.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''))throw Error();
 return hash(b);
}
export function createLabelsAttestAdapter({registry,verifier=createAppleAppAttestVerifier(),now=Date.now}={}) {
 return async ({evidence,binding,purpose,challengeId,appId,environment,signal})=>{
  try{
   live(signal);
   if(!registry?.read||!registry?.consume||typeof verifier?.verify!=='function'||purpose!==policy.purpose||
    appId!==policy.appId||environment!==policy.attest||!digest43(binding)||typeof evidence!=='string'||Buffer.byteLength(evidence)>20000)return null;
   const authorization=JSON.parse(evidence);
   if(!exact(authorization,['type','keyId','object'])||authorization.type!=='apple_assertion')return null;
   const owner=keyHash(authorization.keyId),record=await registry.read({id:challengeId,signal});live(signal);
   if(!record||record.challengeId!==challengeId||record.keyHash!==owner||record.binding!==binding||
    record.purpose!==policy.purpose||record.appId!==policy.attestAppId||record.store!==policy.store||record.attest!==policy.attest||
    record.gatewayId!==policy.gatewayId||record.environment!==policy.attest||!Number.isSafeInteger(record.expiresAt)||
    record.expiresAt<=now()||record.expiresAt>now()+120000)return null;
   const verdict=await verifier.verify({authorization,digest:Buffer.from(binding,'base64url'),environment:policy.attest,
    readKey:async h=>h===owner?record:null});live(signal);
   if(verdict?.verified!==true||verdict.platform!=='apple'||verdict.kind!=='apple_assertion'||verdict.keyHash!==owner||
    !Number.isSafeInteger(verdict.counter)||verdict.counter<=record.counter||verdict.counter>4294967295)return null;
   if(await registry.consume({id:challengeId,keyHash:owner,binding,counter:verdict.counter,signal})!==true)return null;
   live(signal);if(record.expiresAt<=now())return null;
   return Object.freeze({verified:true,binding,purpose,challengeId,appId,environment,installation:owner,
    verifiedAt:now(),challengeExpiresAt:record.expiresAt});
  }catch{return null;}
 };
}
