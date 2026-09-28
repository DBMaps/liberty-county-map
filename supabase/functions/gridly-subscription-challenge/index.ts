import {createClient} from 'npm:@supabase/supabase-js@2.112.4';
import {createNativeChallengeHandler} from '../_shared/entitlement/native-authorization.mjs';
import {nativeAuthorizationRpcPorts} from '../_shared/entitlement/native-rpc-ports.mjs';
import {challengeGatewayLimiter} from '../_shared/entitlement/challenge-gateway.mjs';

let handler;
try {
  const url=Deno.env.get('SUPABASE_URL'),role=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const token=Deno.env.get('GRIDLY_CHALLENGE_GATEWAY_TOKEN');
  if(!url||!role||!token)throw Error();
  const origin=new URL(url);
  if(origin.protocol!=='https:'||! /^[a-z0-9]+\.supabase\.co$/.test(origin.hostname)||origin.pathname!=='/')throw Error();
  const client=createClient(url,role,{auth:{persistSession:false,autoRefreshToken:false}});
  handler=createNativeChallengeHandler({store:nativeAuthorizationRpcPorts(client),rateLimit:challengeGatewayLimiter(token)});
} catch {handler=()=>Response.json({error:'verification_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
Deno.serve(request=>handler(request));
