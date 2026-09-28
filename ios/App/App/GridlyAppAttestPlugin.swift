import Foundation
import Security
import DeviceCheck
import Capacitor

// App Attest proves an app instance. Its key ID is never subscription ownership.
@objc(GridlyAppAttestPlugin)
public class GridlyAppAttestPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GridlyAppAttestPlugin"
    public let jsName = "GridlyAppAttest"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "confirm", returnType: CAPPluginReturnPromise)
    ]
    private let state = GridlyAppAttestState()

    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve(["supported": DCAppAttestService.shared.isSupported])
    }
    @objc func authorize(_ call: CAPPluginCall) {
        Task {
            let result = await state.authorize(call.getString("digest"))
            call.resolve(result)
        }
    }
    @objc func confirm(_ call: CAPPluginCall) {
        Task { call.resolve(await state.confirm(call.getString("keyId"))) }
    }
}

private actor GridlyAppAttestState {
    private let service = "com.gridlygo.gridly.appattest.v1"
    private var busy = false
    private struct Record: Codable { let keyId: String; var confirmed: Bool }
    private enum Failure: Error { case unavailable }
    // Keychain can survive uninstall while Secure Enclave App Attest keys do
    // not. The non-backed-up sandbox marker prevents reuse of a stale key ID.
    private func ensureInstallMarker() throws {
        var directory = try FileManager.default.url(for: .applicationSupportDirectory,
            in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("GridlyAppAttest", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        let marker = directory.appendingPathComponent("present")
        if !FileManager.default.fileExists(atPath: marker.path) {
            let status = SecItemDelete(query() as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else { throw Failure.unavailable }
            try Data("v1".utf8).write(to: marker, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
    }
    private func query() -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
         kSecAttrAccount as String: "key", kSecAttrSynchronizable as String: false]
    }
    private func load() throws -> Record? {
        var item = query(); item[kSecReturnData as String] = true; item[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(item as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data, data.count < 512 else { throw Failure.unavailable }
        return try JSONDecoder().decode(Record.self, from: data)
    }
    private func save(_ record: Record) throws {
        let data = try JSONEncoder().encode(record)
        let status = SecItemUpdate(query() as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var item = query(); item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw Failure.unavailable }
        } else if status != errSecSuccess { throw Failure.unavailable }
    }
    func authorize(_ encodedDigest: String?) async -> [String: Any] {
        guard DCAppAttestService.shared.isSupported, !busy,
              let text = encodedDigest, text.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil else {
            return ["errorCategory": "attestation_unavailable"]
        }
        let base64 = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/") + "="
        guard let digest = Data(base64Encoded: base64), digest.count == 32 else { return ["errorCategory": "attestation_unavailable"] }
        busy = true; defer { busy = false }
        do {
            try ensureInstallMarker()
            var record = try load()
            if record == nil {
                let keyId = try await DCAppAttestService.shared.generateKey()
                guard keyId.count <= 128 else { throw Failure.unavailable }
                record = Record(keyId: keyId, confirmed: false)
                try save(record!)
            }
            guard let current = record else { throw Failure.unavailable }
            if current.confirmed {
                let object = try await DCAppAttestService.shared.generateAssertion(current.keyId, clientDataHash: digest)
                guard object.count <= 8192 else { throw Failure.unavailable }
                return ["type": "apple_assertion", "keyId": current.keyId, "object": object.base64EncodedString()]
            }
            let object = try await DCAppAttestService.shared.attestKey(current.keyId, clientDataHash: digest)
            guard object.count <= 16384 else { throw Failure.unavailable }
            return ["type": "apple_initial", "keyId": current.keyId, "object": object.base64EncodedString()]
        } catch { return ["errorCategory": "attestation_unavailable"] }
    }
    func confirm(_ keyId: String?) -> [String: Any] {
        do {
            try ensureInstallMarker()
            guard let record = try load(), record.keyId == keyId else { throw Failure.unavailable }
            try save(Record(keyId: record.keyId, confirmed: true))
            return ["confirmed": true]
        } catch { return ["confirmed": false] }
    }
}
