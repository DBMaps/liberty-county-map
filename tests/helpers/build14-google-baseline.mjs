import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const load=path=>execFileSync('git',['show','0e9eebd185dac45aa3382471870092852645941b:'+path],{cwd:root,encoding:'utf8'});
const uri=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const moduleUri=path=>new URL('../../js/'+path,import.meta.url).href;
const originalEntitlement=uri(load('js/gridly-entitlement.mjs').replace("'./gridly-store-verification.mjs'",JSON.stringify(moduleUri('gridly-store-verification.mjs'))));
const originalGoogle=uri(load('js/gridly-google-play-billing.mjs').replace("'./gridly-entitlement.mjs'",JSON.stringify(originalEntitlement)).replace("'./gridly-store-verification.mjs'",JSON.stringify(moduleUri('gridly-store-verification.mjs'))));
const originalAccess=uri(load('js/gridly-paid-access.mjs')
 .replace("'./gridly-entitlement.mjs'",JSON.stringify(originalEntitlement))
 .replace("'./gridly-google-play-billing.mjs'",JSON.stringify(originalGoogle))
 .replace("'./gridly-continuity.mjs'",JSON.stringify(moduleUri('gridly-continuity.mjs')))
 .replace("'./gridly-apple-storekit.mjs'",JSON.stringify(moduleUri('gridly-apple-storekit.mjs'))));
export const build14CreatePaidAccess=(await import(originalAccess)).createPaidAccess;
