import {InvitationDelivery,ResendAdapter,configuration} from '../invitation-delivery.mjs';
import {settings,Refusal,apiKey} from './config.mjs';
import {deliveryRepository} from './delivery-repository.mjs';
import {resendTransport} from './resend-transport.mjs';
// Operator ports are server-owned authenticated adapters, not webhook/request inputs.
export function invitationService(env,{operatorRepository,authorizeOperator,resolveRecipient,paths,fetchImpl,createClient}={}){
 const c=settings(env);
 const refuse=()=>{throw new Refusal('SENDING_DISABLED')};
 if(!c.sending)return Object.freeze({sendInvitation:refuse,sendReissue:refuse,discloseFallback:refuse});
 if(c.environment!=='PRODUCTION'||!operatorRepository||typeof operatorRepository.issue!=='function'||typeof authorizeOperator!=='function'||typeof resolveRecipient!=='function')throw new Refusal('CONFIGURATION_REFUSED');
 apiKey(env);if(!paths||Object.keys(paths).some(k=>!['acceptPath','supportPath','redirectPaths'].includes(k)))throw new Refusal('CONFIGURATION_REFUSED');
 const config=configuration({environment:c.environment,origin:env.GRIDLY_DISPATCH_ORIGIN,from:env.GRIDLY_DISPATCH_EMAIL_FROM,...paths});
 const transport=resendTransport(env,{fetchImpl});
 const repo=deliveryRepository(env,{createClient});
 const core=new InvitationDelivery({config,repository:{issue:p=>operatorRepository.issue(p),claim:repo.claim,complete:repo.complete},provider:new ResendAdapter({environment:c.environment,credential:env.GRIDLY_DISPATCH_RESEND_API_KEY,transport}),authorizeOperator,resolveRecipient});
 const guard=fn=>input=>{if(!settings(env).sending)refuse();return fn(input)};
 return Object.freeze({sendInvitation:guard(p=>core.sendInvitation(p)),sendReissue:guard(p=>core.sendReissue(p)),discloseFallback:guard(p=>core.discloseFallback(p))});
}
