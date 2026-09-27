import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
import {instrumentIosReset,restoreIosResetSource,nativeResetCategories,nativeResetOperations,nativeResetStatuses} from '../tools/native-continuity-certification/ios-reset-diagnostics.mjs';
import {numericProbeSource} from '../tools/native-continuity-certification/ios-numeric-contract.mjs';
const read=path=>readFile(path,'utf8');
const swift=await read('ios/App/App/GridlyContinuityPlugin.swift');
const harness=await read('tools/native-continuity-certification/continuity-certification.mjs');
const seed=harness.slice(harness.indexOf('async function seed(scenario)'),harness.indexOf('async function check()'));
const privateValue='PRIVATE_RESET_SENTINEL',attempt='PRIVATE_ATTEMPT_SENTINEL';
test('iOS diagnostics recover original Swift exactly and isolate only certification service',()=>{
 const generated=instrumentIosReset(swift);assert.equal(restoreIosResetSource(generated),swift);
 assert.match(generated,/#if !DEBUG\s+#error\("Continuity certification cannot build Release"\)/);
 assert.match(generated,/private let service = "com.gridlygo.continuitycert.continuity.v1"/);
 assert.match(swift,/private let service = "com.gridlygo.gridly.continuity.v1"/);
 assert.match(generated,/kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
 assert.match(generated,/\.completeFileProtectionUntilFirstUserAuthentication/);
 assert.match(generated,/values.isExcludedFromBackup = true/);
 assert.match(generated,/record.blocked, call.getString\("attempt"\) == record.attempt/);
 assert.match(generated,/sysctl\(&mib, 2, &bootTime, &size, nil, 0\) == 0/);
 assert.match(generated,/mach_continuous_time\(\)/);
 assert.doesNotMatch(generated,/print\(|NSLog|localizedDescription|printStackTrace|error\.userInfo/);
 for(const value of nativeResetCategories.filter(x=>!['plugin_unavailable','unknown_native_reset_failure'].includes(x)))assert.ok(generated.includes('"'+value+'"'));
 assert.throws(()=>instrumentIosReset(generated),/Unexpected/);
 assert.throws(()=>instrumentIosReset(swift.replace('try save(denied);','try saveOther(denied);')),/contract changed/);
});
test('Keychain API calls execute once with original guards; diagnostic status maps to fixed labels',()=>{
 const generated=instrumentIosReset(swift);
 for(const name of ['SecItemUpdate','SecItemAdd','SecItemDelete','SecItemCopyMatching','SecRandomCopyBytes'])assert.equal(generated.split(name+'(').length,swift.split(name+'(').length);
 assert.match(generated,/guard certificationAddStatus == errSecSuccess/);
 assert.match(generated,/status == errSecSuccess \|\| status == errSecItemNotFound/);
 assert.match(generated,/status == errSecSuccess, let data = value as\? Data, data.count < 16384/);
 assert.match(generated,/case errSecMissingEntitlement: return "missing_entitlement"/);
 assert.match(generated,/call.resolve\(\["nativeResetFailed": true, "nativeResetCategory": certificationResetCategory, "nativeResetOperation": certificationResetOperation, "nativeResetStatus": certificationResetStatus\]\)/);
 assert.doesNotMatch(generated,/call\.resolve\([^\n]*(?:value|data|status|record)\)/);
});
async function run({step='initial_begin',category='unknown_native_reset_failure',operation='unknown',status='unknown',throwAt,missingPlugin=false,invalidContext=false}={}) {
 const output=[];let begins=0,revokes=0,fetches=0;
 const diagnostic={nativeResetFailed:true,nativeResetCategory:category,nativeResetOperation:operation,nativeResetStatus:status,privateValue};
 const error=()=>Error(privateValue+' '+attempt);
 const vault={beginVerification:async()=>{begins++;if(throwAt==='initial_begin')throw error();if(step==='initial_begin')return diagnostic;if(invalidContext)return {};return {attempt};},revoke:async()=>{revokes++;if(throwAt==='revoke')throw error();if(step==='revoke')return diagnostic;return {revoked:true};}};
 const fn=new Script('('+seed+')').runInNewContext({coordinator:{stop:async()=>{if(throwAt==='coordinator_stop')throw error();}},canaryCount:0,platform:'apple',vault:missingPlugin?undefined:vault,show:v=>output.push(v),fetch:async()=>{fetches++;throw error();}});
 await fn('A');const last=JSON.parse(JSON.stringify(output.at(-1)));
 const keys=new Set(['scenario','stage','errorCategory','nativeResetCategory','nativeResetStep','nativeResetOperation','nativeResetStatus','protectedInitializations']);
 for(const value of output){assert.ok(Object.keys(value).every(k=>keys.has(k)));assert.ok(!JSON.stringify(value).includes(privateValue));assert.ok(!JSON.stringify(value).includes(attempt));}
 assert.equal(last.stage,'native_reset');assert.equal(last.errorCategory,'native_reset_failed');assert.equal(last.protectedInitializations,0);assert.equal(fetches,0);
 return {last,begins,revokes};
}
// Tests run the real harness function with explicit JS ports; NOT iOS API tests.
for(const category of nativeResetCategories.filter(x=>x!=='plugin_unavailable'))test('certification reset projection: '+category,async()=>{
 const step=category.startsWith('revoke_')?'revoke':'initial_begin';
 const {last}=await run({step,category});assert.equal(last.nativeResetCategory,category);assert.equal(last.nativeResetStep,step);
});
test('reset substeps distinguish coordinator, plugin, initial begin, context and revoke',async()=>{
 assert.equal((await run({throwAt:'coordinator_stop'})).last.nativeResetStep,'coordinator_stop');
 const missing=await run({missingPlugin:true});assert.equal(missing.last.nativeResetCategory,'plugin_unavailable');assert.equal(missing.begins,0);
 const begun=await run({throwAt:'initial_begin'});assert.equal(begun.last.nativeResetStep,'initial_begin');assert.equal(begun.revokes,0);
 const context=await run({step:'none',invalidContext:true});assert.equal(context.last.nativeResetStep,'initial_context');assert.equal(context.last.nativeResetCategory,'begin_attempt_failed');assert.equal(context.revokes,0);
 assert.equal((await run({step:'none',throwAt:'revoke'})).last.nativeResetStep,'revoke');
});
test('native error text, unrecognized fields and raw status values never escape',async()=>{
 const {last}=await run({category:privateValue,operation:privateValue,status:-34018});
 assert.equal(last.nativeResetCategory,'unknown_native_reset_failure');assert.equal(last.nativeResetOperation,'unknown');assert.equal(last.nativeResetStatus,'unknown');
 for(const operation of nativeResetOperations)assert.equal((await run({operation})).last.nativeResetOperation,operation);
 for(const status of nativeResetStatuses)assert.equal((await run({status})).last.nativeResetStatus,status);
});
test('installed iOS getter uses Swift numeric bridging, not Android Java wrapper allowlist',async()=>{
 const sdk=await read('node_modules/@capacitor/ios/Capacitor/Capacitor/JSTypes.swift');
 assert.match(sdk,/public func getDouble\(_ key: String\) -> Double\? \{\s+return jsObjectRepresentation\[key\] as\? Double/);
 assert.match(sdk,/case let numberValue as NSNumber:\s+return numberValue/);
 const probe=numericProbeSource(sdk);assert.match(probe,/return jsObjectRepresentation\[key\] as\? Double/);assert.match(probe,/JSONSerialization.jsonObject/);assert.match(probe,/NSNumber\(value:/);
 assert.match(swift,/call.getDouble\("verifiedAt"\), verified.isFinite, verified >= record.verifiedAt/);
 assert.doesNotMatch(probe,/Keychain|SecItem|binding|attempt|proof|readFile/);
});
