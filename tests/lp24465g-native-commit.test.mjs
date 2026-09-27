import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {join,delimiter} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {instrumentAndroidCommit,nativeCommitCategories} from '../tools/native-continuity-certification/android-commit-diagnostics.mjs';
const source=await readFile('android/app/src/main/java/com/gridlygo/gridly/GridlyContinuityPlugin.kt','utf8');
function method(text,name){const a=text.indexOf('    @PluginMethod fun '+name+'('),b=text.indexOf('    } }',a);assert.ok(a>=0&&b>a);return text.slice(a,b+7).replace('@PluginMethod ','');}
function between(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert.ok(a>=0&&b>a);return text.slice(a,b);}
test('Number parsing preserves finite, monotonic, attempt and bounded proof guards',()=>{
 const commit=method(source,'commit');
 assert.match(commit,/\(call.data.opt\("verifiedAt"\) as\? Number\)\?\.toDouble\(\)/);
 assert.doesNotMatch(commit,/call.getDouble\("verifiedAt"\)|toDoubleOrNull|optDouble/);
 assert.match(commit,/proof.length in 1\.\.4096 && verified.isFinite\(\) && verified >= record.getDouble\("verifiedAt"\)/);
 assert.match(commit,/record.getBoolean\("blocked"\) && call.getString\("attempt"\) == record.getString\("attempt"\)/);
 assert.doesNotMatch(source,/println\(|printStackTrace|Log\.|console/);
});
test('generated diagnostics preserve storage, clock and other methods; reject source drift',()=>{
 const copy=instrumentAndroidCommit(source);
 for(const name of ['beginVerification','retain','revoke'])assert.equal(method(copy,name),method(source,name));
 assert.equal(between(copy,'    private fun save(', '    @PluginMethod fun beginVerification('),between(source,'    private fun save(', '    @PluginMethod fun beginVerification('));
 assert.match(copy,/check\(BuildConfig.DEBUG\)/);assert.doesNotMatch(copy,/println\(|printStackTrace|Log\./);
 for(const value of nativeCommitCategories)assert.ok(copy.includes('"'+value+'"'));
 assert.throws(()=>instrumentAndroidCommit(source.replace('save(record); JSObject()','save(record)\nJSObject()')),/contract changed/);
 assert.throws(()=>instrumentAndroidCommit(copy),/Unexpected/);
});
// Actual source-extracted Kotlin methods; explicit memory/clock ports only.
// This NEVER claims Android KeyStore, AES/GCM, AtomicFile or device certification.
test('JVM native contract: Long RCA, lifecycle, bounds and fixed diagnostic categories',{timeout:120000},async t=>{
 const cache=join(homedir(),'.gradle/caches/modules-2/files-2.1');
 async function jar(group,artifact,version){const base=join(cache,group,artifact,version);for(const hash of await readdir(base))for(const file of await readdir(join(base,hash)))if(file===artifact+'-'+version+'.jar')return join(base,hash,file);throw Error('Missing cache');}
 let json,stdlib,compiler;
 try {json=await jar('org.json','json','20250517');stdlib=await jar('org.jetbrains.kotlin','kotlin-stdlib','2.2.0');compiler=await Promise.all([
 jar('org.jetbrains.kotlin','kotlin-compiler-embeddable','2.2.0'),jar('org.jetbrains.kotlin','kotlin-script-runtime','2.2.0'),jar('org.jetbrains.kotlin','kotlin-reflect','1.6.10'),jar('org.jetbrains.kotlin','kotlin-daemon-embeddable','2.2.0'),jar('org.jetbrains.kotlinx','kotlinx-coroutines-core-jvm','1.8.0'),jar('org.jetbrains','annotations','13.0')]);execFileSync('javac',['-version'],{stdio:'pipe'});
 }catch{t.skip('Existing JDK/Kotlin/JSON cache unavailable; no installation attempted');return;}
 const base=await mkdtemp(join(tmpdir(),'gridly-commit-contract-')),out=join(base,'classes');await mkdir(out);
 const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',timeout:90000,stdio:'pipe'});
 try {
 const sdk=await readFile('node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/PluginCall.java','utf8');
 const start=sdk.indexOf('public Double getDouble(String name, @Nullable Double defaultValue)');assert.ok(start>=0);
 let depth=0,end;for(let i=sdk.indexOf('{',start);i<sdk.length;i++){if(sdk[i]==='{')depth++;if(sdk[i]==='}'&&--depth===0){end=i+1;break;}}
 const getter=sdk.slice(start,end).replaceAll('@Nullable ','');
 await writeFile(join(base,'PluginCall.java'),`import org.json.JSONObject;
public class PluginCall { public JSONObject data; public JSObject result; public boolean rejected;
public PluginCall(JSONObject value){data=value;} public JSONObject getData(){return data;}
public String getString(String name){Object v=data.opt(name);return v instanceof String?(String)v:null;}
public Double getDouble(String name){return getDouble(name,null);} public void resolve(JSObject value){result=value;} public void reject(String category){rejected=true;}
${getter}}`);
 const jsObject=(await readFile('node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/JSObject.java','utf8')).replace('package com.getcapacitor;', '').replace('import androidx.annotation.Nullable;', '').replaceAll('@Nullable', '');
 await writeFile(join(base,'JSObject.java'),jsObject);
 run('javac',['-cp',json,'-d',out,join(base,'PluginCall.java'),join(base,'JSObject.java')]);
 const copy=instrumentAndroidCommit(source);
 function contract(name,text,diagnostic=false){return `class ${name} {
private val mutex=Any(); private var counter=0
private fun binding()=(++counter).toString().padStart(64,'0')
${between(source,'    private fun empty()', '    private fun save(')}
private var persisted=empty()
var failSave=false; var failRead=false; var failClock=false
fun snapshot()=JSONObject(persisted.toString())
// CONTRACT-ONLY memory ports, not native encryption/storage success.
private fun loadRecord():JSONObject {check(!failRead);return snapshot()}
private fun save(record:JSONObject){check(!failSave);persisted=JSONObject(record.toString())}
private data class Clock(val utc:Double,val wall:Double,val uptime:Double,val boot:Int,val trusted:Boolean)
private fun clock(record:JSONObject):Clock{check(!failClock);return Clock(1770000000000.0,1770000000000.0,1000.0,1,true)}
${between(source,'    private fun operate(', '    @PluginMethod fun beginVerification(')}
${diagnostic?between(text,'    // SYNTHETIC_CONTINUITY_CERTIFICATION:','    @PluginMethod fun commit('):''}
${method(text,'beginVerification')}
${method(text,'commit')}
${method(text,'revoke')}
}`;}
 const kotlin=`import org.json.JSONObject
object BuildConfig {const val DEBUG=true}
${contract('MemoryContract',source)}
${contract('LegacyContract',source.replace('(call.data.opt("verifiedAt") as? Number)?.toDouble()', 'call.getDouble("verifiedAt")'))}
${contract('DiagnosticContract',copy,true)}
fun args(attempt:String,verified:Any=1770000000000L,proof:String="fixture")=PluginCall(JSONObject().put("attempt",attempt).put("proof",proof).put("verifiedAt",verified))
fun main(){
val numeric=PluginCall(JSONObject(JSONObject().put("verifiedAt",1770000000000L).toString()))
check(numeric.data.opt("verifiedAt") is Long);check(numeric.getDouble("verifiedAt",null)==null)
val legacy=LegacyContract();val legacyBegin=PluginCall(JSONObject());legacy.beginVerification(legacyBegin);val legacyCommit=args(legacyBegin.result.getString("attempt"));legacy.commit(legacyCommit);check(legacyCommit.rejected)
fun begun(v:MemoryContract):String {val c=PluginCall(JSONObject());v.beginVerification(c);check(!c.rejected);return c.result.getString("attempt").also{check(it.isNotEmpty())}}
val v=MemoryContract();val a=begun(v)
val mismatch=args("different");v.commit(mismatch);check(mismatch.rejected)
for(invalid in listOf<Any>("1770000000000",true,JSONObject.NULL,-1L)){val c=args(a,invalid);v.commit(c);check(c.rejected)}
for(proof in listOf("","x".repeat(4097))){val c=args(a,proof=proof);v.commit(c);check(c.rejected)}
val ok=args(a);v.commit(ok);check(ok.result.getBoolean("saved"));check(!v.snapshot().getBoolean("blocked"));check(v.snapshot().getString("attempt").isEmpty())
val reused=args(a);v.commit(reused);check(reused.rejected)
val newer=begun(v);val older=args(newer,1769999999999L);v.commit(older);check(older.rejected)
val revoke=args(newer);v.revoke(revoke);check(revoke.result.getBoolean("revoked"));val fresh=begun(v);check(fresh!=newer)
val freshCommit=args(fresh);v.commit(freshCommit);check(freshCommit.result.getBoolean("saved"))
val failureAttempt=begun(v);val before=v.snapshot().toString();v.failSave=true;val failure=args(failureAttempt);v.commit(failure);check(failure.rejected);check(v.snapshot().toString()==before)
v.failSave=false
for(number in listOf(Double.NaN,Double.POSITIVE_INFINITY,Double.NEGATIVE_INFINITY)){
val c=PluginCall(object:JSONObject(){override fun opt(name:String):Any?=if(name=="verifiedAt")number else if(name=="attempt")failureAttempt else if(name=="proof")"fixture" else null})
v.commit(c);check(c.rejected)
}
fun diag(expected:String,setup:(DiagnosticContract,String)->PluginCall){val d=DiagnosticContract();val b=PluginCall(JSONObject());d.beginVerification(b);val c=setup(d,b.result.getString("attempt"));d.commit(c);check(!c.rejected);check(!c.result.getBoolean("saved"));check(c.result.getString("nativeCommitCategory")==expected);check(c.result.keySet()==setOf("saved","nativeCommitCategory"))}
diag("attempt_mismatch"){_,_->args("different")}
diag("verified_at_invalid"){_,a2->args(a2,"invalid")}
diag("proof_invalid"){_,a2->args(a2,proof="")}
diag("record_read_failed"){d,a2->d.failRead=true;args(a2)}
diag("clock_failed"){d,a2->d.failClock=true;args(a2)}
diag("persistence_failed"){d,a2->d.failSave=true;args(a2)}
val d=DiagnosticContract();val b=PluginCall(JSONObject());d.beginVerification(b);val saved=args(b.result.getString("attempt"));d.commit(saved);check(saved.result.getBoolean("saved"));d.commit(saved);check(saved.result.getString("nativeCommitCategory")=="attempt_invalid")
println("CONTRACT_ONLY_PASS: Long RCA, attempts, bounds, revoke/fresh begin, write failure, fixed diagnostics; Android KeyStore NOT tested")
}`;
 await writeFile(join(base,'Contract.kt'),kotlin);
 run('java',['-cp',[...compiler,stdlib].join(delimiter),'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-no-stdlib','-no-reflect','-jvm-target','1.8','-classpath',[stdlib,json,out,compiler.at(-1)].join(delimiter),'-d',out,join(base,'Contract.kt')]);
 const result=run('java',['-cp',[out,stdlib,json].join(delimiter),'ContractKt']);assert.match(result,/CONTRACT_ONLY_PASS/);assert.doesNotMatch(result,/fixture|different|1770000000000/);
 }finally{await rm(base,{recursive:true,force:true});}
});
