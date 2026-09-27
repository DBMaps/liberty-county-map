import Foundation
import Security
import Darwin
import Capacitor

// No receipts, account identity, coordinates or signing keys are persisted here.
@objc(GridlyContinuityPlugin)
public class GridlyContinuityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GridlyContinuityPlugin"
    public let jsName = "GridlyContinuity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "beginVerification", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "commit", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "retain", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "revoke", returnType: CAPPluginReturnPromise)
    ]
    private let lock = NSLock()
    private let service = "com.gridlygo.gridly.continuity.v1"
    private struct Record: Codable {
        var binding: String
        var proof = ""
        var verifiedAt: Double = 0
        var utc: Double = 0
        var wall: Double = 0
        var uptime: Double = 0
        var boot = ""
        var blocked = false
        var recoverable = false
        var attempt = ""
    }
    private enum VaultFailure: Error { case unavailable }
    private func random() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw VaultFailure.unavailable }
        return bytes.map { String(format: "%02x", $0) }.joined()
    }
    private func query() -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
         kSecAttrAccount as String: "authorization", kSecAttrSynchronizable as String: false]
    }
    private func save(_ record: Record) throws {
        let bytes = try JSONEncoder().encode(record)
        let status = SecItemUpdate(query() as CFDictionary, [kSecValueData as String: bytes] as CFDictionary)
        if status == errSecItemNotFound {
            var item = query(); item[kSecValueData as String] = bytes
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw VaultFailure.unavailable }
        } else if status != errSecSuccess { throw VaultFailure.unavailable }
    }
    private func loadRecord() throws -> Record {
        // Keychain may survive uninstall. A non-backed-up sandbox sentinel must
        // exist before any retained item is trusted; reinstall deletes that item.
        var directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("GridlyContinuity", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        let marker = directory.appendingPathComponent("present")
        if !FileManager.default.fileExists(atPath: marker.path) {
            let status = SecItemDelete(query() as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else { throw VaultFailure.unavailable }
            try Data("v1".utf8).write(to: marker, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
        var item = query(); item[kSecReturnData as String] = true; item[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        let status = SecItemCopyMatching(item as CFDictionary, &value)
        if status == errSecItemNotFound {
            let record = Record(binding: try random()); try save(record); return record
        }
        guard status == errSecSuccess, let data = value as? Data, data.count < 16384 else { throw VaultFailure.unavailable }
        return try JSONDecoder().decode(Record.self, from: data)
    }
    private func clock(_ record: Record) throws -> (Double, Double, Double, String, Bool) {
        var bootTime = timeval(); var size = MemoryLayout<timeval>.size
        var mib: [Int32] = [CTL_KERN, KERN_BOOTTIME]
        guard sysctl(&mib, 2, &bootTime, &size, nil, 0) == 0 else { throw VaultFailure.unavailable }
        let boot = "\(bootTime.tv_sec):\(bootTime.tv_usec)"
        let wall = Date().timeIntervalSince1970 * 1000
        var timebase = mach_timebase_info_data_t()
        guard mach_timebase_info(&timebase) == KERN_SUCCESS, timebase.denom != 0 else { throw VaultFailure.unavailable }
        // Unlike awake-only uptime, this includes device sleep.
        let uptime = Double(mach_continuous_time()) * Double(timebase.numer) / Double(timebase.denom) / 1_000_000
        let trusted = record.proof.isEmpty || (record.boot == boot && uptime >= record.uptime && wall >= record.wall)
        let utc = max(wall, record.utc + max(0, uptime - record.uptime))
        return (utc, wall, uptime, boot, trusted)
    }
    private func operate(_ call: CAPPluginCall, _ work: () throws -> [String: Any]) {
        lock.lock(); defer { lock.unlock() }
        do { call.resolve(try work()) } catch { call.reject("continuity_unavailable") }
    }
    @objc func beginVerification(_ call: CAPPluginCall) {
        operate(call) {
            var record = try loadRecord(); let time = try clock(record)
            let ready = !record.blocked && time.4
            let proof = ready ? record.proof : ""
            record.recoverable = ready; record.blocked = true; record.attempt = try random()
            try save(record) // durable fail-closed barrier BEFORE network verification
            return ["binding": record.binding, "attempt": record.attempt, "proof": proof, "nowMs": time.0, "clockTrusted": ready]
        }
    }
    @objc func commit(_ call: CAPPluginCall) {
        operate(call) {
            var record = try loadRecord()
            guard record.blocked, call.getString("attempt") == record.attempt,
                  let proof = call.getString("proof"), proof.count <= 4096, !proof.isEmpty,
                  let verified = call.getDouble("verifiedAt"), verified.isFinite, verified >= record.verifiedAt else { throw VaultFailure.unavailable }
            let time = try clock(record)
            record.proof = proof; record.verifiedAt = verified; record.utc = max(time.1, verified)
            record.wall = time.1; record.uptime = time.2; record.boot = time.3
            record.blocked = false; record.recoverable = false; record.attempt = ""
            try save(record); return ["saved": true]
        }
    }
    @objc func retain(_ call: CAPPluginCall) {
        operate(call) {
            var record = try loadRecord()
            guard record.blocked, call.getString("attempt") == record.attempt else { throw VaultFailure.unavailable }
            let time = try clock(record)
            if record.recoverable && time.4 {
                record.utc = time.0; record.wall = time.1; record.uptime = time.2; record.boot = time.3
                record.blocked = false
            }
            record.recoverable = false; record.attempt = ""
            try save(record); return ["retained": !record.blocked]
        }
    }
    @objc func revoke(_ call: CAPPluginCall) {
        operate(call) {
            let record = try loadRecord()
            guard record.blocked, call.getString("attempt") == record.attempt else { throw VaultFailure.unavailable }
            let denied = Record(binding: try random()) // old signed records cannot match
            try save(denied); return ["revoked": true]
        }
    }
}
