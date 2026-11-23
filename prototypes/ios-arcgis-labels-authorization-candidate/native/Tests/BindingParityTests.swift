import XCTest
import Foundation
import CryptoKit
@testable import GridlyLabelsAuthorizationCandidate

final class BindingParityTests: XCTestCase {
    func testExportPublicCryptoKitAndLeaseBindingVector() throws {
        let origin = "https://labels.example.invalid"
        let lease = try XCTUnwrap(UUID(uuidString: "00000000-0000-4000-8000-000000000001"))
        let requestID = try XCTUnwrap(UUID(uuidString: "00000000-0000-4000-8000-000000000002"))
        let challenge = try XCTUnwrap(UUID(uuidString: "00000000-0000-4000-8000-000000000003"))
        let timestamp: Int64 = 1_794_484_800_000
        let key = P256.Signing.PrivateKey()
        let publicSPKI = key.publicKey.derRepresentation
        let context = LabelsBindingContext(keyFingerprint: base64url(Data(SHA256.hash(data: publicSPKI))),
            keySPKI: base64url(publicSPKI), appID: "com.gridlygo.gridly")
        let parts = try FixedPathTile.payload(origin: origin, level: 12, row: 1689, column: 968,
            leaseID: lease, timestamp: timestamp, requestID: requestID)
        let request = try FixedPathTile.request(origin: origin, level: 12, row: 1689, column: 968,
            leaseID: lease, timestamp: timestamp, requestID: requestID, key: key)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.httpBody, parts.body)
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
        XCTAssertNil(request.value(forHTTPHeaderField: "Referer"))
        let signature = try XCTUnwrap(request.value(forHTTPHeaderField: "X-Gridly-Labels-Signature"))
        let vector: [String: Any] = ["origin": origin, "publicKey": context.keySPKI,
            "signature": signature, "leaseId": lease.uuidString.lowercased(), "timestamp": timestamp,
            "requestId": requestID.uuidString.lowercased(), "body": String(decoding: parts.body, as: UTF8.self),
            "canonical": String(decoding: parts.proof, as: UTF8.self), "fingerprint": context.keyFingerprint,
            "challengeId": challenge.uuidString.lowercased(), "paidEvidence": "fixture/paid",
            "binding": base64url(try context.clientDataHash(challengeID: challenge, paidEvidence: "fixture/paid"))]
        // XCTest stdout works without granting a simulator test host access to runner filesystem paths.
        // Only public key/signature and synthetic evidence leave test memory.
        let bytes = try JSONSerialization.data(withJSONObject: vector, options: [.sortedKeys, .withoutEscapingSlashes])
        print("AUTHORIZATION_PUBLIC_VECTOR:" + bytes.base64EncodedString())
    }
}
