import {createClient} from 'npm:@supabase/supabase-js@2.112.4';
import {importProductionEntitlementKey} from '../../../js/gridly-entitlement-public-key.mjs';
import {importSandboxEntitlementKey} from '../../../js/gridly-sandbox-entitlement-public-key.mjs';
import {createPaidReportHandler} from '../_shared/paid-report.mjs';
import {GOOGLE_LICENSE_TEST_POLICY} from '../_shared/entitlement/google-license-test-policy.mjs';

let publicKey:CryptoKey|null=null;
let googleLicenseTestPublicKey:CryptoKey|null=null;
let writer:((name:string,args:Record<string,unknown>)=>Promise<unknown>)|null=null;
try {
  const url=new URL(Deno.env.get('SUPABASE_URL')||'');
  const role=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(url.protocol!=='https:'||!/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)||url.pathname!=='/'||url.search||url.hash||!role)throw Error();
  publicKey=await importProductionEntitlementKey();
  if(!publicKey)throw Error();
  if(GOOGLE_LICENSE_TEST_POLICY.reporting) {
    googleLicenseTestPublicKey=await importSandboxEntitlementKey();
    if(!googleLicenseTestPublicKey)throw Error();
  }
  const db=createClient(url.origin,role,{auth:{persistSession:false,autoRefreshToken:false}});
  writer=async(name,args)=>await db.rpc(name,args);
}catch{publicKey=null;googleLicenseTestPublicKey=null;writer=null;}

Deno.serve(createPaidReportHandler({publicKey,googleLicenseTestPublicKey,writer}));
