import {invitationService} from './invitation-service.mjs';
import {supabaseInvitationAdapters} from './supabase-adapters.mjs';
import {settings} from './config.mjs';
// Internal server factory only. This creates no HTTP route and cannot enable sending.
export function authenticatedInvitationService(env,{identity,paths,fetchImpl,createClient}={}){
 if(!settings(env).sending)return invitationService(env);
 const adapters=supabaseInvitationAdapters({...identity,fetchImpl});
 return invitationService(env,{...adapters,paths,fetchImpl,createClient});
}
