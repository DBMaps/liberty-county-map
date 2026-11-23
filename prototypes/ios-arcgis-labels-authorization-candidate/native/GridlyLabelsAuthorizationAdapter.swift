import Foundation
import CryptoKit

enum LabelsAuthorizationError: Error { case unavailable }
struct LabelsStoreEvidence { let signedTransaction: String }
@MainActor protocol LabelsStoreEvidenceProvider {
    func labelsEvidence() async throws -> LabelsStoreEvidence
}
@MainActor protocol LabelsAttestEvidenceProvider {
    func labelsRegisteredKeyID() async throws -> String
    func labelsAssertion(digest: Data) async throws -> [String: String]
}
extension GridlyStoreKitPlugin: LabelsStoreEvidenceProvider {}
extension GridlyAppAttestPlugin: LabelsAttestEvidenceProvider {}

// Native-only evidence closure for the existing lease transport. Reuse the SAME
// plugin instances registered with Capacitor. This does not register/confirm a key,
// finish a purchase, store an entitlement, or expose a tile signing key to JavaScript.
@MainActor
final class GridlyLabelsAuthorizationAdapter {
    private let origin: String
    private let http: PilotHTTP
    private let store: any LabelsStoreEvidenceProvider
    private let attest: any LabelsAttestEvidenceProvider
    private let clock: () -> Int64
    private var generation = 0

    init(origin: String, http: PilotHTTP, store: any LabelsStoreEvidenceProvider, attest: any LabelsAttestEvidenceProvider,
         clock: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }) throws {
        guard let url = URL(string: origin), url.scheme == "https", url.host != nil,
              url.user == nil, url.password == nil, url.path.isEmpty, url.query == nil,
              url.fragment == nil else { throw LabelsAuthorizationError.unavailable }
        self.origin = origin; self.http = http; self.store = store; self.attest = attest; self.clock = clock
    }

    // Background/entitlement-loss owner calls this AND transport.invalidate().
    // A late response cannot reinstate a lease/evidence operation from an old generation.
    func invalidate() { generation += 1 }

    func evidence(_ context: LabelsBindingContext) async throws -> LabelsLeaseEvidence {
        let current = generation
        func check() throws {
            try Task.checkCancellation()
            guard current == generation else { throw LabelsAuthorizationError.unavailable }
        }
        guard context.appID == "com.gridlygo.gridly",
              let spki = Self.decode(context.keySPKI), spki.count == 91,
              base64url(Data(SHA256.hash(data: spki))) == context.keyFingerprint
        else { throw LabelsAuthorizationError.unavailable }
        try check()
        let paid = try await store.labelsEvidence()
        let keyID = try await attest.labelsRegisteredKeyID()
        try check()
        struct ChallengeBody: Encodable { let keyId: String; let spki: String; let paidEvidenceHash: String }
        struct Challenge: Decodable { let challengeId: UUID; let expiresAt: Int64; let purpose: String }
        guard let endpoint = URL(string: origin + "/v1/labels/challenge") else { throw LabelsAuthorizationError.unavailable }
        var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalCacheData)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(ChallengeBody(keyId: keyID, spki: context.keySPKI,
            paidEvidenceHash: base64url(Data(SHA256.hash(data: Data(paid.signedTransaction.utf8))))))
        let reply = try await http.send(request, maximumBytes: 4096)
        try check()
        guard reply.status == 201, reply.contentType == "application/json" else { throw LabelsAuthorizationError.unavailable }
        let challenge = try JSONDecoder().decode(Challenge.self, from: reply.body)
        guard challenge.purpose == "gridly-labels-lease-v1", challenge.expiresAt > clock(),
              challenge.expiresAt <= clock() + 120_000 else { throw LabelsAuthorizationError.unavailable }
        let digest = try context.clientDataHash(challengeID: challenge.challengeId, paidEvidence: paid.signedTransaction)
        let assertion = try await attest.labelsAssertion(digest: digest)
        try check()
        guard assertion["keyId"] == keyID, challenge.expiresAt > clock() else { throw LabelsAuthorizationError.unavailable }
        let bytes = try JSONSerialization.data(withJSONObject: assertion, options: [.withoutEscapingSlashes, .sortedKeys])
        guard let encoded = String(data: bytes, encoding: .utf8), bytes.count <= 20_000 else { throw LabelsAuthorizationError.unavailable }
        return LabelsLeaseEvidence(challengeID: challenge.challengeId, paidEvidence: paid.signedTransaction, attestEvidence: encoded)
    }

    private static func decode(_ value: String) -> Data? {
        let text = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        return Data(base64Encoded: text + String(repeating: "=", count: (4 - text.count % 4) % 4))
    }
}
