import {execFileSync} from 'node:child_process';
const load=p=>execFileSync('git',['show','0e9eebd185dac45aa3382471870092852645941b:'+p],{encoding:'utf8'});
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const local=p=>new URL('../../js/'+p,import.meta.url).href;
const entitlement=uri(load('js/gridly-entitlement.mjs').replace("'./gridly-store-verification.mjs'",JSON.stringify(local('gridly-store-verification.mjs'))));
const store=uri(load('js/gridly-apple-storekit.mjs').replace("'./gridly-entitlement.mjs'",JSON.stringify(entitlement)).replace("'./gridly-store-verification.mjs'",JSON.stringify(local('gridly-store-verification.mjs'))));
const access=uri(load('js/gridly-paid-access.mjs').replace("'./gridly-entitlement.mjs'",JSON.stringify(entitlement)).replace("'./gridly-apple-storekit.mjs'",JSON.stringify(store)).replace("'./gridly-google-play-billing.mjs'",JSON.stringify(local('gridly-google-play-billing.mjs'))).replace("'./gridly-continuity.mjs'",JSON.stringify(local('gridly-continuity.mjs'))));
export const build16ApplePaidAccess=(await import(access)).createPaidAccess;
