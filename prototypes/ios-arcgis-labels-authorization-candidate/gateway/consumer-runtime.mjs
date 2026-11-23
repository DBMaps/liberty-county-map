import {createEdgeHandler} from './edge.mjs';
import {createLabelsChallengeIssuer} from '../server/labels-challenge-adapter.mjs';
import {createLabelsAttestAdapter} from '../server/labels-attest-adapter.mjs';
import {createLabelsPaidAdapter} from '../server/labels-paid-adapter.mjs';
// Explicit server dependencies only. No environment/HTTP flag installs a verifier.
export function createConsumerRuntime({config,state,registry,provider,fingerprintKey,verifier,transport,now=Date.now}={}){
 if(!config||!state)return ()=>Response.json({code:'temporarily_unavailable'},{status:503});
 const admission=registry?.issue&&registry?.read&&registry?.consume&&provider?.verify&&fingerprintKey?{
  issueChallenge:createLabelsChallengeIssuer({registry,now}),
  verifyAttest:createLabelsAttestAdapter({registry,verifier,now}),
  verifyPaid:createLabelsPaidAdapter({provider,fingerprintKey,now})
 }:undefined;
 return createEdgeHandler({config,state,admission,transport,now});
}
