import {createClient} from 'npm:@supabase/supabase-js@2.112.4';
import {createGoogleRtdnRuntime} from '../_shared/entitlement/rtdn-setup.mjs';
const lastLogged=new Map<string,number>();
const categories=new Set(['body_shape','subscription_binding','envelope_fields','message_shape','message_fields','message_data',
 'package_binding','notice_version','legacy_subscription_id','refund_review_version','notice_fields','notification_shape']);
const onReject=(category:string)=>{
 if(!categories.has(category))return;
 const now=Date.now();if(now-(lastLogged.get(category)??0)<30000)return;
 lastLogged.set(category,now);
 console.info(JSON.stringify({subsystem:'google_rtdn',stage:'parse_rejection',category}));
};
const handler=await createGoogleRtdnRuntime({readSecret:(name:string)=>Deno.env.get(name),makeSupabaseClient:createClient,onReject});
Deno.serve(handler);
