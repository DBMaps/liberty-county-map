import {p256Key} from '../gateway/web-proof.mjs';
import {keyHash} from './labels-attest-adapter.mjs';
import {exact,digest43,policy,live} from './policy.mjs';
export function createLabelsChallengeIssuer({registry,now=Date.now}={}){
 return async({id,input,signal})=>{
  try{
   live(signal);
   if(!registry?.issue||!exact(input,['keyId','spki','paidEvidenceHash'])||!digest43(input.paidEvidenceHash))return null;
   const key=await p256Key(input.spki);if(!key)return null;
   const issued=await registry.issue({id,keyHash:keyHash(input.keyId),fingerprint:key.fingerprint,paidDigest:input.paidEvidenceHash,signal});
   live(signal);
   return issued?.challengeId===id&&issued.purpose===policy.purpose&&Number.isSafeInteger(issued.expiresAt)&&
    issued.expiresAt>now()&&issued.expiresAt<=now()+120000?issued:null;
  }catch{return null;}
 };
}
