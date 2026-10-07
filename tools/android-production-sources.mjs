// Auditable, deterministic package specialization. Canonical source retains the
// separately certified internal candidate; production packaging removes it.
export function productionAndroidSource(path,source) {
  const replace=(before,after)=>{
    if(!source.includes(before))throw Error('Production staging source contract changed: '+path);
    source=source.replaceAll(before,after);
  };
  if(path==='js/gridly-paid-config.mjs') {
    replace("import {importSandboxEntitlementKey} from './gridly-sandbox-entitlement-public-key.mjs';",'const importSandboxEntitlementKey=async()=>null;');
    replace("const googleEnvironment=platform==='android'&&googleLicenseTest===true?'sandbox/test':'production';","if(platform==='android'&&googleLicenseTest!==false)throw Error('production_authority_required');\n  const googleEnvironment='production';");
  }
  if(path==='js/gridly-entitlement.mjs') {
    replace("(row.testAuthority!==undefined&&(platform!=='google'||environment!=='sandbox/test'||row.testAuthority!=='gridly-google-play-internal-v11'))",'(row.testAuthority!==undefined)');
  }
  if(['js/gridly-native-edge-transport.mjs','js/gridly-native-attested-invoke.mjs'].includes(path)) {
    replace("const sandboxGoogleName='gridly-verify-google-sandbox-subscription';",'const sandboxGoogleName=null;');
    replace("!['production','sandbox/test'].includes(googleEnvironment)","googleEnvironment!=='production'");
  }
  if(path==='js/gridly-google-play-billing.mjs') {
    replace("!['production','sandbox/test'].includes(environment)","environment!=='production'");
    replace("const name=environment==='sandbox/test'?'gridly-verify-google-sandbox-subscription':'gridly-verify-google-subscription';","const name='gridly-verify-google-subscription';");
  }
  return source;
}
export const PRODUCTION_SPECIALIZED_MODULES=['js/gridly-paid-config.mjs','js/gridly-entitlement.mjs','js/gridly-native-edge-transport.mjs','js/gridly-native-attested-invoke.mjs','js/gridly-google-play-billing.mjs'];
