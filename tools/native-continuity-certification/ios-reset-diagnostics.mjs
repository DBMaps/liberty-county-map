// SYNTHETIC_CONTINUITY_CERTIFICATION: generated iOS debug copy only.
export const nativeResetCategories=Object.freeze(['plugin_unavailable','initial_load_failed','sentinel_failed','keychain_read_failed','keychain_write_failed','random_failed','clock_failed','begin_attempt_failed','revoke_attempt_mismatch','revoke_storage_failed','unknown_native_reset_failure']);
export const nativeResetOperations=Object.freeze(['unknown','application_support','sentinel_directory','sentinel_backup_exclusion','sentinel_delete','sentinel_write','keychain_copy','record_decode','random','record_encode','keychain_update','keychain_add','boot_identity','timebase','begin_attempt','barrier_write','revoke_attempt','revoke_write']);
export const nativeResetStatuses=Object.freeze(['unknown','success','item_not_found','missing_entitlement','interaction_not_allowed','not_available','auth_failed','duplicate_item','invalid_parameter','other']);
const prelude=`    // SYNTHETIC_CONTINUITY_CERTIFICATION: locked fixed labels, never error text.
    #if !DEBUG
    #error("Continuity certification cannot build Release")
    #endif
    private var certificationResetCategory = "unknown_native_reset_failure"
    private var certificationResetOperation = "unknown"
    private var certificationResetStatus = "unknown"
    private var certificationResetPhase = ""
    private func certificationStatus(_ status: OSStatus) -> String {
        switch status {
        case errSecSuccess: return "success"
        case errSecItemNotFound: return "item_not_found"
        case errSecMissingEntitlement: return "missing_entitlement"
        case errSecInteractionNotAllowed: return "interaction_not_allowed"
        case errSecNotAvailable: return "not_available"
        case errSecAuthFailed: return "auth_failed"
        case errSecDuplicateItem: return "duplicate_item"
        case errSecParam: return "invalid_parameter"
        default: return "other"
        }
    }
`;
const patches=[
 ['    private let service = "com.gridlygo.gridly.continuity.v1"', '    private let service = "com.gridlygo.continuitycert.continuity.v1"'],
 ['    private func random() throws -> String {',prelude+'    private func random() throws -> String {\n        certificationResetCategory = "random_failed"; certificationResetOperation = "random"; certificationResetStatus = "unknown"'],
 ['        let bytes = try JSONEncoder().encode(record)', '        certificationResetCategory = certificationResetPhase == "revoke" ? "revoke_storage_failed" : "keychain_write_failed"\n        certificationResetOperation = "record_encode"; certificationResetStatus = "unknown"\n        let bytes = try JSONEncoder().encode(record)\n        certificationResetOperation = "keychain_update"'],
 ['        if status == errSecItemNotFound {\n            var item = query();', '        certificationResetStatus = certificationStatus(status)\n        if status == errSecItemNotFound {\n            var item = query();'],
 ['            guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw VaultFailure.unavailable }','            certificationResetOperation = "keychain_add"\n            let certificationAddStatus = SecItemAdd(item as CFDictionary, nil)\n            certificationResetStatus = certificationStatus(certificationAddStatus)\n            guard certificationAddStatus == errSecSuccess else { throw VaultFailure.unavailable }'],
 ['        var directory = try FileManager.default.url(', '        certificationResetCategory = "sentinel_failed"; certificationResetOperation = "application_support"; certificationResetStatus = "unknown"\n        var directory = try FileManager.default.url('],
 ['        try FileManager.default.createDirectory(', '        certificationResetOperation = "sentinel_directory"\n        try FileManager.default.createDirectory('],
 ['        try directory.setResourceValues(values)', '        certificationResetOperation = "sentinel_backup_exclusion"\n        try directory.setResourceValues(values)'],
 ['            let status = SecItemDelete(query() as CFDictionary)', '            certificationResetOperation = "sentinel_delete"\n            let status = SecItemDelete(query() as CFDictionary)\n            certificationResetStatus = certificationStatus(status)'],
 ['            try Data("v1".utf8).write(', '            certificationResetOperation = "sentinel_write"; certificationResetStatus = "unknown"\n            try Data("v1".utf8).write('],
 ['        var item = query(); item[kSecReturnData as String]', '        certificationResetCategory = "keychain_read_failed"; certificationResetOperation = "keychain_copy"; certificationResetStatus = "unknown"\n        var item = query(); item[kSecReturnData as String]'],
 ['        let status = SecItemCopyMatching(item as CFDictionary, &value)', '        let status = SecItemCopyMatching(item as CFDictionary, &value)\n        certificationResetStatus = certificationStatus(status)'],
 ['        return try JSONDecoder().decode(Record.self, from: data)', '        certificationResetCategory = "initial_load_failed"; certificationResetOperation = "record_decode"; certificationResetStatus = "unknown"\n        return try JSONDecoder().decode(Record.self, from: data)'],
 ['        var bootTime = timeval(); var size', '        certificationResetCategory = "clock_failed"; certificationResetOperation = "boot_identity"; certificationResetStatus = "unknown"\n        var bootTime = timeval(); var size'],
 ['        guard mach_timebase_info(&timebase)', '        certificationResetOperation = "timebase"\n        guard mach_timebase_info(&timebase)'],
 ['        do { call.resolve(try work()) } catch { call.reject("continuity_unavailable") }', '        certificationResetCategory = "unknown_native_reset_failure"; certificationResetOperation = "unknown"; certificationResetStatus = "unknown"; certificationResetPhase = ""\n        do { call.resolve(try work()) } catch {\n            call.resolve(["nativeResetFailed": true, "nativeResetCategory": certificationResetCategory, "nativeResetOperation": certificationResetOperation, "nativeResetStatus": certificationResetStatus])\n        }'],
 ['            var record = try loadRecord(); let time = try clock(record)', '            certificationResetPhase = "begin"; certificationResetCategory = "initial_load_failed"\n            var record = try loadRecord(); let time = try clock(record)'],
 ['            record.recoverable = ready; record.blocked = true; record.attempt = try random()', '            certificationResetCategory = "begin_attempt_failed"; certificationResetOperation = "begin_attempt"\n            record.recoverable = ready; record.blocked = true; record.attempt = try random()'],
 ['            try save(record) // durable fail-closed barrier BEFORE network verification', '            certificationResetCategory = "begin_attempt_failed"; certificationResetOperation = "barrier_write"\n            try save(record) // durable fail-closed barrier BEFORE network verification'],
 ['    @objc func revoke(_ call: CAPPluginCall) {\n        operate(call) {\n            let record = try loadRecord()', '    @objc func revoke(_ call: CAPPluginCall) {\n        operate(call) {\n            certificationResetPhase = "revoke"; certificationResetCategory = "initial_load_failed"\n            let record = try loadRecord()\n            certificationResetCategory = "revoke_attempt_mismatch"; certificationResetOperation = "revoke_attempt"; certificationResetStatus = "unknown"'],
 ['            try save(denied); return ["revoked": true]', '            certificationResetCategory = "revoke_storage_failed"; certificationResetOperation = "revoke_write"\n            try save(denied); return ["revoked": true]']
];
export function instrumentIosReset(source) {
 if(source.includes('certificationResetCategory'))throw Error('Unexpected iOS diagnostic source');
 for(const [from,to] of patches){if(source.split(from).length!==2)throw Error('iOS vault source contract changed');source=source.replace(from,to);}
 return source;
}
// Used only by tests to prove exact original source recovery and unchanged guards.
export function restoreIosResetSource(source) {
 for(const [from,to] of [...patches].reverse()){if(source.split(to).length!==2)throw Error('iOS diagnostic source changed');source=source.replace(to,from);}
 return source;
}
