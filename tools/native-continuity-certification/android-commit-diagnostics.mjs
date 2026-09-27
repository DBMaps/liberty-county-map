// SYNTHETIC_CONTINUITY_CERTIFICATION — instrument only the generated debug app.
// Categories identify stages, never underlying exception text or storage contents.
export const nativeCommitCategories=Object.freeze(['attempt_invalid','attempt_mismatch','verified_at_invalid','proof_invalid','record_read_failed','clock_failed','record_update_failed','persistence_failed','unknown_commit_failure']);
export function instrumentAndroidCommit(source) {
 const begin=source.indexOf('    @PluginMethod fun commit('),end=source.indexOf('    @PluginMethod fun retain(',begin);
 if(begin<0||end<0||source.includes('certificationCommit'))throw Error('Unexpected native commit source');
 let commit=source.slice(begin,end);
 const replace=(from,to)=>{if(commit.split(from).length!==2)throw Error('Native commit contract changed');commit=commit.replace(from,to);};
 replace('operate(call) {','certificationCommit(call) { diagnostic ->');
 replace('val record = loadRecord(); val proof =', 'diagnostic.category = "record_read_failed"\n        val record = loadRecord(); diagnostic.category = "proof_invalid"; val proof =');
 replace('val verified =','diagnostic.category = "verified_at_invalid"\n        val verified =');
 replace('        require(record.getBoolean("blocked")',
 '        diagnostic.category = when {\n            !record.getBoolean("blocked") -> "attempt_invalid"\n            call.getString("attempt") != record.getString("attempt") -> "attempt_mismatch"\n            proof.length !in 1..4096 -> "proof_invalid"\n            !verified.isFinite() || verified < record.getDouble("verifiedAt") -> "verified_at_invalid"\n            else -> "unknown_commit_failure"\n        }\n        require(record.getBoolean("blocked")');
 replace('val time = clock(record)','diagnostic.category = "clock_failed"\n        val time = clock(record)');
 replace('record.put("proof", proof)','diagnostic.category = "record_update_failed"\n        record.put("proof", proof)');
 replace('save(record); JSObject()', 'diagnostic.category = "persistence_failed"\n        save(record); JSObject()');
 const helper='    // SYNTHETIC_CONTINUITY_CERTIFICATION: fixed enum only; no exception logging.\n'+
 '    private class CommitDiagnostic { var category = "unknown_commit_failure" }\n'+
 '    private fun certificationCommit(call: PluginCall, operation: (CommitDiagnostic) -> JSObject) = synchronized(mutex) {\n'+
 '        check(BuildConfig.DEBUG)\n        val diagnostic = CommitDiagnostic()\n'+
 '        try { call.resolve(operation(diagnostic)) } catch (_: Exception) {\n'+
 '            call.resolve(JSObject().put("saved", false).put("nativeCommitCategory", diagnostic.category))\n        }\n    }\n';
 return source.slice(0,begin)+helper+commit+source.slice(end);
}
