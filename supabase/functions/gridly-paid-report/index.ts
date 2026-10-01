import {createClient} from 'npm:@supabase/supabase-js@2.112.4';
import {importProductionEntitlementKey} from '../../../js/gridly-entitlement-public-key.mjs';
import {createPaidReportHandler} from '../_shared/paid-report.mjs';

let publicKey:CryptoKey|null=null;
let writer:((name:string,args:Record<string,unknown>)=>Promise<unknown>)|null=null;
try {
  const url=new URL(Deno.env.get('SUPABASE_URL')||'');
  const role=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(url.protocol!=='https:'||!/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)||url.pathname!=='/'||url.search||url.hash||!role)throw Error();
  publicKey=await importProductionEntitlementKey();
  if(!publicKey)throw Error();
  const db=createClient(url.origin,role,{auth:{persistSession:false,autoRefreshToken:false}});
  writer=(name,args)=>db.rpc(name,args);
}catch{publicKey=null;writer=null;}

Deno.serve(createPaidReportHandler({publicKey,writer}));
