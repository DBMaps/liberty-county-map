import XCTest
import CryptoKit
@testable import GridlyLabelsAuthorizationCandidate

@MainActor
final class AuthorizationAdapterTests: XCTestCase {
    private let now: Int64 = 1_800_000_000_000
    private final class Store: LabelsStoreEvidenceProvider {
        func labelsEvidence() async throws -> LabelsStoreEvidence { .init(signedTransaction: "aaa.bbb.ccc") }
    }
    private final class Attest: LabelsAttestEvidenceProvider {
        var calls = 0
        var digest: Data?
        func labelsRegisteredKeyID() async throws -> String { Data(repeating: 17, count: 32).base64EncodedString() }
        func labelsAssertion(digest: Data) async throws -> [String: String] {
            calls += 1; self.digest = digest
            return ["type": "apple_assertion", "keyId": try await labelsRegisteredKeyID(), "object": "c3ludGhldGlj"]
        }
    }
    private final class HTTP: PilotHTTP {
        var sendReply: (URLRequest) throws -> PilotHTTPReply
        init(_ sendReply: @escaping (URLRequest) throws -> PilotHTTPReply) { self.sendReply = sendReply }
        func send(_ request: URLRequest, maximumBytes: Int) async throws -> PilotHTTPReply { try sendReply(request) }
    }
    private func context() -> LabelsBindingContext {
        let bytes = P256.Signing.PrivateKey().publicKey.derRepresentation
        return .init(keyFingerprint: base64url(Data(SHA256.hash(data: bytes))), keySPKI: base64url(bytes), appID: "com.gridlygo.gridly")
    }
    func testChallengeRequestAndExactBinding() async throws {
        let id = UUID(), attest = Attest(), context = context()
        let http = HTTP { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.url?.absoluteString, "https://labels.example.invalid/v1/labels/challenge")
            XCTAssertNil(request.value(forHTTPHeaderField: "Referer"))
            XCTAssertNil(request.value(forHTTPHeaderField: "X-Gridly-Pilot-Ingress"))
            let body = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(request.httpBody)) as? [String: String])
            XCTAssertEqual(Set(body.keys), ["keyId", "spki", "paidEvidenceHash"])
            XCTAssertEqual(body["spki"], context.keySPKI)
            XCTAssertEqual(body["paidEvidenceHash"], base64url(Data(SHA256.hash(data: Data("aaa.bbb.ccc".utf8)))))
            let response = try JSONSerialization.data(withJSONObject: ["challengeId": id.uuidString.lowercased(), "expiresAt": self.now + 60_000, "purpose": "gridly-labels-lease-v1"])
            return .init(status: 201, contentType: "application/json", body: response)
        }
        let adapter = try GridlyLabelsAuthorizationAdapter(origin: "https://labels.example.invalid", http: http, store: Store(), attest: attest, clock: { self.now })
        let evidence = try await adapter.evidence(context)
        XCTAssertEqual(evidence.paidEvidence, "aaa.bbb.ccc")
        XCTAssertEqual(attest.digest, try context.clientDataHash(challengeID: id, paidEvidence: evidence.paidEvidence))
        XCTAssertEqual(attest.calls, 1)
    }
    func testInvalidationDuringChallengeCannotProduceEvidence() async throws {
        var adapter: GridlyLabelsAuthorizationAdapter!
        let attest = Attest()
        let http = HTTP { _ in
            adapter.invalidate()
            return .init(status: 201, contentType: "application/json", body: Data())
        }
        adapter = try GridlyLabelsAuthorizationAdapter(origin: "https://labels.example.invalid", http: http, store: Store(), attest: attest, clock: { self.now })
        do { _ = try await adapter.evidence(context()); XCTFail("old generation returned evidence") }
        catch { XCTAssertEqual(attest.calls, 0) }
    }
    func testPrototypeIdentityNeverStartsChallengeRequest() async throws {
        var sent = false
        let http = HTTP { _ in sent = true; throw LabelsAuthorizationError.unavailable }
        let good = context(), wrong = LabelsBindingContext(keyFingerprint: good.keyFingerprint, keySPKI: good.keySPKI, appID: "com.gridlygo.prototype.labeltiles.pilot")
        let adapter = try GridlyLabelsAuthorizationAdapter(origin: "https://labels.example.invalid", http: http, store: Store(), attest: Attest(), clock: { self.now })
        do { _ = try await adapter.evidence(wrong); XCTFail("prototype identity returned evidence") }
        catch { XCTAssertFalse(sent) }
    }
}
