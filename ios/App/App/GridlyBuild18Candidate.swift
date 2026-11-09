#if GRIDLY_BUILD18_DIAGNOSTIC && GRIDLY_ARCGIS_DIAGNOSTIC
import CryptoKit
import Darwin
import Foundation

enum GridlyBuild18Candidate {
    enum Rejection: Error { case rejected }
    static let maxFileBytes = 8192
    static let fileExtension = "gridlycandidate"
    private static let datalessFlag: UInt32 = 0x40000000 // Darwin SF_DATALESS

    struct Identity: Equatable {
        let bundleID: String
        let version: String
        let build: String
        static let expected = Self(bundleID: "com.gridlygo.gridly", version: "1.0.2", build: "18")
        init(bundleID: String, version: String, build: String) {
            self.bundleID = bundleID
            self.version = version
            self.build = build
        }
        init(bundle: Bundle) {
            self.init(bundleID: bundle.bundleIdentifier ?? "",
                      version: bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "",
                      build: bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "")
        }
    }

    struct Unlocked {
        let run: String
        let expires: Date
        var token: Data
    }

    // The picker is the only caller in the app. Open in place and hold the security scope
    // only while copying bounded ciphertext into memory; never retain a URL or bookmark.
    static func readPickedFile(_ url: URL) throws -> Data {
        guard url.isFileURL, url.startAccessingSecurityScopedResource() else { throw Rejection.rejected }
        defer { url.stopAccessingSecurityScopedResource() }
        // Inspect before coordination so a known cloud item is never requested.
        try checkLocalFile(url)
        var error: NSError?
        var result: Data?
        NSFileCoordinator().coordinate(readingItemAt: url, options: .withoutChanges, error: &error) { coordinated in
            result = try? readLocalFile(coordinated)
        }
        guard error == nil, let result = result else { throw Rejection.rejected }
        return result
    }

    private static func checkLocalFile(_ url: URL) throws {
        guard url.isFileURL, url.pathExtension == fileExtension else { throw Rejection.rejected }
        let path = url.standardizedFileURL.path
        // iOS provides /var as an alias for /private/var.
        let canonical = path.hasPrefix("/var/") ? "/private" + path : path
        guard url.resolvingSymlinksInPath().standardizedFileURL.path == canonical else { throw Rejection.rejected }
        var info = stat()
        guard lstat(url.path, &info) == 0, safeFile(info) else { throw Rejection.rejected }
        let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey,
                                                      .isUbiquitousItemKey, .volumeIsLocalKey, .fileSizeKey])
        guard values.isRegularFile == true, values.isSymbolicLink == false,
              values.isUbiquitousItem != true, values.volumeIsLocal == true,
              let size = values.fileSize, (29...maxFileBytes).contains(size) else { throw Rejection.rejected }
    }

    private static func safeFile(_ info: stat) -> Bool {
        (info.st_mode & S_IFMT) == S_IFREG && info.st_uid == getuid() &&
        info.st_nlink == 1 && (info.st_mode & 0o022) == 0 &&
        (info.st_flags & datalessFlag) == 0 && (29...Int64(maxFileBytes)).contains(info.st_size)
    }

    static func readLocalFile(_ url: URL) throws -> Data {
        try checkLocalFile(url)
        let fd = Darwin.open(url.path, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC)
        guard fd >= 0 else { throw Rejection.rejected }
        defer { Darwin.close(fd) }
        var info = stat()
        guard fstat(fd, &info) == 0, safeFile(info) else { throw Rejection.rejected }
        var bytes = Data(count: Int(info.st_size))
        let complete = bytes.withUnsafeMutableBytes { (buffer: UnsafeMutableRawBufferPointer) -> Bool in
            guard let start = buffer.baseAddress else { return false }
            var offset = 0
            while offset < buffer.count {
                let length = Darwin.read(fd, start.advanced(by: offset), buffer.count - offset)
                guard length > 0 else { return false }
                offset += length
            }
            var trailing: UInt8 = 0
            return Darwin.read(fd, &trailing, 1) == 0
        }
        guard complete else { throw Rejection.rejected }
        return bytes
    }

    static func verificationKey(in bundle: Bundle) -> String? {
        guard let value = bundle.object(forInfoDictionaryKey: "GridlyBuild18OwnerPublicKey") as? String,
              hex(value[...], count: 32) != nil else { return nil }
        return value
    }

    static func open(_ envelope: Data, grant: String, identity: Identity, expectedRun: String, ownerPublicKey: String,
                     now: Date = Date()) throws -> Unlocked {
        guard identity == .expected, (29...maxFileBytes).contains(envelope.count),
              grant.utf8.count == 297,
              let publicBytes = hex(ownerPublicKey[...], count: 32),
              let owner = try? Curve25519.Signing.PublicKey(rawRepresentation: publicBytes) else { throw Rejection.rejected }
        let fields = grant.split(separator: ".", omittingEmptySubsequences: false)
        guard fields.count == 4, fields[0] == expectedRun, fields[0].hasPrefix("owner-"), fields[0].utf8.count == 38,
              hex(fields[0].dropFirst(6), count: 16) != nil,
              let digest = hex(fields[1], count: 32),
              var secret = hex(fields[2], count: 32),
              let signature = hex(fields[3], count: 64) else { throw Rejection.rejected }
        defer { secret.resetBytes(in: 0..<secret.count) }
        let run = String(fields[0])
        let envelopeDigest = SHA256.hash(data: envelope).map { String(format: "%02x", $0) }.joined()
        var authorization = Data("GRIDLY_BUILD18_OWNER_GRANT_V1\n\(run)\n\(fields[1])\n\(fields[2])\n\(envelopeDigest)\n".utf8)
        defer { authorization.resetBytes(in: 0..<authorization.count) }
        guard owner.isValidSignature(signature, for: authorization) else { throw Rejection.rejected }
        let binding = Data("GRIDLY_BUILD18_CANDIDATE_V1\n\(identity.bundleID)\n\(identity.version)\n\(identity.build)\n\(run)\n\(fields[1])\n".utf8)
        guard let box = try? AES.GCM.SealedBox(combined: envelope),
              var plaintext = try? AES.GCM.open(box, using: SymmetricKey(data: secret), authenticating: binding) else {
            throw Rejection.rejected
        }
        defer { plaintext.resetBytes(in: 0..<plaintext.count) }
        guard plaintext.count >= 27, plaintext[10] == 10,
              plaintext.prefix(10).allSatisfy({ (48...57).contains($0) }),
              let seconds = Double(String(decoding: plaintext.prefix(10), as: UTF8.self)),
              seconds > now.timeIntervalSince1970, seconds <= now.timeIntervalSince1970 + 900 else { throw Rejection.rejected }
        var token = Data(plaintext.dropFirst(11))
        defer { token.resetBytes(in: 0..<token.count) }
        guard GridlyLabelDiagnostic.validCandidateBytes(token),
              Data(SHA256.hash(data: token)) == digest else { throw Rejection.rejected }
        return Unlocked(run: run, expires: Date(timeIntervalSince1970: seconds), token: token)
    }

    private static func hex(_ field: Substring, count: Int) -> Data? {
        let bytes = field.utf8
        guard bytes.count == count * 2, bytes.allSatisfy({ (48...57).contains($0) || (97...102).contains($0) }) else { return nil }
        func nibble(_ b: UInt8) -> UInt8 { b <= 57 ? b - 48 : b - 87 }
        var result = Data(capacity: count)
        var index = bytes.startIndex
        while index != bytes.endIndex {
            let next = bytes.index(after: index)
            result.append(nibble(bytes[index]) << 4 | nibble(bytes[next]))
            index = bytes.index(after: next)
        }
        return result
    }
}
#endif
