import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {GOOGLE_LICENSE_TEST_POLICY} from '../supabase/functions/_shared/entitlement/google-license-test-policy.mjs';

// Explicit Internal Testing packaging only. Ordinary native staging remains
// production. The staged switch chooses a pinned verifier, never paid access.
const gradle=readFileSync(new URL('../android/app/build.gradle',import.meta.url),'utf8');
const version=gradle.match(/\bversionCode\s+(\d+)/)?.[1];
if(!GOOGLE_LICENSE_TEST_POLICY.versionCodes.includes(version)||
  !/versionName '1\.0\.0'/.test(gradle)||!/applicationId 'com\.gridlygo\.gridly'/.test(gradle))
  throw Error('Internal Testing build does not match the server authority policy');
const run=(...args)=>execFileSync(process.execPath,args,{stdio:'inherit',windowsHide:true});
run('tools/native-assets.mjs');
run('tools/native-web.mjs','--runtime-config-file','owner-local/native-provider-config.json',
  '--report-file','.artifacts/native-web-identity.json','--google-license-test');
run('tools/native-web.mjs','--verify','--report-file','.artifacts/native-web-identity.json','--google-license-test');
