import {createClient} from 'npm:@supabase/supabase-js@2.112.4';
import {createGoogleRtdnRuntime} from '../_shared/entitlement/rtdn-setup.mjs';
const handler=await createGoogleRtdnRuntime({readSecret:(name:string)=>Deno.env.get(name),makeSupabaseClient:createClient});
Deno.serve(handler);
